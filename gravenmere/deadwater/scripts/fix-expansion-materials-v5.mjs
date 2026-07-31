import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const terrainPath = resolve(import.meta.dirname, '../src/terrain-v5.ts')
const worldPath = resolve(import.meta.dirname, '../src/world-expansion.ts')
const mainPath = resolve(import.meta.dirname, '../src/main.ts')
const materialType = `EnvironmentMaterials & {
    island: THREE.MeshStandardMaterial
    water: THREE.MeshStandardMaterial
  }`

let terrain = readFileSync(terrainPath, 'utf8')
terrain = terrain.replaceAll('materials: EnvironmentMaterials', `materials: ${materialType}`)
writeFileSync(terrainPath, terrain)

let world = readFileSync(worldPath, 'utf8')
world = world.replaceAll('materials: EnvironmentMaterials', `materials: ${materialType}`)
writeFileSync(worldPath, world)

let main = readFileSync(mainPath, 'utf8')
const start = main.indexOf('const expandedWorld = buildWorldExpansion({')
const end = main.indexOf('const emberCount', start)
if (start < 0 || end < 0) throw new Error('Could not find expanded-world material block.')
const before = main.slice(0, start)
let block = main.slice(start, end)
const needle = `    warning: mats.warning,
    ember: mats.ember,`
if (!block.includes('    island: mats.island,')) {
  if (!block.includes(needle)) throw new Error('Could not extend expanded-world materials.')
  block = block.replace(
    needle,
    `${needle}
    island: mats.island,
    water: mats.water,`,
  )
  main = before + block + main.slice(end)
  writeFileSync(mainPath, main)
}

console.log('Applied Deadwater v5 terrain material contract fix.')
