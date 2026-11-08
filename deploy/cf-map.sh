#!/usr/bin/env bash
# 一键映射（永久）：cangdun 应用 → Cloudflare Tunnel 公网域名
# 用法: ./deploy/cf-map.sh [域名] [端口]
#   默认: cd.2023989.xyz 37080
# 依赖: 本机 cf CLI 已登录、cloudflared 容器在跑、docker compose
#
# 永久机制（无临时凭据/无防火墙规则）：
#   - cangdun 与 cloudflared 接入同一 docker 网络，ingress 直连 http://cangdun:80
#     （不依赖宿主 iptables/1Panel，重启与防火墙重置均不影响）
#   - 隧道管理用「永久 API token」，保存在 ~/.config/cloudflare/cangdun-tunnel-token
#     （首次运行用 cf CLI 的 OAuth 自动铸造，权限仅 Cloudflare Tunnel Write）
set -euo pipefail

HOSTNAME_TARGET="${1:-cd.2023989.xyz}"
PORT_TARGET="${2:-37080}"
ZONE="${HOSTNAME_TARGET#*.}"
NET="cangdun-net"
CF_CONFIG="$HOME/.config/cloudflare/config/default.json"
TOKEN_FILE="$HOME/.config/cloudflare/cangdun-tunnel-token"
TUNNEL_CONTAINER="cloudflared"
ACCT="866b0746ea84a6fd0382ca8cf537d068"
TUNNEL_ID="ba2f946a-d797-4e3c-8a5e-4cf6c8c3413b"

say() { printf '\033[36m[cf-map]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[cf-map] 失败:\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- 1. 应用容器（compose，含共享网络） ----------
say "启动/更新应用 (compose)"
if docker ps -a --format '{{.Names}}' | grep -qx cangdun; then
  if [ -z "$(docker inspect cangdun --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null)" ]; then
    docker rm -f cangdun >/dev/null
    say "已移除非 compose 管理的同名容器"
  fi
fi
docker network create "$NET" >/dev/null 2>&1 || true
docker compose up -d --build >/dev/null || die "compose 启动失败"
READY=""
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null --max-time 2 "http://localhost:$PORT_TARGET/"; then READY=1; break; fi
  sleep 1
done
[ -n "$READY" ] || die "应用未就绪 http://localhost:$PORT_TARGET"
say "应用已就绪: http://localhost:$PORT_TARGET"

# ---------- 2. cloudflared 接入共享网络（幂等，不重启容器） ----------
if docker network inspect "$NET" --format '{{range .Containers}}{{.Name}} {{end}}' | grep -qw "$TUNNEL_CONTAINER"; then
  say "网络: $TUNNEL_CONTAINER 已在 $NET，跳过"
else
  docker network connect "$NET" "$TUNNEL_CONTAINER"
  say "网络: 已将 $TUNNEL_CONTAINER 接入 $NET"
  sleep 2
fi

# ---------- 3. 永久 API token（有则复用，失效则重新铸造） ----------
if [ -s "$TOKEN_FILE" ] && curl -sf -H "Authorization: Bearer $(cat "$TOKEN_FILE")" \
     "https://api.cloudflare.com/client/v4/user/tokens/verify" 2>/dev/null | grep -q '"success":true'; then
  say "token: 复用永久 token（$TOKEN_FILE）"
else
  say "token: 铸造永久 token（Cloudflare Tunnel Write）"
  cf zones list >/dev/null 2>&1 || die "cf CLI 未登录（先执行 cf login 或检查 $CF_CONFIG）"
  OAUTH=$(python3 -c "import json;print(json.load(open('$CF_CONFIG'))['oauth_token'])")
  GRP=$(curl -sf -H "Authorization: Bearer $OAUTH" \
    "https://api.cloudflare.com/client/v4/user/tokens/permission_groups?per_page=100" \
    | python3 -c "import json,sys;print(next(g['id'] for g in json.load(sys.stdin)['result'] if g['name']=='Cloudflare Tunnel Write'))")
  RESP=$(curl -sf -X POST -H "Authorization: Bearer $OAUTH" -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/user/tokens" -d "{
      \"name\": \"cangdun-tunnel-manage\",
      \"policies\": [{\"effect\": \"allow\",
        \"resources\": {\"com.cloudflare.api.account.$ACCT\": \"*\"},
        \"permission_groups\": [{\"id\": \"$GRP\"}]}]
    }") || die "铸造 token 失败"
  echo "$RESP" | python3 -c "
import json,sys,os
r = json.load(sys.stdin)['result']
open(os.path.expanduser('$TOKEN_FILE'), 'w').write(r['value'])
os.chmod(os.path.expanduser('$TOKEN_FILE'), 0o600)"
  say "token: 已铸造并保存 $TOKEN_FILE（永久，权限仅 Tunnel Write）"
fi

# ---------- 4. 合并式更新隧道 ingress（保留其他域名规则） ----------
say "更新隧道 ingress：$HOSTNAME_TARGET → http://cangdun:80"
curl -sf -H "Authorization: Bearer $(cat "$TOKEN_FILE")" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/cfd_tunnel/$TUNNEL_ID/configurations" > /tmp/cf-map-cfg.json \
  || die "读取隧道配置失败"
python3 - "$HOSTNAME_TARGET" <<'PY' > /tmp/cf-map-new.json
import json, sys
host = sys.argv[1]
cfg = json.load(open('/tmp/cf-map-cfg.json'))['result']['config']
ingress = [r for r in cfg.get('ingress', []) if r.get('hostname') != host]
ingress.insert(0, {"hostname": host, "service": "http://cangdun:80"})
print(json.dumps({"config": {"ingress": ingress, "warp-routing": cfg.get('warp-routing', {"enabled": False})}}))
PY
curl -sf -X PUT -H "Authorization: Bearer $(cat "$TOKEN_FILE")" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/cfd_tunnel/$TUNNEL_ID/configurations" \
  --data @/tmp/cf-map-new.json >/dev/null || die "隧道配置更新失败"
say "隧道 ingress 已更新（其他 $(python3 -c "import json;print(len(json.load(open('/tmp/cf-map-new.json'))['config']['ingress'])-1)") 条规则原样保留）"

# ---------- 5. DNS CNAME（cf CLI，proxied） ----------
EXISTING=$(cf dns records list --zone "$ZONE" 2>/dev/null | python3 -c "
import json,sys
try:
    for r in json.load(sys.stdin):
        if r['name'] == '$HOSTNAME_TARGET' and r['type'] == 'CNAME': print(r['id'])
except Exception: pass" || true)
if [ -n "$EXISTING" ]; then
  say "DNS: $HOSTNAME_TARGET CNAME 已存在，跳过"
else
  cf dns records create --zone "$ZONE" --body "{\"type\":\"CNAME\",\"name\":\"${HOSTNAME_TARGET%%.*}\",\"content\":\"$TUNNEL_ID.cfargotunnel.com\",\"proxied\":true,\"ttl\":1}" >/dev/null
  say "DNS: 已创建 $HOSTNAME_TARGET → $TUNNEL_ID.cfargotunnel.com (proxied)"
fi

# ---------- 6. 验证 ----------
sleep 3
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$HOSTNAME_TARGET/")
[ "$CODE" = "200" ] || die "https://$HOSTNAME_TARGET 返回 $CODE"
say "✅ https://$HOSTNAME_TARGET → 200（永久）"
rm -f /tmp/cf-map-cfg.json /tmp/cf-map-new.json
