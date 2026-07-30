import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [mushroomPath, zombiePath] = process.argv.slice(2)
if (!mushroomPath || !zombiePath) {
  throw new Error(
    'Usage: node scripts/embed-assets-v17.mjs <castle-romeo.jpg> <zombie-basic.glb>',
  )
}

const [mushroomBytes, zombieBytes] = await Promise.all([
  readFile(resolve(mushroomPath)),
  readFile(resolve(zombiePath)),
])

const output = `// Generated from the public-domain Castle Romeo photograph and the
// CC0 Quaternius Zombie Apocalypse Kit. See ASSET_SOURCES_V17.md.
// Embedding keeps the Android build fully offline and works with the repository's
// UTF-8-only file publishing path.
export const CASTLE_ROMEO_JPEG_V17 =
  "data:image/jpeg;base64,${mushroomBytes.toString('base64')}"

export const QUATERNIUS_ZOMBIE_GLB_V17 =
  "data:model/gltf-binary;base64,${zombieBytes.toString('base64')}"
`

await writeFile(
  new URL('../src/generated-assets-v17.ts', import.meta.url),
  output,
  'utf8',
)
