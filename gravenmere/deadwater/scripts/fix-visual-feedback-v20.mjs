import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
const zombiePath = resolve(root, 'src/zombie-model.ts')

let dockTown = readFileSync(dockTownPath, 'utf8')
const curveReplacements = [
  ['draw.bezierCurveTo(18, 142, 41, 126, 38, 82)', 'draw.lineTo(38, 82)'],
  ['draw.bezierCurveTo(60, 105, 53, 58, 70, 34)', 'draw.lineTo(70, 34)'],
  ['draw.bezierCurveTo(79, 79, 106, 100, 110, 143)', 'draw.lineTo(110, 143)'],
  ['draw.bezierCurveTo(114, 166, 100, 184, 18, 184)', 'draw.lineTo(18, 184)'],
  ['draw.bezierCurveTo(31, 151, 51, 135, 52, 96)', 'draw.lineTo(52, 96)'],
  ['draw.bezierCurveTo(69, 118, 66, 80, 79, 61)', 'draw.lineTo(79, 61)'],
  ['draw.bezierCurveTo(84, 105, 101, 128, 98, 157)', 'draw.lineTo(98, 157)'],
  ['draw.bezierCurveTo(96, 177, 84, 184, 34, 184)', 'draw.lineTo(34, 184)'],
  ['draw.bezierCurveTo(47, 156, 61, 145, 63, 116)', 'draw.lineTo(63, 116)'],
  ['draw.bezierCurveTo(75, 132, 77, 110, 83, 98)', 'draw.lineTo(83, 98)'],
  ['draw.bezierCurveTo(91, 132, 90, 164, 81, 184)', 'draw.lineTo(81, 184)'],
]
for (const [curve, line] of curveReplacements) {
  dockTown = dockTown.replace(curve, line)
}
if (dockTown.includes('draw.bezierCurveTo(')) {
  throw new Error('A road-fire Bézier curve remains after the canvas compatibility pass')
}
writeFileSync(dockTownPath, dockTown)

let zombie = readFileSync(zombiePath, 'utf8')
zombie = zombie.replace(
  'export const ZOMBIE_FORWARD_YAW = 0',
  'export const ZOMBIE_FORWARD_YAW = -Math.PI / 2',
)
writeFileSync(zombiePath, zombie)

console.log('Applied canvas-test compatibility and retained the established zombie yaw contract.')
