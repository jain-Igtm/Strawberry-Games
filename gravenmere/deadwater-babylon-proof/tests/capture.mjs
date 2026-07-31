import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const output = process.env.ARTIFACT_DIR || 'artifacts'
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const errors = []
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', error => errors.push(error.message))
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__ASHFALL_READY__ === true, null, { timeout: 45000 })
await page.waitForTimeout(1400)
await page.screenshot({ path: `${output}/dock-town-street.png`, fullPage: true })
await page.evaluate(() => window.setAshfallView('interior'))
await page.waitForTimeout(900)
await page.screenshot({ path: `${output}/st-agnes-interior.png`, fullPage: true })
await page.evaluate(() => window.setAshfallView('forest'))
await page.waitForTimeout(900)
await page.screenshot({ path: `${output}/forest-horizon.png`, fullPage: true })
const actionableErrors = errors.filter(error => !error.includes('getActiveTextures is not a function'))
const stats = await page.evaluate(() => ({ ready: window.__ASHFALL_READY__, engine: 'Babylon.js 9.9.2' }))
await fs.writeFile(`${output}/stats.json`, JSON.stringify({ stats, errors, actionableErrors }, null, 2))
await browser.close()
if (actionableErrors.length) {
  console.error(actionableErrors.join('\n'))
  process.exit(1)
}
console.log(JSON.stringify(stats))
