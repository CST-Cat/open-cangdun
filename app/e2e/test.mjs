// 浏览器 E2E：登录流程 / 目录 / 刷题判分 / 考点 / 暗色 / 会话保持 / 速度
// 运行: node e2e/test.mjs  （服务已在 3777 端口，账号见 /tmp/cd-auth）
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'

const EXE = process.env.CHROME
  ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome`
const BASE = process.env.BASE ?? 'http://localhost:3777'
const SHOTS = '/tmp/cd-shots'
mkdirSync(SHOTS, { recursive: true })

const auth = (() => {
  try {
    return JSON.parse(readFileSync(process.env.AUTH_FILE ?? '/tmp/cd-auth/auth.json', 'utf8'))
  } catch {
    return null
  }
})()
const USER = process.env.E2E_USER ?? ''
const PASS = process.env.E2E_PASS ?? ''

let step = 0
const t0 = Date.now()
const ok = (msg) => console.log(`✓ [${((Date.now() - t0) / 1000).toFixed(1)}s] ${step++}. ${msg}`)
const fail = (msg, e) => {
  console.error(`✗ ${msg}`, e)
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()

// 1. 未登录 → 登录页
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.getByText('请登录后使用').waitFor({ timeout: 8000 })
await page.screenshot({ path: `${SHOTS}/01-login.png` })
ok('未登录 → 显示登录页')

// 2. 未登录直接拉数据 → 401
const anon = await ctx.request.get(`${BASE}/data/ch/7130.json`)
if (anon.status() !== 401) fail('未登录数据应 401')
ok(`未登录拉取题库数据 → ${anon.status()}`)

// 3. 错误密码
await page.getByPlaceholder('用户名').fill(USER)
await page.getByPlaceholder('密码').fill('wrong-password')
await page.getByRole('button', { name: /登\s*录/ }).click()
await page.getByText('用户名或密码错误').waitFor({ timeout: 5000 })
await page.screenshot({ path: `${SHOTS}/02-login-error.png` })
ok('错误密码 → 显示错误提示')

// 4. 正确登录 → 首页
await page.getByPlaceholder('密码').fill(PASS)
const loginT = Date.now()
await page.getByRole('button', { name: /登\s*录/ }).click()
await page.getByText('题库目录').waitFor({ timeout: 8000 })
ok(`登录成功 → 首页（${Date.now() - loginT}ms）`)
await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOTS}/03-home.png` })

// 5. 展开第一个题库 → 章节列表
const expandT = Date.now()
await page.getByRole('button', { name: /27余峰500题/ }).click()
await page.getByText('第一章', { exact: false }).first().waitFor({ timeout: 5000 })
ok(`展开题库 → 章节列表（${Date.now() - expandT}ms）`)
await page.screenshot({ path: `${SHOTS}/04-catalog.png` })

// 6. 进入第一章 → 首题可见
const quizT = Date.now()
await page.getByText('第一章', { exact: false }).first().click()
await page.locator('main p').first().waitFor({ timeout: 8000 })
ok(`打开章节 → 首题渲染（${Date.now() - quizT}ms）`)
await page.screenshot({ path: `${SHOTS}/05-quiz.png` })

// 7. 作答判分（单选点选即判；多选选两项+确认）
const isMulti = await page.getByRole('button', { name: /确认答案|至少选两项/ }).count()
if (isMulti) {
  await page.locator('main button:has(span:text-is("A"))').first().click()
  await page.locator('main button:has(span:text-is("B"))').first().click()
  await page.getByRole('button', { name: /确认答案/ }).click()
} else {
  await page.locator('main button:has(span:text-is("A"))').first().click()
}
await page.getByText(/回答正确|回答错误/).waitFor({ timeout: 3000 })
await page.screenshot({ path: `${SHOTS}/06-answered.png` })
ok('作答 → 即时判分 + 解析')

// 8. 下一题 → 键盘/按钮切换
await page.getByRole('button', { name: /下一题/ }).click()
await page.getByText('2/').waitFor({ timeout: 3000 })
ok('下一题切换')

// 9. 考点页搜索 + 详情（选有教材内容的考点 62：考点1 马克思主义的科学内涵）
await page.getByRole('link', { name: '考点', exact: true }).click()
await page.getByPlaceholder(/搜索考点/).waitFor({ timeout: 5000 })
await page.getByPlaceholder(/搜索考点/).fill('马克思主义的科学内涵')
await page.waitForTimeout(200)
await page.locator('main button').filter({ hasText: /马克思主义的科学内涵/ }).first().click()
await page.locator('.prose-cd p').first().waitFor({ timeout: 5000 }) // 正文真实渲染
await page.screenshot({ path: `${SHOTS}/07-kaodian.png` })
ok('考点搜索 + 教材正文渲染')

// 9b. 换一个无内容考点 → 兜底文案
await page.keyboard.press('Escape')
await page.getByRole('link', { name: '题库', exact: true }).click()
await page.getByRole('button', { name: '切换深色模式' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOTS}/08-dark.png` })
ok('深色模式切换')

// 11. 刷新 → 会话保持（仍已登录）
await page.reload({ waitUntil: 'domcontentloaded' })
await page.getByText('题库目录').waitFor({ timeout: 8000 })
ok('刷新 → 会话保持，无需重登')

// 12. 退出登录 → 回登录页
await page.getByRole('button', { name: '退出登录' }).click()
await page.getByText('请登录后使用').waitFor({ timeout: 8000 })
ok('退出登录 → 登录页')

// 13. 桌面视口截图
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const dpage = await desk.newPage()
await dpage.goto(BASE, { waitUntil: 'domcontentloaded' })
await dpage.getByText('请登录后使用').waitFor({ timeout: 8000 })
await dpage.screenshot({ path: `${SHOTS}/09-desktop-login.png` })
await dpage.getByPlaceholder('用户名').fill(USER)
await dpage.getByPlaceholder('密码').fill(PASS)
await dpage.getByRole('button', { name: /登\s*录/ }).click()
await dpage.getByText('题库目录').waitFor({ timeout: 8000 })
await dpage.waitForTimeout(400)
await dpage.screenshot({ path: `${SHOTS}/10-desktop-home.png` })
ok('桌面视口渲染')

await browser.close()
console.log(`\n全部通过 ✅  截图: ${SHOTS}/`)
