// 苍盾考研 API client — replicates the mini-program's request protocol
// - POST body: params=<hex(RSA-encryptLong(JSON))>  (form-urlencoded)
// - Headers: cdtoken / openid / CDKY = RSA-encryptLong of token / openid / timestamp+"_CDKY"
// - encryptLong: PKCS1-v1.5, 117-char chunks (UTF-16 units), hex concat — same as bundle
import { publicEncrypt, constants, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const RSA_PUB = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCWW3trWxl0q18e4+4BjJyYXzHE
1aMRfKpzSeEHdZaiqpxwxlM5CtS3e98vly7ATWTcWAL1m5dnybXm8P9LWIged1jTT
XmN4xHH1db+UrtU5d8DjxUySc/fDBTdM/D2LOfu0kJHt8EezuJd90bfq0mILXZLXa
QvPLzoWLcDlMtRjwIDAQAB
-----END PUBLIC KEY-----`;

export const BASE_URLS = {
  1: 'https://cdzztk.cdky.vip/',
  2: 'https://cdzz.cdkyvip360.cn/',
  3: 'https://cdzz.cdky.vip/',
};

const utf16Chunk = (s, n) => {
  const units = [...s]; // spread splits surrogate pairs; jsencrypt's regex splits raw units.
  // jsencrypt: t.match(/.{1,117}/g) splits per UTF-16 code unit, may split surrogates.
  // Replicate that exactly:
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
};

export function encryptLong(text) {
  const chunks = utf16Chunk(text, 117);
  const blocks = [];
  for (const c of chunks) {
    blocks.push(publicEncrypt(
      { key: RSA_PUB, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(c, 'utf8')
    ));
  }
  return Buffer.concat(blocks).toString('base64');
}

export class CdkyClient {
  constructor({ token = '', openid = '', base = 1 } = {}) {
    this.token = token;
    this.openid = openid;
    this.base = BASE_URLS[base] || BASE_URLS[1];
  }

  headers() {
    const h = {
      'content-type': 'application/x-www-form-urlencoded',
      referer: 'https://servicewechat.com/wx66c69264f205d010/19/page-frame.html',
      'xweb_xhr': '1',
      isios: '2',
      cdky: encryptLong(Date.now() + '_CDKY'),
    };
    h.cdtoken = this.token ? encryptLong(this.token) : '';
    h.openid = this.openid ? encryptLong(this.openid) : '';
    return h;
  }

  async post(endpoint, data = {}) {
    const payload = { cdtoken: this.token, openid: this.openid, ...data };
    const body = new URLSearchParams({ params: encryptLong(JSON.stringify(payload)) });
    const res = await fetch(this.base + endpoint, {
      method: 'POST',
      headers: this.headers(),
      body: body.toString(),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`non-JSON (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  // 刷新 token（zzhome 每次下发新 token，旧的会失效）
  async refreshToken() {
    const r = await this.post('apicdzz/zzhome', {});
    if (r.code === 0 && r.wxuserInfo?.token) {
      this.token = r.wxuserInfo.token;
      this.persist?.();
      return this.token;
    }
    throw new Error('refreshToken failed: ' + JSON.stringify(r).slice(0, 150));
  }

  // 带自动换 token 的请求：-11 时刷新 token 重试一次
  async call(endpoint, data = {}, { retries = 2, delayMs = 250 } = {}) {
    for (let i = 0; i <= retries; i++) {
      const r = await this.post(endpoint, data).catch((e) => ({ code: -999, msg: String(e).slice(0, 120) }));
      if (r.code === 0 || r.code === 200) return r;
      if (r.code === -11 || r.code === -17) {
        await this.refreshToken();
        await new Promise((s) => setTimeout(s, 150));
        continue;
      }
      return r; // 其他错误码（如无效ID）直接返回
    }
    return { code: -998, msg: 'exhausted retries (token refreshed each time)' };
  }
}

export function loadCreds(path = '/Users/cat/git-use/苍盾/credentials/creds.json') {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

// 带持久化的客户端：token 刷新后自动写回 creds.json
export async function createClient(path = '/Users/cat/git-use/苍盾/credentials/creds.json', opts = {}) {
  const creds = loadCreds(path);
  const c = new CdkyClient({ ...creds, ...opts });
  c.persist = () => writeFileSync(path, JSON.stringify({ ...creds, token: c.token, openid: c.openid }, null, 2));
  await c.refreshToken();
  return c;
}
