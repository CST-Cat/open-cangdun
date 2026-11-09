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
await p.getByText('题库分区').waitFor({ timeout: 8000 })
await p.getByText('强化题库', { exact: true }).click()
await p.waitForTimeout(2500)
const c1 = await p.getByRole('button', { name: /^马原/ }).count()
console.log('getByRole button /^马原/ 数量:', c1)
const c2 = await p.getByRole('button', { name: '马原8' }).count()
console.log('getByRole button name=马原8 数量:', c2)
const c3 = await p.locator('[data-slot="toggle-group-item"]').filter({ hasText: '马原' }).count()
console.log('locator toggle-group-item 含马原:', c3)
const html = await p.locator('[data-slot="toggle-group-item"]').first().evaluate((el) => el.outerHTML.slice(0, 300))
console.log('第一个 chip HTML:', html)
await b.close()
