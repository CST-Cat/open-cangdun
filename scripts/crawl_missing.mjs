// 终极补全爬虫：从根1(精选题库)全量BFS + 每日/时政/冲刺300 + 考点刷题
// 章节按 tlevel_id 去重，题目落 questions.jsonl（build_db 再按 timu_id 去重）
import { createClient } from './cdky_client.mjs';
import { writeFileSync, appendFileSync, existsSync, readFileSync } from 'node:fs';

const DATA = '/Users/cat/git-use/苍盾/data';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = await createClient();

// 已覆盖的章节 id（避免重复拉题目）
const doneChapters = new Set();
for (const line of readFileSync(`${DATA}/questions.jsonl`, 'utf8').split('\n')) {
  if (line.trim()) { try { doneChapters.add(String(JSON.parse(line).tlevel_id)); } catch {} }
}
console.log(`已有章节: ${doneChapters.size}`);

// 已知的树节点（tree.json）——避免重复 BFS 整棵老树
const knownNodes = new Set();
try {
  for (const n of JSON.parse(readFileSync(`${DATA}/tree.json`, 'utf8'))) knownNodes.add(String(n.id));
} catch {}
console.log(`已知树节点: ${knownNodes.size}`);

const roots = [
  ['1', '精选题库(根)'],
  ['4909', '冲刺300题'], ['4910', '每日刷题'], ['4911', '时政题库'],
  ['4712', '考点刷题·马原'], ['4717', '考点刷题·毛中特'], ['4718', '考点刷题·史纲'], ['4719', '考点刷题·思修'], ['4720', '考点刷题·新思想'],
];

const newChapters = [];
const tree = [];
const seen = new Set();
let newTreeNodes = 0;

async function bfs(rootId, rootName) {
  const queue = [{ id: String(rootId), path: [rootName] }];
  while (queue.length) {
    const node = queue.shift();
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    const r = await c.call('apicdzz/zhangjie', { tlevel_id: node.id, ptiku_id: '' });
    if (r.code !== 0) { console.log(`  ⚠️ zhangjie(${node.id}) code=${r.code}`); continue; }
    const kids = r.list ?? [];
    if (!knownNodes.has(node.id)) newTreeNodes++;
    tree.push({ id: node.id, path: node.path, name: node.path[node.path.length - 1], children: kids.map((k) => ({ id: k.tlevel_id, name: (k.name ?? '').trim(), count: k.timu_count })), totalCount: r.totalCount });
    if (kids.length === 0) {
      if (!doneChapters.has(node.id)) newChapters.push(node);
    } else {
      for (const k of kids) queue.push({ id: String(k.tlevel_id), path: [...node.path, (k.name ?? '').trim()] });
    }
    await sleep(170);
  }
}

for (const [id, name] of roots) {
  console.log(`BFS ${id} ${name} ...`);
  await bfs(id, name);
}
console.log(`\n新发现树节点: ${newTreeNodes}, 新章节: ${newChapters.length}`);
if (newChapters.length) console.log('新章节预览:', newChapters.slice(0, 10).map((n) => n.path.join('/')).join('\n  '));

// 拉新章节题目
let n = 0;
for (const node of newChapters) {
  n++;
  const r = await c.call('apicdzz/timudetail', { tlevel_id: node.id, p_level_id: '' });
  if (r.code === 0 && r.detail?.timuInfo) {
    appendFileSync(`${DATA}/questions.jsonl`, JSON.stringify({
      tlevel_id: node.id, path: node.path, name: node.path[node.path.length - 1],
      questionCount: r.detail.timuInfo.length, pdatiDetail: r.detail.pdatiDetail ?? null, timuInfo: r.detail.timuInfo,
    }) + '\n');
    if (n % 25 === 0) console.log(`  [${n}/${newChapters.length}] ${node.path.join('/')} -> ${r.detail.timuInfo.length}题`);
  } else {
    console.log(`  ⚠️ timudetail(${node.id}) code=${r.code} ${node.path.join('/')}`);
  }
  await sleep(170);
}

writeFileSync(`${DATA}/tree_extra.json`, JSON.stringify(tree, null, 1));
console.log(`\n✅ 补抓完成: 新章节 ${newChapters.length}`);
