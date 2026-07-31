import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const outputDirectory = 'visual-review/st-agnes-v2'
mkdirSync(outputDirectory, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--disable-dev-shm-usage'],
})

const page = await browser.newPage({
  viewport: { width: 1560, height: 720 },
  deviceScaleFactor: 1,
})

const errors = []
page.on('pageerror', (error) => {
  errors.push(`pageerror: ${error.message}`)
})
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

const views = ['entrance', 'lobby', 'west-ward', 'east-ward']
for (const view of views) {
  await page.goto(`http://127.0.0.1:5173/?hospitalPreview=${view}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForFunction(
    () => window.__ST_AGNES_READY__ === true,
    undefined,
    { timeout: 30000 },
  )

  const begin = page.getByRole('button', { name: /begin wave one/i })
  if (await begin.isVisible()) {
    await begin.click()
  }
  await page.waitForTimeout(700)

  await page.evaluate((selectedView) => {
    let remainingFrames = 150
    const holdPreview = () => {
      window.setStAgnesPreview?.(selectedView)
      remainingFrames -= 1
      if (remainingFrames > 0) requestAnimationFrame(holdPreview)
    }
    holdPreview()
  }, view)

  await page.waitForTimeout(2200)
  await page.screenshot({
    path: `${outputDirectory}/${view}.png`,
    fullPage: false,
  })
}

writeFileSync(
  `${outputDirectory}/browser-errors.json`,
  `${JSON.stringify(errors, null, 2)}\n`,
)
await browser.close()

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
