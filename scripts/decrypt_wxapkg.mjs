// Decrypt WeChat 4.x encrypted wxapkg (V1MMWX)
// key = PBKDF2-HMAC-SHA1(wxid, "saltiest", 1000, 32) -> AES-256-CBC, iv "the iv: 16 bytes"
// rest XORed with wxid[len-2]
import { pbkdf2Sync, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output, wxid] = process.argv.slice(2);
const raw = readFileSync(input);

if (raw.subarray(0, 6).toString() !== 'V1MMWX') {
  writeFileSync(output, raw);
  console.log('plain, copied');
  process.exit(0);
}

const dk = pbkdf2Sync(wxid, 'saltiest', 1000, 32, 'sha1');
const d = createDecipheriv('aes-256-cbc', dk, Buffer.from('the iv: 16 bytes'));
d.setAutoPadding(false);
const head = Buffer.concat([d.update(raw.subarray(6, 6 + 1024)), d.final()]);
if (head[0] !== 0xbe) {
  console.error('FAIL head byte =', head[0].toString(16));
  process.exit(1);
}
const xorKey = wxid.charCodeAt(wxid.length - 2);
const rest = Buffer.from(raw.subarray(6 + 1024).map((b) => b ^ xorKey));
writeFileSync(output, Buffer.concat([head.subarray(0, 1023), rest]));
console.log(`OK xorKey=${String.fromCharCode(xorKey)} -> ${output}`);
