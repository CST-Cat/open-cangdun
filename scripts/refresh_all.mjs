// 全量刷新题目数据：timudetail 重抓所有章节（含题数变化与内容修订）
// 并把 vip 模块层级路径写入 path（模块/题库/科目/章节）
import { createClient } from './cdky_client.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = '/Users/cat/git-use/苍盾/data';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = await createClient();

// 1. 现有数据
const recs = new Map();
for (const line of readFileSync(`${DATA}/questions.jsonl`, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  recs.set(String(r.tlevel_id), r);
}
console.log('现有章节:', recs.size);

// 2. vip 树叶子路径
const tree = JSON.parse(readFileSync(`${DATA}/catalog_tree.json`, 'utf8'));
const treePath = new Map();
function walk(node, prefix) {
  const p = [...prefix, node.name];
  if (!node.children) {
    treePath.set(String(node.id), { path: p, count: node.count });
  } else {
    for (const k of node.children) walk(k, p);
  }
}
for (const mod of tree) {
  // 模块路径: [模块名, 题库名, ...]
  for (const tiku of mod.tikus) {
    walk(tiku, [mod.module, tiku.name]);
  }
}
console.log('vip树叶子:', treePath.size);

// 3. 树里有而库里没有的 → 新增
for (const [id, info] of treePath) {
  if (!recs.has(id)) {
    recs.set(id, { tlevel_id: id, path: info.path, name: info.path[info.path.length - 1], questionCount: info.count ?? 0, timuInfo: [] });
    console.log('  🆕 补录章节', id, info.path.join('/'));
  }
}

// 4. 全量重刷
let n = 0, changed = 0;
const total = recs.size;
for (const [id, rec] of recs) {
  n++;
  const r = await c.call('apicdzz/timudetail', { tlevel_id: id, p_level_id: '' }).catch(() => ({ code: -999 }));
  if (r.code === 0 && r.detail?.timuInfo) {
    const newCount = r.detail.timuInfo.length;
    if (rec.questionCount !== newCount) changed++;
    rec.questionCount = newCount;
    rec.timuInfo = r.detail.timuInfo;
    rec.pdatiDetail = r.detail.pdatiDetail ?? null;
    if (treePath.has(id)) {
      rec.path = treePath.get(id).path;
      rec.name = rec.path[rec.path.length - 1];
    }
  } else if (r.code === -11) {
    // token 已自动换过仍失败 → 记录
    console.log('  ⚠️', id, '失败');
  }
  if (n % 150 === 0) {
    writeFileSync(`${DATA}/questions.jsonl`, [...recs.values()].map((x) => JSON.stringify(x)).join('\n') + '\n');
    console.log(`  [${n}/${total}] 题数变化累计 ${changed}`);
  }
  await sleep(165);
}
writeFileSync(`${DATA}/questions.jsonl`, [...recs.values()].map((x) => JSON.stringify(x)).join('\n') + '\n');
console.log(`✅ 刷新完成: ${total} 章, 题数变化 ${changed}`);
