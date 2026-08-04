import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const zombieModelPath = resolve(root, 'src/zombie-model.ts')
const oldFacing = 'export const ZOMBIE_FORWARD_YAW = -Math.PI / 2'
const correctedFacing = 'export const ZOMBIE_FORWARD_YAW = 0'

let zombieModel = readFileSync(zombieModelPath, 'utf8')

if (!zombieModel.includes('DEADWATER_AUTHORED_STATIC_INFECTED_V37')) {
  throw new Error('The authored v37 zombie must be generated before the v38 facing correction')
}

if (zombieModel.includes(oldFacing)) {
  zombieModel = zombieModel.replace(oldFacing, correctedFacing)
  writeFileSync(zombieModelPath, zombieModel)
} else if (!zombieModel.includes(correctedFacing)) {
  throw new Error('Could not find the authored zombie facing constant to correct')
}

console.log(
  'Locked authored zombie facing to local -Z so spawn, pursuit, wall recovery, and attack use the same yaw contract.',
)
