import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const terrainPath = resolve(import.meta.dirname, '../src/terrain-v5.ts')
let source = readFileSync(terrainPath, 'utf8')
const marker = '// DEADWATER_TERRAIN_WINDING_V6'

if (source.includes(marker)) {
  console.log('Deadwater terrain winding v6 already fixed.')
  process.exit(0)
}

const originalCenter = 'indices.push(0, 1 + segment, 1 + next)'
const originalQuads = 'indices.push(inner, outer, innerNext, innerNext, outer, outerNext)'
if (!source.includes(originalCenter) || !source.includes(originalQuads)) {
  throw new Error('Could not locate v6 hill triangle winding.')
}

source = source.replace(
  '// DEADWATER_NATURAL_TERRAIN_V6',
  `// DEADWATER_NATURAL_TERRAIN_V6
${marker}`,
)
source = source.replace(originalCenter, 'indices.push(0, 1 + next, 1 + segment)')
source = source.replace(
  originalQuads,
  'indices.push(inner, innerNext, outer, innerNext, outerNext, outer)',
)
writeFileSync(terrainPath, source)
console.log('Applied upward-facing hill triangle winding for v6.')
