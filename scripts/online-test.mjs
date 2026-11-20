import { chromium } from 'playwright'

const errors = []
const browser = await chromium.launch({ headless: true })
const a = await (await browser.newContext()).newPage()
const b = await (await browser.newContext()).newPage()
for (const p of [a, b]) {
  p.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
}

// Host creates a room
await a.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await a.getByRole('button', { name: /Online/ }).click()
await a.getByRole('button', { name: /Oda Oluştur/ }).click()
await a.waitForSelector('.pill--code', { timeout: 20000 })
const code = (await a.locator('.pill--code').textContent()).match(/[A-Z0-9]{6}/)?.[0]
console.log('created room:', code)

// Guest joins and claims a bot seat
await b.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await b.getByRole('button', { name: /Online/ }).click()
await b.locator('input[placeholder="ABC123"]').fill(code)
await b.getByRole('button', { name: 'Katıl' }).click()
await b.waitForSelector('.board', { timeout: 20000 })
await b.waitForFunction(() => document.body.innerText.includes('KOLTUK'), null, { timeout: 15000 })
console.log('guest seat:', await b.locator('.pill').filter({ hasText: 'KOLTUK' }).textContent())
console.log('guest "SEN" tag:', await b.locator('.tag--you').count())

// Guest must not be able to act on the host's turn
const guestPrimary = b.locator('.action-panel .btn--primary').first()
console.log('guest controls on host turn (should be false):', await guestPrimary.isEnabled())

// Host rolls; guest receives the update through Realtime
const before = await b.locator('.log-list li').first().textContent()
await a.locator('.action-panel .btn--primary').first().click()
await b.waitForFunction(
  (old) => document.querySelector('.log-list li')?.textContent !== old,
  before,
  { timeout: 20000 },
)
console.log('guest saw host move:', (await b.locator('.log-list li').first().textContent()))

await b.screenshot({ path: 'artifacts/06-online-seat.png', fullPage: true })
await browser.close()
console.log('errors:', errors.length ? errors : 'none')
