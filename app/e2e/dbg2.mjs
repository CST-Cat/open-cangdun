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
const names = await p.locator('button').evaluateAll((btns) =>
  btns.slice(0, 12).map((x) => x.getAttribute('aria-label') || x.textContent?.trim().slice(0, 14) || '(空)'))
console.log('前 12 个 button 可达名:', JSON.stringify(names, null, 1))
const tg = await p.locator('[data-slot="toggle-group"]').count()
console.log('toggle-group 数量:', tg)
await b.close()
