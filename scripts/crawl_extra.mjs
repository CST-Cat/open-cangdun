// 补全爬虫：考点内容(kdcontent) + 题目配图下载
import { createClient } from './cdky_client.mjs';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';

const DATA = '/Users/cat/git-use/苍盾/data';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. 收集所有 kaodian_level_id ----------
const kdIds = new Map(); // id -> text
for (const line of readFileSync(`${DATA}/questions.jsonl`, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  for (const q of JSON.parse(line).timuInfo) {
    if (q.kaodian_level_id) kdIds.set(String(q.kaodian_level_id), q.kaodian_level_text ?? '');
  }
}
// kaodianChild 树顶层
const cat = JSON.parse(readFileSync(`${DATA}/cdtklist_full.json`, 'utf8'));
for (const [pid, arr] of Object.entries(cat.kaodianChild ?? {})) {
  for (const t of arr) kdIds.set(String(t.kaodian_level_id), t.title ?? '');
}
console.log(`考点数: ${kdIds.size}`);

// ---------- 2. 拉考点内容 ----------
const c = await createClient();
const out = `${DATA}/kaodian_content.jsonl`;
const have = new Set();
if (existsSync(out)) {
  for (const line of readFileSync(out, 'utf8').split('\n')) {
    if (line.trim()) { try { have.add(JSON.parse(line).kaodian_level_id); } catch {} }
  }
}
console.log(`已有考点内容: ${have.size}`);
let n = 0;
for (const [id, text] of kdIds) {
  if (have.has(id)) continue;
  n++;
  const r = await c.call('apicdvip/kdcontent', { kaodian_level_id: id });
  if (r.code === 0) {
    appendFileSync(out, JSON.stringify({ kaodian_level_id: id, kaodian_level_text: text, kaodian_content: r.kaodian_content ?? '' }) + '\n');
    if (n % 25 === 0) console.log(`  [${n}] ${id} ${text} -> ${(r.kaodian_content ?? '').length}字`);
  } else {
    console.log(`  ⚠️ kdcontent(${id}) code=${r.code}`);
  }
  await sleep(180);
}
console.log('考点内容完成');

// ---------- 3. 下载题目配图 ----------
const imgs = new Set();
for (const line of readFileSync(`${DATA}/questions.jsonl`, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  for (const q of r.timuInfo) {
    const blob = (q.title ?? '') + (q.jiexi ?? '') + JSON.stringify(q.xuanxiang ?? {});
    for (const m of blob.matchAll(/https:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp)/g)) imgs.add(m[0]);
  }
}
console.log(`图片数: ${imgs.size}`);
mkdirSync(`${DATA}/images`, { recursive: true });
let dl = 0;
for (const url of imgs) {
  const name = url.split('/').pop().split('?')[0];
  const dest = `${DATA}/images/${name}`;
  if (existsSync(dest)) continue;
  try {
    execSync(`curl -s --max-time 20 -o "${dest}" "${url}"`, { stdio: 'ignore' });
    dl++;
    if (dl % 20 === 0) console.log(`  图片 ${dl}/${imgs.size}`);
  } catch { console.log('  ⚠️ 图片失败', url); }
  await sleep(120);
}
console.log(`✅ 补全完成: 图片 ${dl} 张新下载`);
