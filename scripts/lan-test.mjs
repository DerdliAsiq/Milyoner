import { chromium } from 'playwright'

const host = process.argv[2] ?? '192.168.100.19'
const url = `http://${host}:5173`
const errors = []
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
console.log('URL:', url)
console.log('title:', await page.title())
console.log('setup visible:', await page.locator('.setup__hero').isVisible())

await page.getByRole('button', { name: /Oyunu Başlat/ }).click()
await page.waitForSelector('.board')
console.log('board tiles:', await page.locator('.tile').count())

await page.getByRole('button', { name: /Çık/ }).click()
await page.getByRole('button', { name: /Online/ }).click()
await page.getByRole('button', { name: /Oda Oluştur/ }).click()
await page.waitForSelector('.pill--code', { timeout: 20000 })
console.log('room code:', (await page.locator('.pill--code').textContent()).trim())

await browser.close()
console.log('errors:', errors.length ? errors : 'none')
