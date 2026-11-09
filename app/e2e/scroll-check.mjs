import { chromium } from 'playwright-core'
const USER = process.env.E2E_USER ?? ''
const PASS = process.env.E2E_PASS ?? ''
if (!USER || !PASS) { console.error('缺 E2E_USER/E2E_PASS：先 source ~/.config/cangdun/e2e.env'); process.exit(2) }
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome', headless: true })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
await p.goto('https://cd.2023989.xyz/', { waitUntil: 'domcontentloaded' })
await p.getByPlaceholder('用户名').fill(USER)
await p.getByPlaceholder('密码').fill(PASS)
await p.getByRole('button', { name: /登\s*录/ }).click()
await p.getByText('题库目录').waitFor({ timeout: 8000 })
await p.waitForTimeout(600)
const info = await p.evaluate(() => ({
  docH: document.documentElement.scrollHeight,
  bodyH: document.body.scrollHeight,
  winH: window.innerHeight,
  bodyOverflow: getComputedStyle(document.body).overflow,
  htmlOverflow: getComputedStyle(document.documentElement).overflow,
  mainH: document.querySelector('main')?.scrollHeight,
}))
console.log('页面高度:', JSON.stringify(info))
await p.evaluate(() => window.scrollTo(0, 999999))
await p.waitForTimeout(400)
const scrolled = await p.evaluate(() => window.scrollY)
console.log('滚动后 scrollY:', scrolled, '(应接近 docH-winH =', info.docH - info.winH, ')')
await p.screenshot({ path: '/tmp/cd-shots/scroll-bottom.png' })
// 展开第一个题库再测
await p.evaluate(() => window.scrollTo(0, 0))
await p.getByRole('button', { name: /27余峰500题/ }).click()
await p.getByText('第一章', { exact: false }).first().waitFor({ timeout: 5000 })
await p.waitForTimeout(600)
const info2 = await p.evaluate(() => ({ docH: document.documentElement.scrollHeight, accH: document.querySelector('[data-slot=accordion-content]')?.scrollHeight }))
console.log('展开后:', JSON.stringify(info2))
await p.evaluate(() => window.scrollTo(0, 999999))
await p.waitForTimeout(300)
console.log('展开后滚到底 scrollY:', await p.evaluate(() => window.scrollY))
await b.close()
