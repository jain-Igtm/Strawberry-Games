import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const zombieModelPath = resolve(import.meta.dirname, '..', 'src', 'zombie-model.ts')
let zombieModel = readFileSync(zombieModelPath, 'utf8')

if (!zombieModel.includes('export function showZombieHit')) {
  const anchor = 'export function beginZombieDeath(visual: ZombieVisual): void {'
  if (!zombieModel.includes(anchor)) {
    throw new Error('Could not restore the static zombie hit API')
  }

  zombieModel = zombieModel.replace(
    anchor,
    `export function showZombieHit(_visual: ZombieVisual): void {
  // Main owns the brief per-zombie tint timer. Keep the v32 API stable without
  // introducing another living pose, animation frame, or per-frame calculation.
}

${anchor}`,
  )
  writeFileSync(zombieModelPath, zombieModel)
  console.log('Restored the static zombie hit API after the v32 generator pass.')
} else {
  console.log('The static zombie hit API is already compatible.')
}
