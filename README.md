# 苍盾小程序数据抓取结果

抓取时间：2026-11-07 ~ 11-08。数据来源：苍盾考研政治刷题小程序（appid `wx66c69264f205d010`）。

> **破解过程与接口协议的完整文档见 [破解与接口文档.md](破解与接口文档.md)**
>
> 目录约定：`data/` = 纯题库数据（不含任何个人凭证，可安全使用）；
> `credentials/` = 微信凭证与抓包记录（token/openid/含手机号的流量，**勿外传、勿提交公开仓库**）

## 数据清单（`data/` 目录）

| 文件 | 内容 |
|---|---|
| `cangdun.db` | SQLite 主库（139MB）：题库/章节/题目/考点 四张表。**不入库**（超 GitHub 100MB 限制），重建：`python3 scripts/build_db.py` |
| `export_full.json` | 按题库→科目→章节 分组的全部题目（42MB，重构友好） |
| `export_kaodian.json` | 484 个考点的教材内容（HTML+纯文本） |
| `images/` | 113 张题目/解析/考点配图（PNG，已按文件名落盘） |
| `questions.jsonl` | 原始逐章响应（已脱敏：不含个人答题统计） |
| `tree.json` / `chapters.json` | 题库树与章节清单 |
| `cdtklist_full.json` | 完整题库目录（版本分组/帽子题/速刷版/考点体系） |
| `kaodian_content.jsonl` | 考点内容原始响应 |

## 数据规模

- **34,784 道题**（100% 含答案 + 解析 HTML + 考点归属 + 全站正确率；timu_id 已去重）
- **2,126 章** / 254 个题库节点 / 484 个考点 / 130 张配图
- 覆盖：真题刷题(2010-2026共17年+专题真题)、精选1600题(2023-2027各年版)、二刷600题(各年版)、27余峰500题、肖1000(帽子题/速刷/考点整理3版)、肖8/肖4、腿姐刷题计划/4套卷/8套卷、徐涛优题库(基础/拔高)/10套卷/3套卷、苏一300题/800题、米鹏1000题/大李子720题/6套卷/3套卷、杨攀660题/5套卷、余峰6套卷/4套卷、张修齐3套卷、1600题、600题、冲刺300、每日刷题、时政、考点刷题、组合刷题（涛涛/腿姐/张修齐课配套）、26版冲刺押题库全套等

## SQLite 数据字典

```sql
tiku(tlevel_id, name, source)                    -- 题库/科目节点
chapter(tlevel_id, path, tiku_name, subject, name, question_count)
question(timu_id, chapter_id, num, type, title, options_json,
         answer, answer_list, jiexi, jiexi_text, chuchu,
         kaodian_id, kaodian_text, top_kaodian_text,
         right_num, total_num, tlevel_id)
kaodian(kaodian_level_id, title, content_html, content_text, image_count)
```

- `type`: 单选 / 多选
- `answer` 如 `"B"`；多选如 `"AC"`（`answer_list` 为数组）
- `jiexi` 是 HTML（含 `<img>`、表格），`jiexi_text` 是去标签纯文本
- `right_num/total_num`：全站做对人数/总人数 → 正确率
- 图片本地映射：HTML 里的 `https://cangdun.oss-cn-beijing.aliyuncs.com/.../<NAME>.png` → `data/images/<NAME>.png`
  （OSS 有 Referer 白名单，热链会 403；重构时用本地图片或带 referer 代理）

## API 协议（可用于日后增量更新）

- Base：`https://cdzztk.cdky.vip/`（备用 `https://cdzz.cdkyvip360.cn/`）
- 所有业务请求为 `POST`，body 为 form：`params=<base64>`
- `params` = RSA 加密的 JSON：明文 `{cdtoken, openid, isIOS, ...业务字段}`，
  用内嵌公钥（1024位 PKCS1-v1.5）按 **117 字符分块**（UTF-16 切分）逐块加密后**二进制拼接再 base64**
- 请求头：`cdtoken`/`openid`/`cdky` 均为同算法 RSA-base64；
  `cdky` = `encryptLong(`${Date.now()}_CDKY`)`（服务器校验时间新鲜度）
- **token 轮换**：`apicdzz/zzhome` 每次响应 `wxuserInfo.token` 下发新 token，旧 token 随即失效
  （部分端点对旧 token 报 `-11 登录异常`）。爬虫须在 -11 时重新调 zzhome 换 token
- 响应为明文 JSON：`code=0` 成功；`-11` 登录异常（换token）；`-17` 参数错误；`-18` 请求超时（cdky 过期）

核心端点：
| 端点 | 参数 | 说明 |
|---|---|---|
| `apicdvip/cdtklist` | `{from:"cdtk"}` | vip题库目录树（帽子题/速刷/考点整理） |
| `apicdzz/qianghua` | `{}` | 强化题库页系列列表 |
| `apicdzz/chongci` | `{}` | 冲刺模拟页系列列表（26版/27版押题库） |
| `apicd/zuanti/zhangjie` | `{top_tlevel_id:"2", tiku:"zhenti"}` | 真题(章节版)专题树 |
| `apicdzz/zhangjie` | `{tlevel_id, ptiku_id:""}` | 子节点列表（空=章节叶子） |
| `apicdzz/timudetail` | `{tlevel_id}` | **该章节全部题目（含答案解析）** |
| `apicdzz/zzhome` | `{}` | 首页 + 换发 token |
| `apicdvip/kdcontent` | `{kaodian_level_id}` | 考点教材内容 |
| `apicdzz/userquanxian` | `{}` | 用户权限 |

树结构：根节点 `1`=精选题库（下挂 真题刷题/精选1600/二刷600/名师题库/冲刺模拟 等全部子树）。

复刻客户端：`scripts/cdky_client.mjs`（含 token 自动轮换 `createClient()`/`call()`）
重跑爬虫：`node scripts/crawler.mjs`（增量：跳过 questions.jsonl 已有章节）→ `python3 scripts/build_db.py`

## 本机痕迹清理（抓包用完记得关）

```bash
kill $(cat credentials/capture/mitm.pid)                      # 停 mitmdump
networksetup -setwebproxy Wi-Fi off               # 关系统代理
networksetup -setsecurewebproxy Wi-Fi off
# 可选：移除 mitmproxy CA 证书
# security delete-certificate -c mitmproxy ~/Library/Keychains/login.keychain-db
```
