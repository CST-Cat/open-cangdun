#!/usr/bin/env python3
# 恢复完成后执行：把 questions.jsonl 的 pdatiDetail 回填进
# data/cangdun.db 和 app/assets/bank/bank.db 的 chapter.pdati_detail
import json, sqlite3, os

BASE = '/Users/cat/git-use/苍盾'
stats = {}
for line in open(f'{BASE}/data/questions.jsonl'):
    if not line.strip():
        continue
    r = json.loads(line)
    d = r.get('pdatiDetail')
    if d:
        stats[str(r['tlevel_id'])] = json.dumps(d, ensure_ascii=False)
print(f'jsonl 中含答题统计的章节: {len(stats)}')

for db_path in [f'{BASE}/data/cangdun.db', f'{BASE}/app/assets/bank/bank.db']:
    con = sqlite3.connect(db_path)
    cols = [c[1] for c in con.execute('PRAGMA table_info(chapter)')]
    if 'pdati_detail' not in cols:
        con.execute('ALTER TABLE chapter ADD COLUMN pdati_detail TEXT')
    n = 0
    for tid, js in stats.items():
        con.execute('UPDATE chapter SET pdati_detail = ? WHERE tlevel_id = ?', (js, tid))
        n += 1
    con.commit()
    have = con.execute('SELECT COUNT(*) FROM chapter WHERE pdati_detail IS NOT NULL').fetchone()[0]
    print(f'{os.path.basename(db_path)}: 回填 {n} 章, 表中 {have} 章有值')
    con.close()
