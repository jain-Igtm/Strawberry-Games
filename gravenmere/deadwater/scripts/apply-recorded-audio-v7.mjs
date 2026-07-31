import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/main.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_RECORDED_AUDIO_V7'

if (source.includes(marker)) {
  console.log('Deadwater recorded-audio v7 already applied.')
  process.exit(0)
}

function replaceRequired(label, search, replacement) {
  const next = source.replace(search, replacement)
  if (next === source) throw new Error(`Could not apply recorded audio v7: ${label}`)
  source = next
}

replaceRequired(
  'soundscape import',
  "import { DeadwaterSoundscapeV6 } from './soundscape-v6'",
  "import { DeadwaterSoundscapeV7 } from './soundscape-v7'",
)
replaceRequired(
  'soundscape instance',
  'const soundscape = new DeadwaterSoundscapeV6()',
  'const soundscape = new DeadwaterSoundscapeV7()',
)
replaceRequired(
  'version marker',
  '// DEADWATER_POLISH_V6',
  `// DEADWATER_POLISH_V6\n${marker}`,
)

writeFileSync(sourcePath, source)
console.log('Applied Deadwater v7 recorded audio.')
