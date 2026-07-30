import * as THREE from 'three'

export type ZombieAnimationState = 'walk' | 'run' | 'attack' | 'death'

export const ZOMBIE_DISPLAY_HEIGHT = 2.02
export const ZOMBIE_FORWARD_YAW = 0

export type ZombieVisual = {
  group: THREE.Group
  parts: THREE.Mesh[]
  animationState: ZombieAnimationState
  disposed: boolean
}

type ClothTextures = {
  shirt: THREE.CanvasTexture
  trousers: THREE.CanvasTexture
}

let clothTextures: ClothTextures | null = null

function makeClothTexture(
  base: string,
  seam: string,
  patch: string,
  tears: Array<[number, number, number, number]>,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const draw = canvas.getContext('2d')!
  draw.fillStyle = base
  draw.fillRect(0, 0, 64, 64)

  draw.globalAlpha = 0.34
  draw.strokeStyle = seam
  draw.lineWidth = 2
  for (let y = 8; y < 64; y += 11) {
    draw.beginPath()
    draw.moveTo(0, y)
    draw.lineTo(64, y + (y % 3) - 1)
    draw.stroke()
  }

  draw.globalAlpha = 0.48
  draw.fillStyle = patch
  draw.fillRect(7, 15, 17, 13)
  draw.fillRect(40, 36, 15, 18)
  draw.strokeStyle = seam
  draw.lineWidth = 1
  draw.strokeRect(7.5, 15.5, 16, 12)
  draw.strokeRect(40.5, 36.5, 14, 17)

  draw.globalAlpha = 0.74
  draw.fillStyle = '#151819'
  for (const [x, y, width, height] of tears) {
    draw.beginPath()
    draw.moveTo(x, y)
    draw.lineTo(x + width * 0.4, y + height)
    draw.lineTo(x + width, y + height * 0.4)
    draw.lineTo(x + width * 0.72, y)
    draw.closePath()
    draw.fill()
  }

  draw.globalAlpha = 0.18
  draw.fillStyle = '#d3d7d7'
  for (let index = 0; index < 48; index += 1) {
    draw.fillRect((index * 17) % 64, (index * 29) % 64, 1, 1)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.35, 1.35)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = true
  return texture
}

function getClothTextures(): ClothTextures | null {
  if (clothTextures) return clothTextures
  if (typeof document === 'undefined') return null
  clothTextures = {
    shirt: makeClothTexture(
      '#454a4b',
      '#252a2b',
      '#34393a',
      [[3, 49, 13, 11], [28, 53, 10, 9], [51, 45, 11, 13]],
    ),
    trousers: makeClothTexture(
      '#333839',
      '#1d2223',
      '#434849',
      [[9, 42, 10, 15], [33, 50, 12, 10], [53, 29, 8, 14]],
    ),
  }
  return clothTextures
}

function staticMaterial(
  color: number,
  map: THREE.Texture | null = null,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    map,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    emissive: 0x070809,
    emissiveIntensity: 0.08,
  })
  material.userData.baseEmissive = 0x070809
  material.userData.baseEmissiveIntensity = 0.08
  return material
}

function addPart(
  group: THREE.Group,
  parts: THREE.Mesh[],
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
): THREE.Mesh {
  const part = new THREE.Mesh(geometry, material)
  part.position.set(x, y, z)
  part.rotation.set(rotationX, rotationY, rotationZ)
  part.castShadow = false
  part.receiveShadow = false
  part.frustumCulled = true
  group.add(part)
  parts.push(part)
  return part
}

export const zombieAssetReady: Promise<boolean> = Promise.resolve(true)

export function isZombieAssetReady(): boolean {
  return true
}

export function didZombieAssetFail(): boolean {
  return false
}

export function createTexturedZombieVisual(): ZombieVisual {
  const textures = getClothTextures()
  const shade = Math.random() * 0.045 - 0.022
  const skin = staticMaterial(0x5a6061)
  const shirt = staticMaterial(0x656a6b, textures?.shirt ?? null)
  const trousers = staticMaterial(0x5d6263, textures?.trousers ?? null)
  const boots = staticMaterial(0x292d2e)
  for (const material of [skin, shirt, trousers, boots]) {
    material.color.offsetHSL(0, 0, shade)
  }

  const group = new THREE.Group()
  group.name = 'static-dark-gray-tattered-person'
  group.userData.flashActive = false
  const parts: THREE.Mesh[] = []

  addPart(group, parts, new THREE.BoxGeometry(0.56, 0.7, 0.3), shirt, 0, 1.28, 0)
  addPart(group, parts, new THREE.BoxGeometry(0.45, 0.24, 0.28), trousers, 0, 0.83, 0)

  const tailWidths = [0.17, 0.15, 0.18]
  for (let index = 0; index < tailWidths.length; index += 1) {
    const x = (index - 1) * 0.17
    const tail = addPart(
      group,
      parts,
      new THREE.BoxGeometry(tailWidths[index], 0.24 + index * 0.025, 0.25),
      shirt,
      x,
      0.87 - index * 0.018,
      0.015,
      0,
      0,
      (index - 1) * 0.07,
    )
    tail.scale.y = 0.86 + Math.random() * 0.15
  }

  addPart(group, parts, new THREE.CylinderGeometry(0.105, 0.12, 0.17, 7), skin, 0, 1.68, 0)
  addPart(group, parts, new THREE.DodecahedronGeometry(0.215, 0), skin, 0, 1.88, -0.005, 0.03)

  for (const side of [-1, 1]) {
    const shoulderX = side * 0.37
    addPart(
      group,
      parts,
      new THREE.BoxGeometry(0.17, 0.47, 0.2),
      shirt,
      shoulderX,
      1.29,
      0,
      0.05,
      0,
      side * 0.08,
    )
    addPart(
      group,
      parts,
      new THREE.BoxGeometry(0.145, 0.41, 0.17),
      side < 0 ? skin : shirt,
      side * 0.405,
      0.88,
      -0.015,
      -0.03,
      0,
      side * 0.025,
    )
    addPart(
      group,
      parts,
      new THREE.DodecahedronGeometry(0.105, 0),
      skin,
      side * 0.415,
      0.64,
      -0.02,
    )

    addPart(
      group,
      parts,
      new THREE.BoxGeometry(0.205, 0.7, 0.23),
      trousers,
      side * 0.145,
      0.43,
      0,
      side * 0.015,
      0,
      side * 0.018,
    )
    addPart(
      group,
      parts,
      new THREE.BoxGeometry(0.235, 0.12, 0.37),
      boots,
      side * 0.15,
      0.07,
      -0.075,
    )
  }

  group.rotation.y = ZOMBIE_FORWARD_YAW

  return {
    group,
    parts,
    animationState: Math.random() < 0.32 ? 'run' : 'walk',
    disposed: false,
  }
}

export function setZombieAnimation(
  visual: ZombieVisual,
  next: ZombieAnimationState,
  _playbackRate = 1,
): void {
  if (visual.disposed) return
  visual.animationState = next
}

export function advanceZombieAnimation(
  _visual: ZombieVisual,
  _dt: number,
  _distanceToPlayer: number,
): void {
  // Deliberately static. The person translates through the world but has no
  // walk, run, attack, idle, or death animation.
}

export function disposeZombieVisual(visual: ZombieVisual): void {
  if (visual.disposed) return
  visual.disposed = true
  const materials = new Set<THREE.Material>()
  for (const part of visual.parts) {
    const entries = Array.isArray(part.material) ? part.material : [part.material]
    for (const material of entries) materials.add(material)
  }
  for (const material of materials) material.dispose()
}
