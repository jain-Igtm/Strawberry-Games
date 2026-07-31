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
page.setDefaultTimeout(60000)

const purchaseUrl = 'https://madduck.itch.io/modular-3d-hospital-environment/purchase'
await page.goto(purchaseUrl, { waitUntil: 'domcontentloaded' })

const noThanks = page.getByText(/No thanks, just take me to the downloads/i).first()
if (await noThanks.count()) {
  await noThanks.click()
  await page.waitForLoadState('domcontentloaded').catch(() => undefined)
}

const requestedFiles = [
  { pattern: /blend_file\+textures\.zip/i, output: 'blend_file+textures.zip' },
  { pattern: /FBX_models_no_textures\.zip/i, output: 'FBX_models_no_textures.zip' },
]

for (const requested of requestedFiles) {
  const link = page.getByRole('link', { name: requested.pattern }).first()
  if (!(await link.count())) {
    writeFileSync(resolve(destination, 'download-page.html'), await page.content())
    await page.screenshot({ path: resolve(destination, 'download-page.png'), fullPage: true })
    throw new Error(`Could not find itch.io download link for ${requested.output}`)
  }
  const downloadPromise = page.waitForEvent('download')
  await link.click()
  const download = await downloadPromise
  await download.saveAs(resolve(destination, requested.output))
  const failure = await download.failure()
  if (failure) throw new Error(`${requested.output} download failed: ${failure}`)
  console.log(`Downloaded ${requested.output}`)
}

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

await browser.close()
