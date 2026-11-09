#!/usr/bin/env python3
# 把 questions.jsonl + tree.json + cdtklist 整理成 SQLite 供重构使用
import json, sqlite3, sys, re
from pathlib import Path

DATA = Path('/Users/cat/git-use/苍盾/data')
DB = DATA / 'cangdun.db'

def clean_html(s):
    if not s: return ''
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def main():
    con = sqlite3.connect(DB)
    cur = con.cursor()
    cur.executescript('''
    CREATE TABLE IF NOT EXISTS tiku (
        tlevel_id TEXT PRIMARY KEY, name TEXT, source TEXT
    );
    CREATE TABLE IF NOT EXISTS chapter (
        tlevel_id TEXT PRIMARY KEY,
        path TEXT,          -- 题库/科目/章节 路径
        tiku_name TEXT,
        subject TEXT,
        name TEXT,
        question_count INTEGER,
        module TEXT,
        pdati_detail TEXT
    );
    CREATE TABLE IF NOT EXISTS question (
        timu_id TEXT PRIMARY KEY,
        chapter_id TEXT,
        num TEXT,
        type TEXT,            -- 单选/多选/分析
        title TEXT,
        options_json TEXT,    -- {"A": "...", ...}
        answer TEXT,          -- right_text
        answer_list TEXT,     -- right 数组 json
        jiexi TEXT,           -- 解析HTML
        jiexi_text TEXT,
        chuchu TEXT,          -- 出处(题库名)
        kaodian_id TEXT,
        kaodian_text TEXT,    -- 考点
        top_kaodian_text TEXT,
        right_num TEXT, total_num TEXT,  -- 全站正确率
        tlevel_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_q_chapter ON question(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_q_kaodian ON question(kaodian_id);
    ''')

    # 题库目录
    cat = json.load(open(DATA / 'cdtklist_full.json'))
    seen_tiku = set()
    def add_tiku(tid, name, src):
        if str(tid) in seen_tiku or not tid: return
        seen_tiku.add(str(tid))
        cur.execute('INSERT OR REPLACE INTO tiku VALUES (?,?,?)', (str(tid), name, src))
    for pid, arr in (cat.get('banbenLevel_pid') or {}).items():
        add_tiku(pid, f'(版本组{pid})', 'banben')
        for t in arr: add_tiku(t['tlevel_id'], t['name'], 'banben')
    for t in cat.get('tikuLevel') or []: add_tiku(t['tlevel_id'], t['name'], 'tikuLevel')
    for pid, arr in (cat.get('childDetail') or {}).items():
        for t in arr: add_tiku(t['tlevel_id'], t['name'], 'childDetail')
    for tid, name in [('7116','27余峰500题'), ('6608','27肖秀荣1600题'), ('6609','27肖秀荣600题'),
                      ('4909','冲刺300题'), ('4910','每日刷题'), ('4911','时政题库')]:
        add_tiku(tid, name, 'manual')

    # 章节
    chapters = json.load(open(DATA / 'chapters.json'))
    for ch in chapters:
        path = ch['path']
        cur.execute('INSERT OR REPLACE INTO chapter VALUES (?,?,?,?,?,NULL,NULL,NULL)',
                    (str(ch['id']), ' / '.join(path), path[0] if path else '',
                     path[1] if len(path) > 1 else '', ch['name']))

    # 题目
    n = 0
    seen_q = set()
    if (DATA / 'questions.jsonl').exists():
        for line in open(DATA / 'questions.jsonl'):
            line = line.strip()
            if not line: continue
            rec = json.loads(line)
            cur.execute('INSERT OR REPLACE INTO chapter VALUES (?,?,?,?,?,?,?,?)',
                        (str(rec['tlevel_id']), ' / '.join(rec['path']), rec['path'][0] if rec['path'] else '',
                         rec['path'][1] if len(rec['path']) > 1 else '', rec['name'], rec['questionCount'],
                         rec.get('module'), json.dumps(rec.get('pdatiDetail'), ensure_ascii=False) if rec.get('pdatiDetail') else None))
            for q in rec['timuInfo']:
                if q['timu_id'] in seen_q: continue
                seen_q.add(q['timu_id'])
                cur.execute('INSERT OR REPLACE INTO question VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (
                    str(q['timu_id']), str(rec['tlevel_id']), q.get('num'), q.get('type'),
                    q.get('title'), json.dumps(q.get('xuanxiang') or {}, ensure_ascii=False),
                    q.get('right_text'), json.dumps(q.get('right') or [], ensure_ascii=False),
                    q.get('jiexi'), clean_html(q.get('jiexi')),
                    q.get('chuchu'), str(q.get('kaodian_level_id') or ''), q.get('kaodian_level_text'),
                    q.get('top_kaodian_text'), str(q.get('right_num') or ''), str(q.get('total_num') or ''),
                    str(rec['tlevel_id']),
                ))
                n += 1
    con.commit()
    # 统计
    for t in ['tiku', 'chapter', 'question']:
        cnt = cur.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]
        print(f'{t}: {cnt}')
    print('按题库统计:')
    for row in cur.execute('''SELECT c.tiku_name, COUNT(DISTINCT c.tlevel_id) ch, COUNT(q.timu_id) qs
                              FROM chapter c LEFT JOIN question q ON q.chapter_id=c.tlevel_id
                              GROUP BY c.tiku_name ORDER BY qs DESC LIMIT 30'''):
        print(f'  {row[0]}: {row[1]}章 {row[2]}题')
    con.close()

if __name__ == '__main__':
    main()
