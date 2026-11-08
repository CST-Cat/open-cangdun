#!/usr/bin/env node
// 数据流水线：webapp/data JSONP → 纯 JSON 分片 + Brotli 预压缩 + 图片就位
// 用法: node scripts/optimize-data.mjs [dataDir] [--slim]
//   --slim（Docker 构建）: ch/kd 大文件只产出 .br（省 ~110MB），小文件保留 raw+.br
// 产物（public/data）:
//   tikus.json                 题库名索引（首屏 <1KB）
//   catalog/<i>.json           每题库 {科目: [{id,n,c}]}
//   ch/<id>.json               每章 {n, qs:[{i,t,q,o,a,j,k,kid,r,tot}]}
//   kd/index.json              考点索引 [{i,t}]
//   kd/<id>.json               考点 {t,h}
//   images/                    解析配图（引用路径 assets/images/* → /data/images/*）
import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants as brotliConstants } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(__dirname, '..')
const argPos = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const SLIM = process.argv.includes('--slim')
const dataDir = resolve(appDir, argPos[0] ?? '../webapp/data')
const outDir = join(appDir, 'public', 'data')

const BROTLI_OPTS = { params: { [brotliConstants.BROTLI_PARAM_QUALITY]: 5 } } // 小文件快速高压缩
// mode: 'raw+br'（默认，raw + .br 副本）| 'br-only'（slim 大文件）| 'raw-only'（webp 等已压缩格式）
const write = (rel, data, { mode = 'raw+br' } = {}) => {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const p = join(outDir, rel)
  mkdirSync(dirname(p), { recursive: true })
  if (mode !== 'br-only') writeFileSync(p, buf)
  if (mode !== 'raw-only') writeFileSync(p + '.br', brotliCompressSync(buf, BROTLI_OPTS))
}

// ---------- JSONP 解析 ----------
// 定位 marker 后的第一个 '{'，做括号配对扫描（跳过字符串）取完整 JSON
const parseJSONP = (s, startMarker) => {
  const i = s.indexOf(startMarker)
  if (i < 0) throw new Error(`missing ${startMarker}`)
  const start = s.indexOf('{', i)
  let depth = 0, inStr = false, esc = false
  for (let j = start; j < s.length; j++) {
    const c = s[j]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return JSON.parse(s.slice(start, j + 1))
    }
  }
  throw new Error(`unbalanced JSON after ${startMarker}`)
}

mkdirSync(outDir, { recursive: true })

// ---------- 1. 目录：按题库分片 ----------
const catSrc = readFileSync(join(dataDir, 'catalog.js'), 'utf8')
const catalog = parseJSONP(catSrc, 'window.CATALOG=')
const tikuNames = Object.keys(catalog)
write('tikus.json', JSON.stringify(tikuNames))
tikuNames.forEach((name, idx) => {
  const subjects = {}
  for (const [subj, chapters] of Object.entries(catalog[name])) {
    // 章节按 id 数值排序，保证目录与刷题顺序稳定
    subjects[subj] = chapters
      .slice()
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map(({ id, n, c }) => ({ id, n, c }))
  }
  write(`catalog/${idx}.json`, JSON.stringify(subjects))
})
const chapterCount = tikuNames.reduce(
  (acc, n) => acc + Object.values(catalog[n]).reduce((s, l) => s + l.length, 0), 0)
console.log(`目录: ${tikuNames.length} 题库 / ${chapterCount} 章节 → tikus.json + catalog/*.json`)

