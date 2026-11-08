#!/usr/bin/env node
// 按题库实际用字裁剪字体子集：Inter（拉丁/UI）+ Noto Sans SC（中文，保留 wght 变量轴）
// 用法: node scripts/subset-fonts.mjs [dataDir]  （dataDir 默认 ../webapp/data）
// 产物: public/fonts/*.woff2 + scripts/charset.txt（可复现）
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(__dirname, '..')
const dataDir = resolve(appDir, process.argv[2] ?? '../webapp/data')
const outDir = join(appDir, 'public', 'fonts')
mkdirSync(outDir, { recursive: true })

// ---------- 1. 收集题库实际用字 ----------
const chars = new Set()
const absorb = (buf) => {
  for (const ch of buf.toString('utf8')) chars.add(ch)
}

// 题库数据（JSONP 文本直接吸收，避免逐文件 JSON.parse 的开销）
absorb(readFileSync(join(dataDir, 'catalog.js')))
absorb(readFileSync(join(dataDir, 'kaodian.js')))
const chDir = join(dataDir, 'ch')
for (const f of readdirSync(chDir)) absorb(readFileSync(join(chDir, f)))

// UI 文案 + 标点符号安全集（数据之外界面可能出现）
const uiStrings = `
苍盾考研政治题库首页目录章节考点继续刷题开始学习答题正确率进度单选多选题解析下一题上一题
提交答案跳过收藏题号网格全部分类搜索重置已完成为正确错误正确答案你的答案全站统计人做过
道题共选中确认清除记录确定取消加载中失败重试暂时没有更多内容深色模式浅色背景字体大小
退出登录关于版本数据来源仅限学习交流使用齿轮设置图标菜单返回导航打开关闭侧边栏顶部
Question Bank Chapter Kaodian Quiz Answer Correct Wrong Submit Next Previous Progress
Score Accuracy Settings Search Results Empty Loading Retry Dark Light Mode Home
`
for (const ch of uiStrings) chars.add(ch)
// ASCII 可打印 + 常用中英标点与符号
for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCodePoint(c))
for (const ch of '\uff0c\u3002\u3001\uff1b\uff1a\uff1f\uff01\u201c\u201d\u2018\u2019\uff08\uff09\u300a\u300b\u3008\u3009\u3010\u3011\u3014\u3015\u2026\u2014\u00b7\uff5e\uffe5\uff05\u2103\u00b0\u00d7\u00f7\u00b1\u221a\u2605\u2606\u2713\u2717\u2192\u2190\u2191\u2193\u2460\u2461\u2462\u2463\u2464\u2465\u2466\u2467\u2468\u2469\u2160\u2161\u2162\u2163\u2164\u300c\u300d\u300e\u300f\u3016\u3017\uff3b\uff3d\uff5b\uff5d\uff01\uff1f\uff03\uff04\uff06\uff0a\uff0b\uff0d\uff0f\uff5c\uff5e') chars.add(ch)
chars.delete('\r'); chars.delete('\n'); chars.delete('\t')

const text = [...chars].sort().join('')
writeFileSync(join(__dirname, 'charset.txt'), text)
console.log(`字符集: ${chars.size} 个字符 (charset.txt 已保存)`)

// ---------- 2. 裁剪 ----------
// 中文：Noto Sans SC 可变字体（wght 100-900 全保留），17MB → 预计 ~2MB
const notoSrc = process.env.NOTO_SRC ?? '/tmp/NotoSansSC-var.ttf'
const notoOut = await subsetFont(readFileSync(notoSrc), text, {
  targetFormat: 'woff2',
})
writeFileSync(join(outDir, 'noto-sans-sc-var.subset.woff2'), notoOut)
console.log(`Noto Sans SC: ${(17.7).toFixed(1)}MB → ${(notoOut.length / 1024 / 1024).toFixed(2)}MB`)

// 拉丁/UI：Inter 可变字体（wght）
const interSrc = resolve(appDir, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')
const interOut = await subsetFont(readFileSync(interSrc), text, {
  targetFormat: 'woff2',
})
writeFileSync(join(outDir, 'inter-var.subset.woff2'), interOut)
console.log(`Inter: 48KB → ${(interOut.length / 1024).toFixed(1)}KB`)
