import { chromium } from 'playwright-core'
const USER = process.env.E2E_USER ?? ''
const PASS = process.env.E2E_PASS ?? ''
if (!USER || !PASS) { console.error('缺 E2E_USER/E2E_PASS：先 source ~/.config/cangdun/e2e.env'); process.exit(2) }
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome', headless: true })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 160)) })
p.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 200)))
await p.goto('https://cd.2023989.xyz/', { waitUntil: 'domcontentloaded' })
await p.getByPlaceholder('用户名').fill(USER)
await p.getByPlaceholder('密码').fill(PASS)
await p.getByRole('button', { name: /登\s*录/ }).click()
await p.getByText('题库分区').waitFor({ timeout: 8000 })
await p.getByText('强化题库', { exact: true }).click()
await p.waitForTimeout(3000)
console.log('URL:', p.url())
console.log('BODY:', (await p.locator('main').innerText()).slice(0, 300).replace(/\n+/g, ' | '))
await p.screenshot({ path: '/tmp/cd-shots/dbg-section.png' })
await b.close()
