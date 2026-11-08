// 苍盾题库全量爬虫：BFS 题库树 -> 每个章节 timudetail 拉全部题目（含答案/解析）
import { createClient } from './cdky_client.mjs';
import { writeFileSync, appendFileSync, existsSync, readFileSync } from 'node:fs';

const DATA = '/Users/cat/git-use/苍盾/data';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. 汇总所有题库根 ----------
const cat = JSON.parse(readFileSync(`${DATA}/cdtklist_full.json`, 'utf8'));
const rootMeta = new Map(); // id -> {name, source}
const add = (id, name, src) => {
  if (id && !rootMeta.has(String(id))) rootMeta.set(String(id), { name: name ?? '', source: src });
};

// 27余峰500题 + 官方题库（zzhome/jinxuanhome 里的）
add('7116', '27余峰500题', 'manual');
add('6608', '27肖秀荣1600题', 'manual');
add('6609', '27肖秀荣600题', 'manual');
add('4909', '冲刺300题', 'manual');
add('4910', '每日刷题', 'manual');
add('4911', '时政题库', 'manual');

// cdtklist: 版本组下的题库根
for (const [pid, arr] of Object.entries(cat.banbenLevel_pid ?? {})) {
  for (const t of arr) add(t.tlevel_id, t.name, `banben:${pid}`);
}
// 考点刷题树顶层（4712马原... 及其子节点是章节）
for (const [pid, arr] of Object.entries(cat.childDetail ?? {})) {
  for (const t of arr) add(t.tlevel_id, t.name, `childDetail:${pid}`);
}
// 组合刷题等
for (const t of cat.tikuLevel ?? []) add(t.tlevel_id, t.name, 'tikuLevel');

// 模拟卷根（7944-7957 套卷组）
for (const id of ['7944', '7945', '7946', '7947', '7948', '7949', '7950', '7951', '7952', '7953', '7954', '7955', '7956', '7957'])
  add(id, '套卷', 'manual-juan');

console.log(`题库根总数: ${rootMeta.size}`);

// ---------- 2. BFS 每个根，收集章节叶子 ----------
const c = await createClient();
const tree = [];       // 所有节点
const chapters = new Map(); // 叶子章节 id -> {path: [根, ...], name}
const visited = new Set();

async function bfs(rootId, rootName) {
  const queue = [{ id: String(rootId), path: [rootName], name: rootName }];
  while (queue.length) {
    const node = queue.shift();
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    const r = await c.call('apicdzz/zhangjie', { tlevel_id: node.id, ptiku_id: '' });
    if (r.code !== 0) {
      console.log(`  ⚠️ zhangjie(${node.id}) code=${r.code}`);
      continue;
    }
    const kids = r.list ?? [];
    tree.push({ ...node, children: kids.map((k) => ({ id: k.tlevel_id, name: (k.name ?? '').trim(), count: k.timu_count })), totalCount: r.totalCount });
    if (kids.length === 0) {
      chapters.set(node.id, node);
    } else {
      for (const k of kids) {
        queue.push({ id: String(k.tlevel_id), path: [...node.path, (k.name ?? '').trim()], name: (k.name ?? '').trim() });
      }
    }
    await sleep(180);
  }
}

let done = 0;
for (const [id, meta] of rootMeta) {
  done++;
  console.log(`[${done}/${rootMeta.size}] BFS ${id} ${meta.name}`);
  await bfs(id, meta.name);
  writeFileSync(`${DATA}/tree.json`, JSON.stringify(tree, null, 1));
  writeFileSync(`${DATA}/chapters.json`, JSON.stringify([...chapters.values()], null, 1));
}
console.log(`\n树节点: ${tree.length}, 章节叶子: ${chapters.size}`);

// ---------- 3. 每个章节拉题目 ----------
const OUT = `${DATA}/questions.jsonl`;
const seenChap = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { seenChap.add(JSON.parse(line).tlevel_id); } catch {}
  }
}
console.log(`断点续传: 已有 ${seenChap.size} 章`);

let n = 0;
for (const [cid, node] of chapters) {
  n++;
  if (seenChap.has(cid)) continue;
  const r = await c.call('apicdzz/timudetail', { tlevel_id: cid, p_level_id: '' });
  if (r.code === 0 && r.detail?.timuInfo) {
    const rec = {
      tlevel_id: cid,
      path: node.path,
      name: node.name,
      questionCount: r.detail.timuInfo.length,
      pdatiDetail: r.detail.pdatiDetail ?? null,
      timuInfo: r.detail.timuInfo,
    };
    appendFileSync(OUT, JSON.stringify(rec) + '\n');
    if (n % 20 === 0) console.log(`  [${n}] ${cid} ${node.path.join('/')} -> ${rec.questionCount}题`);
  } else {
    console.log(`  ⚠️ timudetail(${cid}) code=${r.code} ${node.path.join('/')}`);
    appendFileSync(`${DATA}/failed_chapters.jsonl`, JSON.stringify({ tlevel_id: cid, path: node.path, code: r.code, msg: r.msg }) + '\n');
  }
  await sleep(180);
}
console.log(`\n✅ 完成: 章节 ${chapters.size}, 输出 ${OUT}`);
