import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [
  plumePath,
  zombieDiffusePath,
  zombieWalkPath,
  zombieAttackPath,
  zombieDeathPath,
] = process.argv.slice(2)

if (
  !plumePath ||
  !zombieDiffusePath ||
  !zombieWalkPath ||
  !zombieAttackPath ||
  !zombieDeathPath
) {
  throw new Error(
    'Usage: node scripts/embed-assets-v18.mjs <plume.webp> <zombie.webp> <walk.glb> <attack.glb> <death.glb>',
  )
}

const [plume, zombieDiffuse, zombieWalk, zombieAttack, zombieDeath] =
  await Promise.all([
    readFile(resolve(plumePath)),
    readFile(resolve(zombieDiffusePath)),
    readFile(resolve(zombieWalkPath)),
    readFile(resolve(zombieAttackPath)),
    readFile(resolve(zombieDeathPath)),
  ])

const dataUri = (mime, bytes) =>
  `"data:${mime};base64,${bytes.toString('base64')}"`

const output = `// Generated from the public-domain NARA Hiroshima plume photograph and the
// CC-BY 3.0 Pixelhouse zombie. See ASSET_SOURCES_V18.md.
// Assets are embedded so the Android build remains fully offline.
export const DISSIPATING_PLUME_WEBP_V18 =
  ${dataUri('image/webp', plume)}

export const PIXELHOUSE_ZOMBIE_DIFFUSE_WEBP_V18 =
  ${dataUri('image/webp', zombieDiffuse)}

export const PIXELHOUSE_ZOMBIE_WALK_GLB_V18 =
  ${dataUri('model/gltf-binary', zombieWalk)}

export const PIXELHOUSE_ZOMBIE_ATTACK_GLB_V18 =
  ${dataUri('model/gltf-binary', zombieAttack)}

export const PIXELHOUSE_ZOMBIE_DEATH_GLB_V18 =
  ${dataUri('model/gltf-binary', zombieDeath)}
`

await writeFile(
  new URL('../src/generated-assets-v18.ts', import.meta.url),
  output,
  'utf8',
)
