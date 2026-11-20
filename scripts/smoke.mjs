import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('artifacts', { recursive: true })

const errors = []
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.screenshot({ path: 'artifacts/01-setup.png', fullPage: true })
console.log('setup title:', await page.title())

await page.getByRole('button', { name: /Oyunu Başlat/ }).click()
await page.waitForSelector('.board')
await page.screenshot({ path: 'artifacts/02-board.png', fullPage: true })
console.log('board tiles:', await page.locator('.tile').count())

for (let i = 0; i < 45; i++) {
  if (await page.locator('.action-panel--over').count()) break
  const primary = page.locator('.action-panel .btn--primary').first()
  const ghost = page.locator('.action-panel .btn--ghost').first()
  try {
    if (await primary.isVisible() && await primary.isEnabled()) {
      await primary.click({ timeout: 1500 })
    } else if (await ghost.isVisible() && await ghost.isEnabled()) {
      await ghost.click({ timeout: 1500 })
    } else {
      await page.waitForTimeout(400)
    }
  } catch {
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(220)
}

await page.screenshot({ path: 'artifacts/03-after-turns.png', fullPage: true })
console.log('round:', await page.locator('.round-pill').textContent())
console.log('log entries:', await page.locator('.log-list li').count())
console.log('game over:', await page.locator('.action-panel--over').count())

// Online room creation
await page.getByRole('button', { name: /Çık/ }).click()
await page.getByRole('button', { name: /Online/ }).click()
await page.getByRole('button', { name: /Oda Oluştur/ }).click()
await page.waitForSelector('.pill--code', { timeout: 15000 })
const code = (await page.locator('.pill--code').textContent())?.trim()
console.log('room code:', code)
await page.screenshot({ path: 'artifacts/04-online.png', fullPage: true })

await browser.close()
console.log('console errors:', errors.length ? errors : 'none')
