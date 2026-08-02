import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const templatePath = resolve(root, 'scripts/templates/zombie-model-v37.template')
const zombieModelPath = resolve(root, 'src/zombie-model.ts')
const zombieModel = readFileSync(templatePath, 'utf8')

if (readFileSync(zombieModelPath, 'utf8') !== zombieModel) {
  writeFileSync(zombieModelPath, zombieModel)
  console.log('Installed the baked authored infected: one shared mesh, no rig or living animation.')
} else {
  console.log('The baked authored infected pass is already applied.')
}
