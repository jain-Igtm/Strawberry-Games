import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const root = resolve(import.meta.dirname, '..')
const iconSvg = readFileSync(resolve(root, 'public/gravenmere-icon.svg'), 'utf8')
const foregroundSvg = readFileSync(resolve(root, 'public/gravenmere-foreground.svg'), 'utf8')

function render(svg, width, height = width) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
  }).render().asPng()
}

const densities = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
]

for (const [density, legacySize, foregroundSize] of densities) {
  const directory = resolve(root, `android/app/src/main/res/mipmap-${density}`)
  const legacy = render(iconSvg, legacySize)
  writeFileSync(resolve(directory, 'ic_launcher.png'), legacy)
  writeFileSync(resolve(directory, 'ic_launcher_round.png'), legacy)
  writeFileSync(resolve(directory, 'ic_launcher_foreground.png'), render(foregroundSvg, foregroundSize))
}

const splashes = [
  ['drawable', 480, 320, 128],
  ['drawable-land-mdpi', 480, 320, 128],
  ['drawable-land-hdpi', 800, 480, 180],
  ['drawable-land-xhdpi', 1280, 720, 250],
  ['drawable-land-xxhdpi', 1600, 960, 320],
  ['drawable-land-xxxhdpi', 1920, 1280, 390],
  ['drawable-port-mdpi', 320, 480, 128],
  ['drawable-port-hdpi', 480, 800, 180],
  ['drawable-port-xhdpi', 720, 1280, 250],
  ['drawable-port-xxhdpi', 960, 1600, 320],
  ['drawable-port-xxxhdpi', 1280, 1920, 390],
]

const encodedIcon = Buffer.from(iconSvg).toString('base64')
for (const [folder, width, height, iconSize] of splashes) {
  const x = Math.round((width - iconSize) / 2)
  const y = Math.round((height - iconSize) / 2)
  const splashSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#080a0a"/>
      <image x="${x}" y="${y}" width="${iconSize}" height="${iconSize}"
        href="data:image/svg+xml;base64,${encodedIcon}"/>
    </svg>
  `
  writeFileSync(
    resolve(root, `android/app/src/main/res/${folder}/splash.png`),
    render(splashSvg, width, height),
  )
}

console.log('Generated World Explorer Android icons and splash screens.')
