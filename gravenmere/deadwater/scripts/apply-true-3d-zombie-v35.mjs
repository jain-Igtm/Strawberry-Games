import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const zombieModelPath = resolve(root, 'src/zombie-model.ts')

const zombieModel = `import * as THREE from 'three'

// DEADWATER_TRUE_3D_STATIC_INFECTED_V35
export type ZombieAnimationState = 'walk' | 'run' | 'attack' | 'death'

export const ZOMBIE_DISPLAY_HEIGHT = 2.28
export const ZOMBIE_FORWARD_YAW = 0
export const ZOMBIE_MESHES_PER_VISUAL = 1

export type ZombieVisual = {
  group: THREE.Group
  parts: THREE.Mesh[]
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  animationState: ZombieAnimationState
  deathProgress: number
  fallDirection: number
  disposed: boolean
}

let sharedGeometry: THREE.BufferGeometry | null = null
let sharedClothTexture: THREE.CanvasTexture | null = null

function clothTexture(): THREE.CanvasTexture {
  if (sharedClothTexture) return sharedClothTexture
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')!
  context.fillStyle = '#d2d2d0'
  context.fillRect(0, 0, 128, 128)

  // Deterministic broad weave, grime and worn fibres. It is generated once and
  // reused by every infected, adding surface depth without another downloaded asset.
  for (let y = 0; y < 128; y += 4) {
    context.globalAlpha = 0.08 + ((y * 13) % 7) * 0.01
    context.fillStyle = y % 8 === 0 ? '#5e6261' : '#f4f4f1'
    context.fillRect(0, y, 128, 1)
  }
  for (let x = 1; x < 128; x += 5) {
    context.globalAlpha = 0.035 + ((x * 17) % 5) * 0.008
    context.fillStyle = '#303332'
    context.fillRect(x, 0, 1, 128)
  }
  for (let index = 0; index < 320; index += 1) {
    const x = (index * 73 + 17) % 128
    const y = (index * 47 + 29) % 128
    const value = 70 + ((index * 31) % 145)
    context.globalAlpha = 0.05 + (index % 5) * 0.012
    context.fillStyle = 'rgb(' + value + ',' + value + ',' + Math.max(0, value - 4) + ')'
    context.fillRect(x, y, 1 + (index % 3), 1)
  }
  context.globalAlpha = 1

  sharedClothTexture = new THREE.CanvasTexture(canvas)
  sharedClothTexture.colorSpace = THREE.SRGBColorSpace
  sharedClothTexture.wrapS = THREE.RepeatWrapping
  sharedClothTexture.wrapT = THREE.RepeatWrapping
  sharedClothTexture.repeat.set(2.2, 3.6)
  sharedClothTexture.minFilter = THREE.LinearMipmapLinearFilter
  sharedClothTexture.magFilter = THREE.LinearFilter
  sharedClothTexture.generateMipmaps = true
  return sharedClothTexture
}

function appendGeometry(
  positions: number[],
  normals: number[],
  colors: number[],
  uvs: number[],
  geometry: THREE.BufferGeometry,
  color: number,
  position: THREE.Vector3,
  rotation = new THREE.Euler(),
  scale = new THREE.Vector3(1, 1, 1),
): void {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  const matrix = new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromEuler(rotation),
    scale,
  )
  source.applyMatrix4(matrix)
  source.computeVertexNormals()

  const sourcePosition = source.getAttribute('position')
  const sourceNormal = source.getAttribute('normal')
  const sourceUv = source.getAttribute('uv')
  const tint = new THREE.Color(color)
  for (let index = 0; index < sourcePosition.count; index += 1) {
    positions.push(
      sourcePosition.getX(index),
      sourcePosition.getY(index),
      sourcePosition.getZ(index),
    )
    normals.push(sourceNormal.getX(index), sourceNormal.getY(index), sourceNormal.getZ(index))
    colors.push(tint.r, tint.g, tint.b)
    if (sourceUv) uvs.push(sourceUv.getX(index), sourceUv.getY(index))
    else uvs.push(0, 0)
  }
  source.dispose()
  geometry.dispose()
}

function appendLimb(
  positions: number[],
  normals: number[],
  colors: number[],
  uvs: number[],
  from: THREE.Vector3,
  to: THREE.Vector3,
  radiusTop: number,
  radiusBottom: number,
  color: number,
  segments = 7,
): void {
  const midpoint = from.clone().add(to).multiplyScalar(0.5)
  const direction = to.clone().sub(from)
  const length = direction.length()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  )
  appendGeometry(
    positions,
    normals,
    colors,
    uvs,
    new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments, 2, false),
    color,
    midpoint,
    new THREE.Euler().setFromQuaternion(quaternion),
  )
}

function buildSharedGeometry(): THREE.BufferGeometry {
  if (sharedGeometry) return sharedGeometry

  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const add = (
    geometry: THREE.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0,
    scaleX = 1,
    scaleY = 1,
    scaleZ = 1,
  ): void => appendGeometry(
    positions,
    normals,
    colors,
    uvs,
    geometry,
    color,
    new THREE.Vector3(x, y, z),
    new THREE.Euler(rotationX, rotationY, rotationZ),
    new THREE.Vector3(scaleX, scaleY, scaleZ),
  )
  const limb = (
    from: [number, number, number],
    to: [number, number, number],
    radiusTop: number,
    radiusBottom: number,
    color: number,
    segments = 7,
  ): void => appendLimb(
    positions,
    normals,
    colors,
    uvs,
    new THREE.Vector3(...from),
    new THREE.Vector3(...to),
    radiusTop,
    radiusBottom,
    color,
    segments,
  )

  const shirt = 0x252a2b
  const shirtShadow = 0x171b1c
  const shirtWear = 0x383d3d
  const trousers = 0x1b1f20
  const trouserWear = 0x303536
  const boots = 0x101213
  const skin = 0x858c88
  const skinShadow = 0x555d5a
  const hair = 0x090a0a
  const faceVoid = 0x101313
  const eye = 0x50d5d6

  // Feet and legs use separate angled sections, giving the still pose weight and
  // keeping the silhouette human when viewed from the side instead of as a card.
  add(new THREE.BoxGeometry(0.22, 0.14, 0.42), boots, -0.18, 0.075, -0.09, 0.02, 0.02, -0.015)
  add(new THREE.BoxGeometry(0.22, 0.14, 0.43), boots, 0.19, 0.075, -0.16, -0.025, -0.025, 0.02)
  limb([-0.18, 0.14, 0.02], [-0.20, 0.68, 0.055], 0.105, 0.125, trousers)
  limb([0.19, 0.14, -0.01], [0.16, 0.68, -0.06], 0.105, 0.125, trousers)
  limb([-0.20, 0.67, 0.055], [-0.17, 1.15, 0.10], 0.135, 0.165, trouserWear)
  limb([0.16, 0.67, -0.06], [0.18, 1.15, 0.075], 0.135, 0.165, trousers)
  add(new THREE.CylinderGeometry(0.23, 0.29, 0.34, 8, 2, false), trousers, 0, 1.19, 0.09, 0.10)

  // Slim torso leaned slightly away from the hips. The shoulder shell and chest
  // overlap to remove the mannequin seams that made the earlier mesh look assembled.
  add(new THREE.CylinderGeometry(0.34, 0.225, 0.70, 8, 3, false), shirt, 0, 1.54, 0.11, 0.105)
  add(new THREE.SphereGeometry(0.36, 9, 6), shirtShadow, 0, 1.73, 0.13, 0.08, 0, 0, 1.03, 0.55, 0.76)
  add(new THREE.BoxGeometry(0.30, 0.28, 0.025), shirtWear, -0.055, 1.50, -0.215, -0.08, 0.03, -0.04)
  add(new THREE.BoxGeometry(0.12, 0.20, 0.03), shirtShadow, 0.16, 1.39, -0.205, -0.12, -0.05, 0.08)
  add(new THREE.BoxGeometry(0.11, 0.08, 0.045), shirtWear, -0.15, 1.23, -0.17, -0.10, 0.04, -0.12)

  // Asymmetric arms hang forward naturally. Neither is mirrored exactly, which
  // prevents the rigid T-pose/mannequin reading even though no animation runs.
  limb([-0.30, 1.72, 0.10], [-0.39, 1.39, -0.07], 0.115, 0.145, shirt)
  limb([-0.39, 1.39, -0.07], [-0.48, 1.06, -0.28], 0.085, 0.115, shirtShadow)
  limb([0.30, 1.72, 0.11], [0.42, 1.42, -0.10], 0.115, 0.145, shirtShadow)
  limb([0.42, 1.42, -0.10], [0.36, 1.08, -0.39], 0.082, 0.112, shirt)
  add(new THREE.DodecahedronGeometry(0.105, 0), skinShadow, -0.50, 0.99, -0.34, 0.05, 0.03, -0.10, 0.85, 1.18, 0.82)
  add(new THREE.DodecahedronGeometry(0.105, 0), skin, 0.35, 1.00, -0.46, -0.05, -0.03, 0.12, 0.82, 1.20, 0.86)

  // Neck and head are offset forward and down. A recessed face plane, cheek mass,
  // brow, hair cap and fringe create actual depth rather than painting it on.
  add(new THREE.CylinderGeometry(0.105, 0.12, 0.20, 7, 1, false), skinShadow, 0, 1.89, 0.09, 0.18)
  add(new THREE.SphereGeometry(0.245, 9, 7), skin, 0, 2.08, 0.015, -0.13, 0, 0, 0.87, 1.12, 0.88)
  add(new THREE.SphereGeometry(0.215, 8, 5), hair, 0, 2.18, 0.035, -0.08, 0, 0, 1.02, 0.72, 0.95)
  add(new THREE.CircleGeometry(0.17, 12), faceVoid, 0, 2.055, -0.195, 0, Math.PI, 0, 0.82, 1.02, 1)
  add(new THREE.BoxGeometry(0.30, 0.075, 0.06), hair, 0.005, 2.18, -0.17, -0.09, 0.01, 0.02)
  add(new THREE.BoxGeometry(0.075, 0.16, 0.055), hair, -0.11, 2.12, -0.185, -0.16, 0.02, -0.06)
  add(new THREE.BoxGeometry(0.065, 0.13, 0.05), hair, 0.10, 2.14, -0.19, -0.10, -0.02, 0.08)
  add(new THREE.SphereGeometry(0.026, 6, 4), eye, -0.061, 2.075, -0.218, 0, 0, 0, 1.15, 0.72, 0.58)
  add(new THREE.SphereGeometry(0.023, 6, 4), eye, 0.061, 2.078, -0.219, 0, 0, 0, 1.05, 0.68, 0.55)
  add(new THREE.BoxGeometry(0.12, 0.025, 0.026), skinShadow, 0.012, 1.985, -0.221, -0.04)

  // Torn cuffs, knee wear and a broken shirt hem add irregularity without gore.
  add(new THREE.BoxGeometry(0.17, 0.055, 0.16), shirtWear, -0.43, 1.19, -0.20, -0.28, 0.10, -0.12)
  add(new THREE.BoxGeometry(0.16, 0.052, 0.15), shirtWear, 0.39, 1.23, -0.27, -0.36, -0.08, 0.08)
  add(new THREE.BoxGeometry(0.17, 0.045, 0.16), trouserWear, -0.20, 0.64, -0.08, -0.03, 0.08, 0.03)
  add(new THREE.BoxGeometry(0.16, 0.042, 0.15), trouserWear, 0.16, 0.69, -0.15, 0.04, -0.06, -0.02)
  add(new THREE.ConeGeometry(0.12, 0.22, 5, 1, true), shirtShadow, -0.18, 1.18, -0.02, Math.PI, 0.1, 0.08, 1, 0.65, 0.55)
  add(new THREE.ConeGeometry(0.11, 0.20, 5, 1, true), shirt, 0.18, 1.18, 0.00, Math.PI, -0.12, -0.06, 1, 0.62, 0.50)

  sharedGeometry = new THREE.BufferGeometry()
  sharedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  sharedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  sharedGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  sharedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  sharedGeometry.computeBoundingBox()
  sharedGeometry.computeBoundingSphere()
  return sharedGeometry
}

function makeMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: clothTexture(),
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
    emissive: 0x061011,
    emissiveIntensity: 0.16,
  })
  material.userData.baseEmissive = 0x061011
  material.userData.baseEmissiveIntensity = 0.16
  return material
}

export const zombieAssetReady: Promise<boolean> = Promise.resolve(true)

export function isZombieAssetReady(): boolean {
  return true
}

export function didZombieAssetFail(): boolean {
  return false
}

export function createTexturedZombieVisual(): ZombieVisual {
  const group = new THREE.Group()
  group.name = 'true-3d-static-infected-v35'
  group.userData.flashActive = false

  const mesh = new THREE.Mesh(buildSharedGeometry(), makeMaterial())
  mesh.name = 'single-draw-real-depth-infected'
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = true
  group.add(mesh)
  group.rotation.y = ZOMBIE_FORWARD_YAW

  return {
    group,
    parts: [mesh],
    mesh,
    animationState: Math.random() < 0.32 ? 'run' : 'walk',
    deathProgress: 0,
    fallDirection: Math.random() < 0.5 ? -1 : 1,
    disposed: false,
  }
}

export function setZombieAnimation(
  visual: ZombieVisual,
  next: ZombieAnimationState,
  _playbackRate = 1,
): void {
  if (visual.disposed || visual.animationState === 'death' || visual.animationState === next) return
  visual.animationState = next
}

export function showZombieHit(_visual: ZombieVisual): void {
  // Hit colour is driven by main.ts's existing flash timer. No pose calculation.
}

export function beginZombieDeath(visual: ZombieVisual): void {
  if (visual.disposed) return
  visual.animationState = 'death'
  visual.deathProgress = 0
  visual.mesh.material.color.setHex(0xc9aaa4)
  visual.mesh.material.emissive.setHex(0x4b100d)
  visual.mesh.material.emissiveIntensity = 0.55
}

export function advanceZombieAnimation(
  visual: ZombieVisual,
  dt: number,
  _distanceToPlayer: number,
): void {
  if (visual.disposed || visual.animationState !== 'death') return
  visual.deathProgress = Math.min(1, visual.deathProgress + dt / 0.60)
  const fall = 1 - Math.pow(1 - visual.deathProgress, 3)
  visual.mesh.rotation.x = fall * 1.42
  visual.mesh.rotation.z = fall * visual.fallDirection * 0.22
  visual.mesh.position.y = -fall * 0.18
  visual.mesh.position.z = -fall * 0.12
  visual.mesh.material.emissiveIntensity = Math.max(0.05, (1 - fall) * 0.55)
}

export function disposeZombieVisual(visual: ZombieVisual): void {
  if (visual.disposed) return
  visual.disposed = true
  visual.mesh.material.dispose()
  // Geometry and cloth texture remain shared across the full horde and session.
}
`

if (readFileSync(zombieModelPath, 'utf8') !== zombieModel) {
  writeFileSync(zombieModelPath, zombieModel)
  console.log('Installed the true 3D static infected: one shared mesh, no rig or animation mixer.')
} else {
  console.log('The true 3D static infected pass is already applied.')
}
