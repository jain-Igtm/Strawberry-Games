import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mainPath = resolve(import.meta.dirname, '..', 'src', 'main.ts')
let source = readFileSync(mainPath, 'utf8')
const marker = '// ST_AGNES_VISUAL_REVIEW_MODE_V2'

if (source.includes(marker)) {
  console.log('St. Agnes visual review mode already applied.')
  process.exit(0)
}

const touchAnchor = "const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window\n"
if (!source.includes(touchAnchor)) {
  throw new Error('Could not find touch-mode anchor in src/main.ts')
}
source = source.replace(
  touchAnchor,
  touchAnchor +
    `${marker}\n` +
    "const hospitalPreviewMode = new URLSearchParams(location.search).has('hospitalPreview')\n",
)

const loopAnchor = 'if (state.started && !state.paused && !state.gameOver) {'
if (!source.includes(loopAnchor)) {
  throw new Error('Could not find gameplay-loop anchor in src/main.ts')
}
source = source.replace(
  loopAnchor,
  'if (state.started && !state.paused && !state.gameOver && !hospitalPreviewMode) {',
)

const endingAnchor = `updateQuestStrip()\nrefreshPauseSettings()\nupdateHud()\ncamera.position.copy(player.position)\ncamera.rotation.set(player.pitch, player.yaw, 0)\nanimate()`
if (!source.includes(endingAnchor)) {
  throw new Error('Could not find startup-camera anchor in src/main.ts')
}
source = source.replace(
  endingAnchor,
  `if (hospitalPreviewMode) {\n` +
    `  ui.startScreen.style.display = 'none'\n` +
    `  ui.gameOverScreen.style.display = 'none'\n` +
    `  ui.hud.style.display = 'none'\n` +
    `}\n\n` +
    `updateQuestStrip()\n` +
    `refreshPauseSettings()\n` +
    `updateHud()\n` +
    `if (!hospitalPreviewMode) {\n` +
    `  camera.position.copy(player.position)\n` +
    `  camera.rotation.set(player.pitch, player.yaw, 0)\n` +
    `}\n` +
    `animate()`,
)

writeFileSync(mainPath, source)
console.log('Applied static St. Agnes visual review camera mode.')
