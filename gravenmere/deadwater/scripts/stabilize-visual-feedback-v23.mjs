import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const v21Marker = '// DEADWATER_TEXTURED_FALLOUT_RANGE_V21'
const v22Marker = '// DEADWATER_HOODED_GLIDERS_AND_BROAD_RIDGES_V22'

if (source.includes(v22Marker) && !source.includes(v21Marker)) {
  source = source.replace(v22Marker, `${v21Marker}\n${v22Marker}`)
  writeFileSync(dockTownPath, source)
  console.log('Retained the v21 completion marker beneath the superseding v22 pass.')
} else {
  console.log('Visual feedback pipeline markers are already stable.')
}
