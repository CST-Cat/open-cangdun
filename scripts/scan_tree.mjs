// 扫描 tlevel_id 区间，用 zhangjie 映射树节点（有子节点=科目/根，无子节点=章节）
import { createClient } from './cdky_client.mjs';
import { writeFileSync } from 'node:fs';

const [startStr, endStr] = process.argv.slice(2);
const start = parseInt(startStr), end = parseInt(endStr);
const c = await createClient();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const nodes = {};
for (let id = start; id <= end; id++) {
  const r = await c.call('apicdzz/zhangjie', { tlevel_id: String(id), ptiku_id: '' });
  if (r.code === 0) {
    const children = (r.list ?? []).map((x) => ({ id: x.tlevel_id, name: (x.name ?? '').trim(), count: x.timu_count }));
    nodes[id] = {
      id: String(id),
      children,
      totalCount: r.totalCount,
      studyCount: r.studyCount,
      percent: r.percent,
      tiku: r.tiku,
      sample: children.slice(0, 3).map((x) => x.name).join(' / '),
    };
    console.log(String(id).padEnd(6), children.length ? `📁 ${children.length}子节点 | ${nodes[id].sample}` : `📄 叶子 | total=${r.totalCount}`);
  }
  await sleep(200);
}
writeFileSync(`/Users/cat/git-use/苍盾/data/scan_${start}_${end}.json`, JSON.stringify(nodes, null, 1));
console.log(`\n完成: ${Object.keys(nodes).length} 个有效节点 -> data/scan_${start}_${end}.json`);
