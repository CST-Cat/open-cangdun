// 抓取 vip题库 完整模块树（保留层级、含0题章节），输出 catalog_tree.json
import { createClient } from './cdky_client.mjs';
import { writeFileSync } from 'node:fs';

const c = await createClient();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import { readFileSync } from 'node:fs';
const cat = JSON.parse(readFileSync('/Users/cat/git-use/苍盾/data/cdtklist_full.json', 'utf8'));

const gname = {}; for (const t of cat.tikuLevel) gname[t.tlevel_id] = t.name;

// 递归抓子树
async function subtree(id, name, depth = 0) {
  const r = await c.call('apicdzz/zhangjie', { tlevel_id: String(id), ptiku_id: '' });
  await sleep(160);
  if (r.code !== 0) return { id: String(id), name, count: null, children: null, err: r.code };
  const kids = r.list ?? [];
  if (!kids.length) return { id: String(id), name, count: r.totalCount ?? 0, children: null };
  const children = [];
  for (const k of kids) {
    children.push(await subtree(k.tlevel_id, (k.name ?? '').trim(), depth + 1));
  }
  return { id: String(id), name, count: null, children };
}

const modules = [];
for (const t of cat.tikuLevel) {
  const mid = String(t.tlevel_id);
  const item = { module: t.name, module_id: mid, item: t.tiku_item, tikus: [] };
  // 组内题库
  const group = cat.banbenLevel_pid?.[mid] ?? [];
  for (const tk of group) {
    process.stdout.write(`  ${t.name} / ${tk.name}\n`);
    // 题库根的科目/章节树：优先 childDetail（cdtklist 已给一层），再递归
    const top = cat.childDetail?.[String(tk.tlevel_id)] ?? [];
    let node;
    if (top.length) {
      node = { id: String(tk.tlevel_id), name: tk.name, count: null, children: [] };
      for (const ch of top) node.children.push(await subtree(ch.tlevel_id, ch.name));
    } else {
      node = await subtree(tk.tlevel_id, tk.name);
    }
    item.tikus.push(node);
    await sleep(120);
  }
  // 无 banben 组的模块（智能错题/我的笔记/收藏/搜题）：直接递归模块根
  if (!group.length) {
    process.stdout.write(`  ${t.name} (直挂)\n`);
    item.tikus.push(await subtree(mid, t.name));
  }
  modules.push(item);
  writeFileSync('/Users/cat/git-use/苍盾/data/catalog_tree.json', JSON.stringify(modules, null, 1));
}
console.log('=== vip 模块树完成:', modules.length, '个模块 ===');
