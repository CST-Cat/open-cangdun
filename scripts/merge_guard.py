#!/usr/bin/env python3
# 合并防御：刷新完成后执行
# 原则：公共题目内容以云端为准；但云端"变空/失败"的章节不丢本地数据（标记 stale 保留）
# 基线 = git HEAD 里的旧 questions.jsonl
import json, subprocess, os

BASE = '/Users/cat/git-use/苍盾'

def load_jsonl(text):
    out = {}
    for line in text.split('\n'):
        if line.strip():
            r = json.loads(line)
            out[str(r['tlevel_id'])] = r
    return out

# 旧版（git HEAD）
old_text = subprocess.run(
    ['git', 'show', 'HEAD:data/questions.jsonl'],
    cwd=BASE, capture_output=True, text=True).stdout
old = load_jsonl(old_text) if old_text else {}
print(f'基线(git HEAD): {len(old)} 章')

# 新版（刷新后）
new = load_jsonl(open(f'{BASE}/data/questions.jsonl').read())
print(f'刷新后: {len(new)} 章')

restored = kept_cloud = empty_new = 0
for cid, rec in new.items():
    o = old.get(cid)
    qn = rec.get('questionCount', 0)
    has_qs = bool(rec.get('timuInfo'))
    if has_qs:
        kept_cloud += 1
        continue
    # 云端空/失败：本地旧数据有题 → 恢复并标记 stale
    if o and o.get('timuInfo'):
        rec['timuInfo'] = o['timuInfo']
        rec['questionCount'] = o.get('questionCount', len(o['timuInfo']))
        rec['stale'] = True
        restored += 1
    else:
        empty_new += 1

print(f'云端有效: {kept_cloud}, 从本地恢复(stale): {restored}, 本来就空: {empty_new}')

with open(f'{BASE}/data/questions.jsonl', 'w') as f:
    for rec in new.values():
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')
print('questions.jsonl 合并防御完成')
