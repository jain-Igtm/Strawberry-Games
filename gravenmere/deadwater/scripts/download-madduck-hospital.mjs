import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const destination = resolve(process.argv[2] ?? 'asset-inspection/madduck-downloads')
mkdirSync(destination, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-dev-shm-usage'],
})
const context = await browser.newContext({ acceptDownloads: true })
const page = await context.newPage()
page.setDefaultTimeout(90000)

const saveDiagnostics = async () => {
  writeFileSync(resolve(destination, 'download-page.html'), await page.content())
  await page.screenshot({
    path: resolve(destination, 'download-page.png'),
    fullPage: true,
    timeout: 90000,
  }).catch(() => undefined)
}

try {
  const purchaseUrl = 'https://madduck.itch.io/modular-3d-hospital-environment/purchase'
  await page.goto(purchaseUrl, { waitUntil: 'domcontentloaded' })

  const noThanks = page.getByText(/No thanks, just take me to the downloads/i).first()
  if (!(await noThanks.count())) throw new Error('Could not find the free-download control.')
  await noThanks.click()
  await page.locator('.upload').first().waitFor({ state: 'visible', timeout: 60000 })

  const row = page.locator('.upload').filter({ hasText: /blend_file\+textures\.zip/i }).first()
  if (!(await row.count())) throw new Error('Could not find the complete textured hospital pack.')
  const button = row.locator('a.download_btn, button.download_btn, a.button, button.button').first()
  if (!(await button.count())) throw new Error('Could not find the complete-pack download button.')

  const downloadPromise = page.waitForEvent('download', { timeout: 90000 })
  await button.click()
  const download = await downloadPromise
  const output = resolve(destination, 'blend_file+textures.zip')
  await download.saveAs(output)
  const failure = await download.failure()
  if (failure) throw new Error(`Hospital source download failed: ${failure}`)
  console.log('Downloaded blend_file+textures.zip')

  writeFileSync(
    resolve(destination, 'SOURCE.txt'),
    [
      'Free Modular 3D hospital environment by Madduck',
      'Source: https://madduck.itch.io/modular-3d-hospital-environment',
      'Creator states the pack may be used and modified in commercial or non-commercial game projects.',
      'The source assets may not be resold or redistributed as an asset pack.',
      '',
    ].join('\n'),
  )
} catch (error) {
  await saveDiagnostics()
  throw error
} finally {
  await browser.close()
}
