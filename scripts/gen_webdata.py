#!/usr/bin/env python3
# 生成网页三件套的数据：catalog.js + 分章 chunk js + kaodian.js + 图片
# JSONP 风格（window.BANK[...]=...）→ file:// 双击可用，无需本地服务器
import json, sqlite3, re, os, shutil

BASE = '/Users/cat/git-use/苍盾'
WEB = f'{BASE}/webapp'
os.makedirs(f'{WEB}/data/ch', exist_ok=True)
os.makedirs(f'{WEB}/assets/images', exist_ok=True)

con = sqlite3.connect(f'{BASE}/data/cangdun.db')
con.row_factory = sqlite3.Row

# ---------- 图片本地映射 ----------
img_map = {}
for f in os.listdir(f'{BASE}/data/images'):
    img_map[f] = f  # name -> name
def rewrite_img(html):
    if not html:
        return ''
    # OSS URL -> 本地相对路径
    return re.sub(
        r'https://cangdun\.oss[^"\'\s<>]+\.(png|jpg|jpeg|gif|webp)',
        lambda m: 'assets/images/' + m.group(0).split('/')[-1],
        html)

# ---------- catalog：模块→题库→科目→章节 四层（与小程序 vip 题库一一对应）----------
mod_map = json.load(open(f'{BASE}/data/catalog_module.json'))
catalog = {}   # module -> tiku -> subject -> [chapters]
rows = con.execute('''
  SELECT tlevel_id, path, tiku_name, subject, name, question_count, pdati_detail
  FROM chapter WHERE question_count > 0 ORDER BY path
''').fetchall()
ch_meta = {}
for r in rows:
    cid = r['tlevel_id']
    m = mod_map.get(cid) or {}
    module = m.get('module') or '(精选题库)'
    tiku = r['tiku_name'] or m.get('tiku') or '(未分组)'
    subj = r['subject'] or '(全部)'
    catalog.setdefault(module, {}).setdefault(tiku, {}).setdefault(subj, []).append(
        {'id': cid, 'n': r['name'], 'c': r['question_count']})
    ch_meta[cid] = {'p': r['path'], 'pdati': r['pdati_detail'], 'm': module}

with open(f'{WEB}/data/catalog.js', 'w') as f:
    f.write('window.CATALOG=')
    json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\nwindow.CHMETA=')
    json.dump(ch_meta, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('catalog.js 完成:', len(catalog), '个题库,', len(rows), '个章节')

# ---------- 分章 chunks ----------
n = 0
total = 0
for r in rows:
    cid = r['tlevel_id']
    qs = con.execute('''
      SELECT timu_id, type, title, options_json, answer, jiexi,
             kaodian_id, kaodian_text, right_num, total_num
      FROM question WHERE chapter_id = ?
      ORDER BY CAST(num AS INTEGER), CAST(timu_id AS INTEGER)
    ''', (cid,)).fetchall()
    arr = []
    for q in qs:
        try:
            opts = json.loads(q['options_json'] or '{}')
        except Exception:
            opts = {}
        arr.append({
            'i': q['timu_id'],
            't': q['type'],
            'q': rewrite_img(q['title']),
            'o': opts,
            'a': q['answer'],
            'j': rewrite_img(q['jiexi']),
            'k': q['kaodian_text'] or '',
            'kid': q['kaodian_id'] or '',
            'r': int(q['right_num'] or 0),
            'tot': int(q['total_num'] or 0),
        })
    payload = {'n': r['name'], 'qs': arr}
    js = 'window.BANK=window.BANK||{};window.BANK["%s"]=%s;\n' % (cid, json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    with open(f'{WEB}/data/ch/{cid}.js', 'w') as f:
        f.write(js)
    total += len(js)
    n += 1
print(f'分章 chunks: {n} 个, 共 {total//1024//1024}MB')

# ---------- kaodian ----------
kd = con.execute('SELECT kaodian_level_id, title, content_html FROM kaodian').fetchall()
kd_map = {str(r['kaodian_level_id']): {'t': r['title'], 'h': rewrite_img(r['content_html'])} for r in kd}
with open(f'{WEB}/data/kaodian.js', 'w') as f:
    f.write('window.KAODIAN=')
    json.dump(kd_map, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('kaodian.js 完成:', len(kd_map))

# ---------- 图片 ----------
cnt = 0
for f in os.listdir(f'{BASE}/data/images'):
    shutil.copy(f'{BASE}/data/images/{f}', f'{WEB}/assets/images/{f}')
    cnt += 1
print('图片:', cnt)
con.close()
