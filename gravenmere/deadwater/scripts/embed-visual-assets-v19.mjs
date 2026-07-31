import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [castleRomeoPath, mutedZombieDiffusePath] = process.argv.slice(2)

if (!castleRomeoPath || !mutedZombieDiffusePath) {
  throw new Error(
    'Usage: node scripts/embed-visual-assets-v19.mjs <castle-romeo-gray.webp> <muted-zombie.webp>',
  )
}

const [castleRomeo, mutedZombieDiffuse] = await Promise.all([
  readFile(resolve(castleRomeoPath)),
  readFile(resolve(mutedZombieDiffusePath)),
])

const dataUri = (mime, bytes) =>
  `"data:${mime};base64,${bytes.toString('base64')}"`

const output = `// Generated from the public-domain Castle Romeo photograph and a simplified
// treatment of the CC-BY 3.0 Pixelhouse zombie diffuse. See ASSET_SOURCES_V19.md.
// Assets are embedded so the Android build remains fully offline.
export const CASTLE_ROMEO_GRAY_WEBP_V19 =
  ${dataUri('image/webp', castleRomeo)}

export const MUTED_ZOMBIE_DIFFUSE_WEBP_V19 =
  ${dataUri('image/webp', mutedZombieDiffuse)}
`

await writeFile(
  new URL('../src/generated-visual-assets-v19.ts', import.meta.url),
  output,
  'utf8',
)
