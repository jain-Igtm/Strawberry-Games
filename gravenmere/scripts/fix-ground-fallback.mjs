import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const path = resolve(root, 'src/main.ts')
let main = readFileSync(path, 'utf8')

const oldImport = "import { flatSurface, sampleFloorHeight } from './vertical'"
const newImport = "import { resolveWorldFloorHeight } from './vertical'"
if (main.includes(oldImport)) main = main.replace(oldImport, newImport)

const oldFloorResolver = `const baseSurfaces = [flatSurface(0, -55, 150, 145, 0, -20)]
const floorAt = (x: number, z: number, y: number) =>
  sampleFloorHeight(endless.surfaces, x, z, y) ??
  sampleFloorHeight(school.surfaces, x, z, y) ??
  sampleFloorHeight(baseSurfaces, x, z, y)`

const newFloorResolver = `const floorAt = (x: number, z: number, y: number) =>
  resolveWorldFloorHeight(
    endless.surfaces,
    school.surfaces,
    x,
    z,
    y,
    endless.containsPosition(x, z),
  )`

if (main.includes(oldFloorResolver)) main = main.replace(oldFloorResolver, newFloorResolver)

if (!main.includes(newImport) || !main.includes(newFloorResolver)) {
  throw new Error('Could not install the continuous-ground fallback')
}
if (main.includes('const baseSurfaces =')) {
  throw new Error('The incomplete base-floor rectangle is still active')
}

writeFileSync(path, main)
console.log('Kept the original school and inner keep on continuous ground while preserving real voids in the Endless Ranges.')
