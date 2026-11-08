// 恢复 questions.jsonl 的 pdatiDetail（个人答题统计）+ 回填 SQLite chapter 表
// 逐章调 timudetail 取最新 pdatiDetail，合并回 jsonl
import { createClient } from './cdky_client.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = '/Users/cat/git-use/苍盾/data';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = await createClient();

const lines = readFileSync(`${DATA}/questions.jsonl`, 'utf8').split('\n').filter((l) => l.trim());
const recs = lines.map((l) => JSON.parse(l));
console.log(`章节总数: ${recs.length}`);

let done = 0, restored = 0, empty = 0;
for (const rec of recs) {
  const r = await c.call('apicdzz/timudetail', { tlevel_id: String(rec.tlevel_id), p_level_id: '' });
  if (r.code === 0) {
    rec.pdatiDetail = r.detail?.pdatiDetail ?? null;
    if (rec.pdatiDetail) restored++; else empty++;
  } else {
    rec.pdatiDetail = rec.pdatiDetail ?? null;
    console.log(`  ⚠️ ${rec.tlevel_id} code=${r.code}`);
  }
  done++;
  if (done % 100 === 0) {
    writeFileSync(`${DATA}/questions.jsonl`, recs.map((x) => JSON.stringify(x)).join('\n') + '\n');
    console.log(`  [${done}/${recs.length}] 已恢复 ${restored} 章的答题统计`);
  }
  await sleep(170);
}
writeFileSync(`${DATA}/questions.jsonl`, recs.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.log(`✅ 完成: ${restored} 章有答题统计, ${empty} 章未做过题(空)`);