// ---------- 1b. 原版四大分区（强化题库/冲刺模拟/精选题库/专题模块） ----------
// 分组依据原小程序页面结构（data/qianghua_full.json、chongci_full.json、cdtklist_full.json）
const has = (n) => (catalog[n] ? { name: n, tiku: n } : null)
const pick = (...names) => names.map(has).filter(Boolean)
const sections = {
  qianghua: pick(
    '27余峰500题', '27腿姐刷题计划', '27杨攀660题', '27米鹏1000题',
    '27版肖1000', '27版徐涛优题库-基础题', '27版徐涛优题库-拔高题',
  ),
  chongci: [
    { group: '27版冲刺押题库（不断更新）', books: pick('27腿姐8套卷', '27版米鹏6套卷') },
  ].filter((g) => g.books.length > 0),
  jingxuan: [
    has('27肖秀荣1600题') && { name: '精选1600题', ...has('27肖秀荣1600题') },
    has('27肖秀荣600题') && { name: '二刷600题', ...has('27肖秀荣600题') },
    catalog['精选题库(根)']?.['真题刷题'] && { name: '真题刷题', tiku: '精选题库(根)', subject: '真题刷题' },
    { name: '真题（章节版）', multi: pick('马原', '毛中特', '史纲', '思修', '新思想') },
    has('冲刺300题') && { name: '冲刺300题', ...has('冲刺300题') },
    has('每日刷题') && { name: '每日刷题', ...has('每日刷题') },
    has('时政题库') && { name: '时政刷题', ...has('时政题库') },
    catalog['精选题库(根)']?.['名师题库'] && { name: '名师题库', tiku: '精选题库(根)', subject: '名师题库' },
    catalog['精选题库(根)']?.['冲刺模拟'] && { name: '冲刺模拟', tiku: '精选题库(根)', subject: '冲刺模拟' },
    catalog['精选题库(根)']?.['精选1600题(2024)'] && { name: '精选1600题（2024版）', tiku: '精选题库(根)', subject: '精选1600题(2024)' },
    catalog['精选题库(根)']?.['精选1600题(2026)'] && { name: '精选1600题（2026版）', tiku: '精选题库(根)', subject: '精选1600题(2026)' },
    catalog['精选题库(根)']?.['二刷600题(2026)'] && { name: '二刷600题（2026版）', tiku: '精选题库(根)', subject: '二刷600题(2026)' },
  ].filter(Boolean),
  zhuanti: [
    { name: '组合刷题', multi: pick('27听涛涛课刷肖1000', '27听腿姐课刷肖1000', '27张修齐肖1000重点题') },
    has('时政汇编') && { name: '时政●冲刺', ...has('时政汇编') },
    { name: '考点整理', href: '/kd' },
    { name: '考点刷题', href: '/kd' },
  ].filter((e) => !('multi' in e) || e.multi.length > 0),
}
write('sections.json', JSON.stringify(sections))
const secTotal = Object.values(sections).flat().length
console.log(`分区: 四大板块 ${secTotal} 个条目 → sections.json`)

// ---------- 2. 章节分片 → 纯 JSON ----------
const chDir = join(dataDir, 'ch')
const files = readdirSync(chDir).filter((f) => f.endsWith('.js'))
let qs = 0
for (const f of files) {
  const id = f.replace(/\.js$/, '')
  const chunk = parseJSONP(readFileSync(join(chDir, f), 'utf8'), `window.BANK["${id}"]=`)
  qs += chunk.qs.length
  write(`ch/${id}.json`, JSON.stringify(chunk), { mode: SLIM ? 'br-only' : 'raw+br' })
}
console.log(`章节: ${files.length} 个 → ch/*.json (${qs} 道题)`)

// ---------- 3. 考点：索引 + 详情分片 ----------
const kdSrc = readFileSync(join(dataDir, 'kaodian.js'), 'utf8')
const kaodian = parseJSONP(kdSrc, 'window.KAODIAN=')
const kdIndex = Object.entries(kaodian).map(([id, v]) => ({ i: id, t: v.t }))
write('kd/index.json', JSON.stringify(kdIndex))
for (const [id, v] of Object.entries(kaodian)) write(`kd/${id}.json`, JSON.stringify(v), { mode: SLIM ? 'br-only' : 'raw+br' })
console.log(`考点: ${kdIndex.length} 个 → kd/index.json + kd/*.json`)

// ---------- 4. 图片：PNG → 无损 WebP（体积 -40%+，全平台浏览器支持） ----------
const imgSrc = resolve(dataDir, '../assets/images')
if (existsSync(imgSrc)) {
  const { default: sharp } = await import('sharp')
  const imgOut = join(outDir, 'images')
  mkdirSync(imgOut, { recursive: true })
  const pngs = readdirSync(imgSrc).filter((f) => f.toLowerCase().endsWith('.png'))
  let before = 0
  let after = 0
  for (const f of pngs) {
    const srcBuf = readFileSync(join(imgSrc, f))
    before += srcBuf.length
    const webp = await sharp(srcBuf).webp({ lossless: true, effort: 4 }).toBuffer()
    after += webp.length
    // WebP 本身已压缩，不再生成 .br 副本
    write(`images/${f.replace(/\.png$/i, '.webp')}`, webp, { mode: 'raw-only' })
  }
  console.log(`图片: ${pngs.length} 张 PNG → WebP 无损，${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB`)
}

// ---------- 5. 体积报告 ----------
const dirSize = (dir) => {
  let s = 0
  for (const f of readdirSync(dir, { withFileTypes: true }))
    s += f.isDirectory() ? dirSize(join(dir, f.name)) : statSync(join(dir, f.name)).size
  return s
}
console.log(`产物总大小: ${(dirSize(outDir) / 1048576).toFixed(1)}MB（含 .br/.gz 副本）`)
