import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_SHARED_HORIZON_LIGHT_V28'

if (!source.includes(marker)) {
  const warningAnchor =
    "  const warning = box(16, 2.2, 0.22, signMaterial('ROAD CLOSED · FALLOUT')"
  const warningIndex = source.indexOf(warningAnchor)
  if (warningIndex < 0) {
    throw new Error('Could not locate the fallout warning after the v27 scene pass')
  }

  const lightingPass = String.raw`  // DEADWATER_SHARED_HORIZON_LIGHT_V28
  // The v27 silhouettes finally read correctly, but their baked peach values and
  // unlit BasicMaterials made the horizon look as though it had a separate sun.
  // Preserve every shape and depth position, while converting the visible land
  // layers to dark, rough materials that respond to the town's actual lights.
  const relightNorthCountryLayer = (
    name: string,
    color: number,
    opacityScale = 1,
  ): void => {
    const object = context.scene.getObjectByName(name)
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return

    const previous = object.material as THREE.MeshBasicMaterial
    const replacement = new THREE.MeshStandardMaterial({
      map: previous.map,
      color,
      transparent: true,
      opacity: previous.opacity * opacityScale,
      alphaTest: previous.alphaTest,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: true,
      roughness: 1,
      metalness: 0,
    })
    previous.dispose()
    object.material = replacement
  }

  // Nearby rock keeps a restrained rusty cast; each more distant layer becomes
  // cooler and lower contrast. All three now share the directional and ambient
  // lighting used by the streets, buildings, trees, and dry ground.
  relightNorthCountryLayer('true-near-broken-bluffs-v27', 0x59443c, 0.96)
  relightNorthCountryLayer('true-mid-utah-cliffs-v27', 0x5a5049, 0.9)
  relightNorthCountryLayer('true-far-utah-escarpment-v27', 0x555653, 0.82)

  const ground = context.scene.getObjectByName('continuous-dry-north-country-v27')
  if (ground instanceof THREE.Mesh && !Array.isArray(ground.material)) {
    const material = ground.material as THREE.MeshStandardMaterial
    material.color.setHex(0x665148)
    material.roughness = 1
    material.metalness = 0
    material.needsUpdate = true
  }
  const apron = context.scene.getObjectByName('north-country-transition-apron-v27')
  if (apron instanceof THREE.Mesh && !Array.isArray(apron.material)) {
    const material = apron.material as THREE.MeshStandardMaterial
    material.color.setHex(0x665148)
    material.roughness = 1
    material.metalness = 0
    material.needsUpdate = true
  }

`

  source = source.slice(0, warningIndex) + lightingPass + source.slice(warningIndex)
  writeFileSync(dockTownPath, source)
  console.log('Darkened the Utah horizon and placed it under the town lighting.')
} else {
  console.log('The shared horizon lighting pass is already applied.')
}
