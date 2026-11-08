// Extract files from a (decrypted) wxapkg
// Usage: node extract_wxapkg.mjs <input.wxapkg> <outDir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const [input, outDir] = process.argv.slice(2);
const buf = readFileSync(input);

if (buf[0] !== 0xbe || buf[13] !== 0xed) {
  console.error('bad wxapkg header');
  process.exit(1);
}
const indexLen = buf.readUInt32BE(5);
const fileCount = buf.readUInt32BE(14);
let p = 18;
const files = [];
for (let i = 0; i < fileCount; i++) {
  const nameLen = buf.readUInt32BE(p); p += 4;
  const name = buf.subarray(p, p + nameLen).toString('utf8'); p += nameLen;
  const offset = buf.readUInt32BE(p); p += 4;
  const size = buf.readUInt32BE(p); p += 4;
  files.push([name, offset, size]);
}
const out = resolve(outDir);
for (const [name, offset, size] of files) {
  const dest = join(out, name.replace(/^\//, ''));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf.subarray(offset, offset + size));
}
console.log(`${input}: extracted ${files.length} files -> ${out}`);
files.forEach(([n, , s]) => console.log(`  ${s.toString().padStart(8)}  ${n}`));
