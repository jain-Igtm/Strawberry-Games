import * as THREE from 'three'

export type ZombieAnimationState = 'walk' | 'run' | 'attack' | 'death'

export const ZOMBIE_DISPLAY_HEIGHT = 2.08
export const ZOMBIE_FORWARD_YAW = -Math.PI / 2

export type ZombieVisual = {
  group: THREE.Group
  parts: THREE.Mesh[]
  animationState: ZombieAnimationState
  disposed: boolean
}

let figureTexture: THREE.CanvasTexture | null = null

function makeFigureTexture(): THREE.CanvasTexture {
  if (figureTexture) return figureTexture

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const draw = canvas.getContext('2d')!
  draw.clearRect(0, 0, canvas.width, canvas.height)
  draw.lineJoin = 'round'
  draw.lineCap = 'round'

  const fillOutlined = (fill: string): void => {
    draw.fillStyle = fill
    draw.fill()
    draw.strokeStyle = '#171b1c'
    draw.lineWidth = 4
    draw.stroke()
  }

  // Rear coat shadow gives the silhouette a connected human shape.
  draw.beginPath()
  draw.moveTo(38, 62)
  draw.lineTo(27, 89)
  draw.lineTo(33, 151)
  draw.lineTo(40, 184)
  draw.lineTo(52, 175)
  draw.lineTo(62, 188)
  draw.lineTo(73, 176)
  draw.lineTo(87, 186)
  draw.lineTo(96, 148)
  draw.lineTo(101, 88)
  draw.lineTo(89, 62)
  draw.closePath()
  fillOutlined('#303638')

  // Head and neck. Kept deliberately plain and gray rather than monster-faced.
  draw.fillStyle = '#555d5f'
  draw.beginPath()
  draw.arc(65, 39, 18, 0, Math.PI * 2)
  draw.fill()
  draw.strokeStyle = '#171b1c'
  draw.lineWidth = 4
  draw.stroke()
  draw.fillStyle = '#4b5355'
  draw.fillRect(57, 51, 16, 17)

  // Ragged coat front.
  draw.beginPath()
  draw.moveTo(39, 65)
  draw.lineTo(53, 57)
  draw.lineTo(76, 58)
  draw.lineTo(91, 68)
  draw.lineTo(88, 153)
  draw.lineTo(82, 184)
  draw.lineTo(72, 174)
  draw.lineTo(64, 188)
  draw.lineTo(55, 175)
  draw.lineTo(45, 185)
  draw.lineTo(40, 151)
  draw.closePath()
  fillOutlined('#3b4244')

  // Left arm: hanging, slightly crooked, torn above the wrist.
  draw.beginPath()
  draw.moveTo(39, 69)
  draw.lineTo(27, 78)
  draw.lineTo(20, 126)
  draw.lineTo(27, 159)
  draw.lineTo(39, 155)
  draw.lineTo(37, 124)
  draw.lineTo(45, 82)
  draw.closePath()
  fillOutlined('#353c3e')
  draw.fillStyle = '#545c5e'
  draw.beginPath()
  draw.moveTo(25, 155)
  draw.lineTo(36, 153)
  draw.lineTo(38, 171)
  draw.lineTo(28, 177)
  draw.lineTo(22, 168)
  draw.closePath()
  draw.fill()

  // Right arm: longer torn sleeve with the hand visible.
  draw.beginPath()
  draw.moveTo(90, 69)
  draw.lineTo(102, 80)
  draw.lineTo(108, 126)
  draw.lineTo(101, 158)
  draw.lineTo(89, 154)
  draw.lineTo(92, 122)
  draw.lineTo(84, 82)
  draw.closePath()
  fillOutlined('#333a3c')
  draw.fillStyle = '#525a5c'
  draw.beginPath()
  draw.moveTo(92, 153)
  draw.lineTo(103, 156)
  draw.lineTo(106, 170)
  draw.lineTo(99, 178)
  draw.lineTo(90, 170)
  draw.closePath()
  draw.fill()

  // Separated legs make the figure read as a person at distance.
  draw.beginPath()
  draw.moveTo(44, 174)
  draw.lineTo(61, 174)
  draw.lineTo(59, 229)
  draw.lineTo(50, 245)
  draw.lineTo(37, 242)
  draw.lineTo(40, 219)
  draw.closePath()
  fillOutlined('#292f31')

  draw.beginPath()
  draw.moveTo(67, 174)
  draw.lineTo(84, 174)
  draw.lineTo(90, 222)
  draw.lineTo(91, 242)
  draw.lineTo(77, 246)
  draw.lineTo(68, 229)
  draw.closePath()
  fillOutlined('#272d2f')

  // Flat boot shapes avoid the block-foot look of the rejected mannequin.
  draw.fillStyle = '#171b1c'
  draw.beginPath()
  draw.moveTo(37, 238)
  draw.lineTo(51, 239)
  draw.lineTo(60, 248)
  draw.lineTo(34, 250)
  draw.closePath()
  draw.fill()
  draw.beginPath()
  draw.moveTo(77, 239)
  draw.lineTo(91, 237)
  draw.lineTo(99, 247)
  draw.lineTo(76, 250)
  draw.closePath()
  draw.fill()

  // Patches, seams, and a few cut-out tears. Low detail, but visibly tattered.
  draw.strokeStyle = '#22282a'
  draw.lineWidth = 2
  draw.beginPath()
  draw.moveTo(48, 91)
  draw.lineTo(81, 91)
  draw.moveTo(51, 126)
  draw.lineTo(78, 131)
  draw.moveTo(58, 62)
  draw.lineTo(57, 169)
  draw.stroke()

  draw.fillStyle = '#51585a'
  draw.fillRect(68, 103, 14, 19)
  draw.fillRect(43, 137, 12, 15)
  draw.strokeStyle = '#252b2d'
  draw.lineWidth = 1
  draw.strokeRect(68.5, 103.5, 13, 18)
  draw.strokeRect(43.5, 137.5, 11, 14)

  draw.globalCompositeOperation = 'destination-out'
  draw.beginPath()
  draw.moveTo(38, 109)
  draw.lineTo(47, 114)
  draw.lineTo(40, 124)
  draw.closePath()
  draw.fill()
  draw.beginPath()
  draw.moveTo(84, 143)
  draw.lineTo(91, 151)
  draw.lineTo(83, 162)
  draw.closePath()
  draw.fill()
  draw.beginPath()
  draw.moveTo(72, 199)
  draw.lineTo(82, 205)
  draw.lineTo(75, 217)
  draw.closePath()
  draw.fill()
  draw.globalCompositeOperation = 'source-over'

  figureTexture = new THREE.CanvasTexture(canvas)
  figureTexture.colorSpace = THREE.SRGBColorSpace
  figureTexture.wrapS = THREE.ClampToEdgeWrapping
  figureTexture.wrapT = THREE.ClampToEdgeWrapping
  figureTexture.minFilter = THREE.LinearMipmapLinearFilter
  figureTexture.magFilter = THREE.LinearFilter
  figureTexture.generateMipmaps = true
  return figureTexture
}

function makeFigureMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: makeFigureTexture(),
    transparent: true,
    alphaTest: 0.18,
    side: THREE.DoubleSide,
    depthWrite: true,
    roughness: 1,
    metalness: 0,
    emissive: 0x101415,
    emissiveIntensity: 0.26,
  })
  material.userData.baseEmissive = 0x101415
  material.userData.baseEmissiveIntensity = 0.26
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
  const material = makeFigureMaterial()
  const group = new THREE.Group()
  group.name = 'static-textured-dark-gray-person'
  group.userData.flashActive = false

  const parts: THREE.Mesh[] = []
  const geometry = new THREE.PlaneGeometry(1.05, ZOMBIE_DISPLAY_HEIGHT)
  geometry.translate(0, ZOMBIE_DISPLAY_HEIGHT / 2, 0)

  for (const rotation of [0, Math.PI / 2]) {
    const card = new THREE.Mesh(geometry, material)
    card.rotation.y = rotation
    card.castShadow = false
    card.receiveShadow = false
    card.frustumCulled = true
    group.add(card)
    parts.push(card)
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
  // The textured figure translates through the world without any sprite frames,
  // limb motion, attack motion, idle cycle, or death animation.
}

export function disposeZombieVisual(visual: ZombieVisual): void {
  if (visual.disposed) return
  visual.disposed = true
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  for (const part of visual.parts) {
    geometries.add(part.geometry)
    const entries = Array.isArray(part.material) ? part.material : [part.material]
    for (const material of entries) materials.add(material)
  }
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}
