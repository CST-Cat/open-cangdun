import { chromium } from 'playwright-core'
const [user, pass] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome', headless: true })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
await p.goto('http://localhost:37080/', { waitUntil: 'domcontentloaded' })
await p.getByPlaceholder('用户名').fill(user)
await p.getByPlaceholder('密码').fill(pass)
await p.getByRole('button', { name: /登\s*录/ }).click()
await p.getByText('题库目录').waitFor({ timeout: 8000 })
await p.goto('http://localhost:37080/ch/6458', { waitUntil: 'domcontentloaded' })
await p.locator('main p').first().waitFor({ timeout: 8000 })
// 跳到第 8 题
for (let i = 0; i < 7; i++) await p.getByRole('button', { name: /下一题/ }).click()
await p.getByText('8/').waitFor({ timeout: 3000 })
// 作答出解析
const confirm = await p.getByRole('button', { name: /确认答案|至少选两项/ }).count()
if (confirm) {
  await p.locator('main button:has(span:text-is("A"))').first().click()
  await p.locator('main button:has(span:text-is("B"))').first().click()
  await p.getByRole('button', { name: /确认答案/ }).click()
} else {
  await p.locator('main button:has(span:text-is("A"))').first().click()
}
await p.getByText(/回答正确|回答错误/).waitFor({ timeout: 3000 })
await p.waitForTimeout(1500) // 懒加载
const imgs = await p.locator('.prose-cd img').count()
const webpOk = imgs ? await p.locator('.prose-cd img').first().evaluate(el => el.naturalWidth > 0) : false
console.log('第8题解析图片数:', imgs, '· webp 解码成功:', webpOk)
await p.locator('.prose-cd').scrollIntoViewIfNeeded().catch(() => {})
await p.screenshot({ path: '/tmp/cd-shots/11-jiexi-image.png' })
await b.close()
