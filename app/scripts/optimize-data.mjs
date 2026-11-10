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

// ---------- 1b. 四大分区（与原小程序一一对应） ----------
// catalog 键 = 题库书唯一键；重名版本键带 ｜模块 后缀（仅索引用，展示名由 name 提供）
const chmeta = parseJSONP(catSrc, 'window.CHMETA=')
const keyModule = {} // 键 -> 所属模块
const keySeries = {} // 键 -> 冲刺模拟系列（27版/26版押题库），非冲刺为 null
for (const [k, groups] of Object.entries(catalog)) {
  const id = Object.values(groups)[0][0].id
  const meta = chmeta[id] ?? {}
  keyModule[k] = meta.m ?? '(精选题库)'
  const p = meta.p ?? []
  keySeries[k] = p[1] === '冲刺模拟' ? (p[2] ?? '冲刺模拟') : null
}
const book = (k) => ({ name: k.includes('｜') ? k.split('｜')[0] : k, tiku: k })
const booksOfModule = (mod) =>
  Object.keys(catalog).filter((k) => keyModule[k] === mod).map(book)
const booksOfSeries = (series) =>
  Object.keys(catalog).filter((k) => keySeries[k] === series).map(book)
const has = (n) => (catalog[n] ? { name: n, tiku: n } : null)

const sections = {
  // 强化题库：小程序·强化页 10 大系列
  qianghua: [
    '27余峰500题', '27腿姐刷题计划', '27杨攀660题', '27苏一300题',
    '27米鹏1000题', '27徐涛优题库-基础题', '27徐涛优题库-拔高题',
    '27米鹏大李子720题', '27版肖1000题', '27苏一800题',
  ].map(has).filter(Boolean),
  // 冲刺模拟：27版 + 26版 押题库
  chongci: [
    { group: '27版冲刺押题库（不断更新）', books: booksOfSeries('27版冲刺押题库（不断更新）') },
    { group: '26版冲刺押题库', books: booksOfSeries('26版冲刺押题库') },
  ].filter((g) => g.books.length > 0),
  jingxuan: [
    has('27肖秀荣1600题') && { name: '精选1600题（2027版）', tiku: '27肖秀荣1600题' },
    catalog['精选1600题(2026)'] && { name: '精选1600题（2026版）', tiku: '精选1600题(2026)' },
    catalog['精选1600题(2024)'] && { name: '精选1600题（2024版）', tiku: '精选1600题(2024)' },
    has('27肖秀荣600题') && { name: '二刷600题（2027版）', tiku: '27肖秀荣600题' },
    catalog['二刷600题(2026)'] && { name: '二刷600题（2026版）', tiku: '二刷600题(2026)' },
    has('真题刷题') && { name: '真题刷题', tiku: '真题刷题' },
    has('冲刺300题') && { name: '冲刺300题', tiku: '冲刺300题' },
    has('每日刷题') && { name: '每日刷题', tiku: '每日刷题' },
    has('时政题库') && { name: '时政刷题', tiku: '时政题库' },
  ].filter(Boolean),
  // VIP 题库：小程序「专题模块」12 入口一一对应
  zhuanti: [
    { name: '组合刷题', multi: booksOfModule('组合刷题') },
    { name: '帽子题●强化', multi: booksOfModule('帽子题●强化') },
    { name: '帽子题●冲刺', multi: booksOfModule('帽子题●冲刺') },
    { name: '速刷版●强化', multi: booksOfModule('速刷版●强化') },
    { name: '速刷版●冲刺', multi: booksOfModule('速刷版●冲刺') },
    { name: '时政●冲刺', multi: booksOfModule('时政●冲刺') },
    { name: '考点刷题', multi: booksOfModule('考点刷题') },
    { name: '智能错题', href: '/wrong' },
    { name: '考点整理', href: '/kd' },
    { name: '搜题（考点）', href: '/kd' },
  ].filter((e) => !('multi' in e) || e.multi.length > 0),
}
write('sections.json', JSON.stringify(sections))

const secTotal = sections.qianghua.length + sections.chongci.reduce((n, g) => n + g.books.length, 0) + sections.jingxuan.length + sections.zhuanti.length
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
