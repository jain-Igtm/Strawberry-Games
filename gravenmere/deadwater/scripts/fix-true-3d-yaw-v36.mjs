import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const zombieModelPath = resolve(import.meta.dirname, '..', 'src', 'zombie-model.ts')
let zombieModel = readFileSync(zombieModelPath, 'utf8')
const before = 'export const ZOMBIE_FORWARD_YAW = 0'
const after = 'export const ZOMBIE_FORWARD_YAW = -Math.PI / 2'

if (zombieModel.includes(before)) {
  zombieModel = zombieModel.replace(before, after)
  writeFileSync(zombieModelPath, zombieModel)
  console.log('Preserved the established Ashfall zombie forward-yaw contract.')
} else if (zombieModel.includes(after)) {
  console.log('The true 3D zombie yaw contract is already correct.')
} else {
  throw new Error('Could not locate the true 3D zombie yaw constant')
}
