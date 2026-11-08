// 浏览器 E2E：登录 / 四大分区 / 章节滚动完整性 / 刷题判分 / 考点 / 暗色 / 会话
import { chromium } from 'playwright-core'

const EXE = process.env.CHROME
  ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome`
const BASE = process.env.BASE ?? 'http://localhost:3777'
const SHOTS = '/tmp/cd-shots'

const USER = process.env.E2E_USER ?? ''
const PASS = process.env.E2E_PASS ?? ''

let step = 0
const t0 = Date.now()
const ok = (msg) => console.log(`✓ [${((Date.now() - t0) / 1000).toFixed(1)}s] ${step++}. ${msg}`)
const fail = (msg, e) => { console.error(`✗ ${msg}`, e); process.exit(1) }

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()

// 1. 未登录 → 登录页
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.getByText('请登录后使用').waitFor({ timeout: 8000 })
await page.screenshot({ path: `${SHOTS}/01-login.png` })
ok('未登录 → 显示登录页')

// 2. 未登录数据 401
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

// 4. 登录 → 首页四大分区
await page.getByPlaceholder('密码').fill(PASS)
const loginT = Date.now()
await page.getByRole('button', { name: /登\s*录/ }).click()
await page.getByText('题库分区').waitFor({ timeout: 8000 })
for (const s of ['强化题库', '冲刺模拟', '精选题库', '专题模块']) {
  if ((await page.getByText(s, { exact: true }).count()) === 0) fail(`首页缺少分区: ${s}`)
}
ok(`登录成功 → 首页四大分区齐全（${Date.now() - loginT}ms）`)
await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOTS}/03-home.png` })

// 5. 强化题库 → 7 本书 + 滚动完整性
await page.getByText('强化题库', { exact: true }).click()
await page.getByText('27余峰500题').waitFor({ timeout: 8000 })
await page.waitForTimeout(800)
const scrollInfo = await page.evaluate(() => {
  window.scrollTo(0, 999999)
  return new Promise((r) => setTimeout(() => r({
    scrollY: window.scrollY,
    max: document.documentElement.scrollHeight - window.innerHeight,
    lastBookVisible: [...document.querySelectorAll('h3')].some((h) => h.textContent?.includes('27版徐涛优题库-拔高题')),
  }), 400))
})
if (scrollInfo.scrollY < scrollInfo.max - 5) fail(`滚动不完整: ${scrollInfo.scrollY}/${scrollInfo.max}`)
if (!scrollInfo.lastBookVisible) fail('最后一本书不可见（目录不齐全）')
ok(`强化题库 7 本书 · 滚动到底完整可见（${scrollInfo.scrollY}/${scrollInfo.max}）`)

// 6. 打开书 → 科目 chips → 马原 → 章节列表
const openT = Date.now()
await page.getByRole('button', { name: /^马原/ }).first().click()
await page.getByText('第一章', { exact: false }).first().waitFor({ timeout: 5000 })
ok(`展开科目 → 章节列表（${Date.now() - openT}ms）`)
await page.screenshot({ path: `${SHOTS}/04-section.png` })

// 7. 进章节 → 首题
const quizT = Date.now()
await page.getByText('第一章', { exact: false }).first().click()
await page.locator('main p').first().waitFor({ timeout: 8000 })
ok(`打开章节 → 首题渲染（${Date.now() - quizT}ms）`)
await page.screenshot({ path: `${SHOTS}/05-quiz.png` })

// 8. 作答判分
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

// 9. 下一题
await page.getByRole('button', { name: /下一题/ }).click()
await page.getByText('2/').waitFor({ timeout: 3000 })
ok('下一题切换')

// 10. 考点
await page.getByRole('link', { name: '考点', exact: true }).click()
await page.getByPlaceholder(/搜索考点/).waitFor({ timeout: 5000 })
await page.getByPlaceholder(/搜索考点/).fill('马克思主义的科学内涵')
await page.waitForTimeout(200)
await page.locator('main button').filter({ hasText: /马克思主义的科学内涵/ }).first().click()
await page.locator('.prose-cd p').first().waitFor({ timeout: 5000 })
await page.screenshot({ path: `${SHOTS}/07-kaodian.png` })
ok('考点搜索 + 教材正文渲染')

// 11. 深色
await page.keyboard.press('Escape')
await page.getByRole('link', { name: '题库', exact: true }).click()
await page.getByRole('button', { name: '切换深色模式' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOTS}/08-dark.png` })
ok('深色模式切换')

// 12. 刷新会话保持
await page.reload({ waitUntil: 'domcontentloaded' })
await page.getByText('题库分区').waitFor({ timeout: 8000 })
ok('刷新 → 会话保持')

// 13. 退出
await page.getByRole('button', { name: '退出登录' }).click()
await page.getByText('请登录后使用').waitFor({ timeout: 8000 })
ok('退出登录 → 登录页')

// 14. 桌面视口
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const dpage = await desk.newPage()
await dpage.goto(BASE, { waitUntil: 'domcontentloaded' })
await dpage.getByPlaceholder('用户名').fill(USER)
await dpage.getByPlaceholder('密码').fill(PASS)
await dpage.getByRole('button', { name: /登\s*录/ }).click()
await dpage.getByText('题库分区').waitFor({ timeout: 8000 })
await dpage.waitForTimeout(400)
await dpage.screenshot({ path: `${SHOTS}/10-desktop-home.png` })
ok('桌面视口渲染')

await browser.close()
console.log(`\n全部通过 ✅  截图: ${SHOTS}/`)
