import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_OVERCAST_HORIZON_GRADE_V29'

if (!source.includes(marker)) {
  const warningAnchor =
    "  const warning = box(16, 2.2, 0.22, signMaterial('ROAD CLOSED · FALLOUT')"
  const warningIndex = source.indexOf(warningAnchor)
  if (warningIndex < 0) {
    throw new Error('Could not locate the fallout warning after the v28 lighting pass')
  }

  const gradePass = String.raw`  // DEADWATER_OVERCAST_HORIZON_GRADE_V29
  // The shared StandardMaterials still became peach-bright under the scene's
  // deliberately strong exposure and multiple disaster lights. Preserve the
  // accepted silhouettes and depth positions, but bake the common overcast
  // illumination into stable unlit materials so the horizon cannot appear to
  // have a separate sun.
  const applyOvercastHorizonGradeV29 = (
    objectName: string,
    tint: number,
    opacity: number,
  ): void => {
    const horizonObjectV29 = context.scene.getObjectByName(objectName)
    if (!(horizonObjectV29 instanceof THREE.Mesh) || Array.isArray(horizonObjectV29.material)) return

    const previousMaterialV29 = horizonObjectV29.material as THREE.Material & {
      map?: THREE.Texture | null
      alphaTest?: number
    }
    const previousMapV29 = previousMaterialV29.map ?? null
    const replacementMaterialV29 = new THREE.MeshBasicMaterial({
      map: previousMapV29,
      color: tint,
      transparent: true,
      opacity,
      alphaTest: previousMaterialV29.alphaTest ?? 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      // Do not let the renderer's 2.05 exposure lift these cliffs back to peach.
      toneMapped: false,
    })
    previousMaterialV29.dispose()
    horizonObjectV29.material = replacementMaterialV29
  }

  applyOvercastHorizonGradeV29('true-near-broken-bluffs-v27', 0x4b3732, 0.98)
  applyOvercastHorizonGradeV29('true-mid-utah-cliffs-v27', 0x403a39, 0.94)
  applyOvercastHorizonGradeV29('true-far-utah-escarpment-v27', 0x363b3d, 0.9)

  // Keep the dry extension in the same red-gray world, but prevent it from
  // forming a brighter strip beneath the now-dark cliff line.
  for (const groundNameV29 of [
    'continuous-dry-north-country-v27',
    'north-country-transition-apron-v27',
  ]) {
    const groundObjectV29 = context.scene.getObjectByName(groundNameV29)
    if (!(groundObjectV29 instanceof THREE.Mesh) || Array.isArray(groundObjectV29.material)) continue
    const groundMaterialV29 = groundObjectV29.material as THREE.MeshStandardMaterial
    groundMaterialV29.color.setHex(0x4c3b36)
    groundMaterialV29.roughness = 1
    groundMaterialV29.metalness = 0
    groundMaterialV29.needsUpdate = true
  }

`

  source = source.slice(0, warningIndex) + gradePass + source.slice(warningIndex)
  writeFileSync(dockTownPath, source)
  console.log('Locked the Utah horizon to the dark shared overcast grade.')
} else {
  console.log('The overcast horizon grade is already applied.')
}
