// Try multiple candidate keys for V1MMWX decryption
import { createHash, createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const raw = readFileSync(file);
const payload = raw.subarray(6);

const candidates = [
  'wxid_1de7exgvlm1922',
  'wxid_1de7exgvlm1922_1a20',
  '1a2004925805854fd3ea06b516267916',
  'wx66c69264f205d010',
];
// key derivations to try per candidate
const derive = {
  'md5(wxid)': (s) => createHash('md5').update(s).digest(),
  'md5(wxid)hex16': (s) => Buffer.from(createHash('md5').update(s).digest('hex').slice(0, 16)),
};

for (const c of candidates) {
  for (const [name, fn] of Object.entries(derive)) {
    for (const ivStr of ['the iv: 16 bytes', '\0'.repeat(16)]) {
      try {
        const d = createDecipheriv('aes-128-cbc', fn(c), Buffer.from(ivStr, 'utf8'));
        d.setAutoPadding(false);
        const head = Buffer.concat([d.update(payload.subarray(0, 1024)), d.final()]);
        if (head[0] === 0xbe && head[1] === 0xed) {
          console.log(`MATCH: candidate=${c} derive=${name} iv="${ivStr}"`);
          process.exit(0);
        }
      } catch {}
    }
  }
}
console.log('no match among candidates');
