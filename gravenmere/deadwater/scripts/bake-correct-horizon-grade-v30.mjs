import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dockTownPath = resolve(root, 'src/districts/dock-town.ts')
let source = readFileSync(dockTownPath, 'utf8')

const marker = '// DEADWATER_BAKED_CORRECT_HORIZON_GRADE_V30'

if (!source.includes(marker)) {
  const requiredLayerNames = [
    'true-near-utah-bluffs-v27',
    'true-mid-utah-cliffs-v27',
    'true-far-utah-escarpment-v27',
  ]
  for (const layerName of requiredLayerNames) {
    if (!source.includes(layerName)) {
      throw new Error(`Missing expected generated horizon layer: ${layerName}`)
    }
  }

  const warningAnchor =
    "  const warning = box(16, 2.2, 0.22, signMaterial('ROAD CLOSED · FALLOUT')"
  const warningIndex = source.indexOf(warningAnchor)
  if (warningIndex < 0) {
    throw new Error('Could not locate the fallout warning after the v29 grade pass')
  }

  const correction = String.raw`  // DEADWATER_BAKED_CORRECT_HORIZON_GRADE_V30
  // v28 and v29 accidentally targeted "true-near-broken-bluffs-v27".
  // The layer actually created by v27 is "true-near-utah-bluffs-v27", so the
  // enormous nearest cliff plane silently escaped both darkening passes.
  // Bake the grade into every texture canvas, then use stable unlit white
  // materials. This makes the result independent of exposure and scene lights.
  const bakeHorizonTextureGradeV30 = (
    objectNameV30: string,
    overlayV30: string,
    overlayAlphaV30: number,
    materialOpacityV30: number,
  ): void => {
    const objectV30 = context.scene.getObjectByName(objectNameV30)
    if (!(objectV30 instanceof THREE.Mesh) || Array.isArray(objectV30.material)) {
      throw new Error('Missing required horizon mesh: ' + objectNameV30)
    }

    const previousV30 = objectV30.material as THREE.Material & {
      map?: THREE.Texture | null
      alphaTest?: number
    }
    const mapV30 = previousV30.map ?? null
    const canvasV30 = mapV30?.image
    if (!(canvasV30 instanceof HTMLCanvasElement)) {
      throw new Error('Horizon texture is not canvas-backed: ' + objectNameV30)
    }

    const drawV30 = canvasV30.getContext('2d')
    if (!drawV30) throw new Error('Could not grade horizon canvas: ' + objectNameV30)
    drawV30.save()
    drawV30.globalCompositeOperation = 'source-atop'
    drawV30.globalAlpha = overlayAlphaV30
    drawV30.fillStyle = overlayV30
    drawV30.fillRect(0, 0, canvasV30.width, canvasV30.height)
    drawV30.restore()
    if (mapV30) mapV30.needsUpdate = true

    const replacementV30 = new THREE.MeshBasicMaterial({
      map: mapV30,
      color: 0xffffff,
      transparent: true,
      opacity: materialOpacityV30,
      alphaTest: previousV30.alphaTest ?? 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    })
    previousV30.dispose()
    objectV30.material = replacementV30
  }

  bakeHorizonTextureGradeV30('true-near-utah-bluffs-v27', '#292526', 0.72, 1)
  bakeHorizonTextureGradeV30('true-mid-utah-cliffs-v27', '#303033', 0.67, 0.96)
  bakeHorizonTextureGradeV30('true-far-utah-escarpment-v27', '#394043', 0.61, 0.9)

  // Grade the dry shelf itself rather than relying only on a lit material tint.
  for (const groundNameV30 of [
    'continuous-dry-north-country-v27',
    'north-country-transition-apron-v27',
  ]) {
    const groundV30 = context.scene.getObjectByName(groundNameV30)
    if (!(groundV30 instanceof THREE.Mesh) || Array.isArray(groundV30.material)) {
      throw new Error('Missing required dry horizon ground: ' + groundNameV30)
    }
    const materialV30 = groundV30.material as THREE.MeshStandardMaterial
    materialV30.color.setHex(0x3d3331)
    materialV30.roughness = 1
    materialV30.metalness = 0
    materialV30.needsUpdate = true
  }

`

  source = source.slice(0, warningIndex) + correction + source.slice(warningIndex)
  writeFileSync(dockTownPath, source)
  console.log('Corrected the near-layer name and baked the dark overcast horizon grade.')
} else {
  console.log('The corrected baked horizon grade is already applied.')
}
