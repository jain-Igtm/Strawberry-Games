import * as THREE from 'three'

export type ZombieAnimationState = 'walk' | 'run' | 'attack' | 'death'

export const ZOMBIE_DISPLAY_HEIGHT = 2.16
export const ZOMBIE_FORWARD_YAW = -Math.PI / 2

export type ZombieVisual = {
  group: THREE.Group
  parts: THREE.Mesh[]
  animationState: ZombieAnimationState
  disposed: boolean
}

let clothTexture: THREE.CanvasTexture | null = null

function makeClothTexture(): THREE.CanvasTexture {
  if (clothTexture) return clothTexture

  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 96
  const draw = canvas.getContext('2d')!
  draw.fillStyle = '#303537'
  draw.fillRect(0, 0, canvas.width, canvas.height)

  // Broad vertical folds, irregular stains, and stitched repairs keep the robes
  // visibly textured without introducing animation frames or expensive assets.
  for (let x = 4; x < canvas.width; x += 9) {
    const shade = 26 + ((x * 17) % 22)
    draw.globalAlpha = 0.22
    draw.fillStyle = `rgb(${shade},${shade + 3},${shade + 4})`
    draw.fillRect(x, 0, 3 + (x % 4), canvas.height)
  }

  draw.globalAlpha = 0.34
  draw.fillStyle = '#171b1c'
  draw.fillRect(11, 19, 21, 12)
  draw.fillRect(58, 47, 25, 16)
  draw.fillRect(25, 72, 18, 11)
  draw.strokeStyle = '#555d5f'
  draw.lineWidth = 1
  draw.strokeRect(11.5, 19.5, 20, 11)
  draw.strokeRect(58.5, 47.5, 24, 15)
  draw.strokeRect(25.5, 72.5, 17, 10)

  draw.globalAlpha = 0.28
  draw.fillStyle = '#72787a'
  for (let index = 0; index < 70; index += 1) {
    const x = (index * 37) % canvas.width
    const y = (index * 61) % canvas.height
    draw.fillRect(x, y, 1 + (index % 3), 1)
  }
  draw.globalAlpha = 1

  clothTexture = new THREE.CanvasTexture(canvas)
  clothTexture.colorSpace = THREE.SRGBColorSpace
  clothTexture.wrapS = THREE.RepeatWrapping
  clothTexture.wrapT = THREE.RepeatWrapping
  clothTexture.repeat.set(1.2, 2.1)
  clothTexture.minFilter = THREE.LinearMipmapLinearFilter
  clothTexture.magFilter = THREE.LinearFilter
  clothTexture.generateMipmaps = true
  return clothTexture
}

function clothMaterial(color: number, emissiveIntensity = 0.18): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    map: makeClothTexture(),
    roughness: 1,
    metalness: 0,
    flatShading: true,
    emissive: 0x0d1112,
    emissiveIntensity,
  })
  material.userData.baseEmissive = 0x0d1112
  material.userData.baseEmissiveIntensity = emissiveIntensity
  return material
}

function solidMaterial(
  color: number,
  emissive = 0x080a0a,
  emissiveIntensity = 0.12,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    emissive,
    emissiveIntensity,
    side: THREE.DoubleSide,
  })
  material.userData.baseEmissive = emissive
  material.userData.baseEmissiveIntensity = emissiveIntensity
  return material
}

function register(
  group: THREE.Group,
  parts: THREE.Mesh[],
  mesh: THREE.Mesh,
): THREE.Mesh {
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = true
  group.add(mesh)
  parts.push(mesh)
  return mesh
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
  group.name = 'static-hooded-gliding-figure'
  group.userData.flashActive = false

  const parts: THREE.Mesh[] = []
  const robeMaterial = clothMaterial(0x394044, 0.2)
  const hoodMaterial = clothMaterial(0x30363a, 0.17)
  const sleeveMaterial = clothMaterial(0x343b3f, 0.18)
  const handMaterial = solidMaterial(0x4a5052, 0x0c0f10, 0.14)
  const voidMaterial = solidMaterial(0x070909, 0x000000, 0)

  // A single floor-length robe replaces both legs. Its bottom edge stays on the
  // terrain while the whole group translates, so the figure visibly glides.
  const robe = register(
    group,
    parts,
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.68, 1.48, 8, 2, false),
      robeMaterial,
    ),
  )
  robe.position.y = 0.74

  // A broad cowl connects the robe, hood, and sleeves into one silhouette.
  const cowl = register(
    group,
    parts,
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.43, 0.34, 0.46, 8, 1, false),
      hoodMaterial,
    ),
  )
  cowl.position.y = 1.48

  const hood = register(
    group,
    parts,
    new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), hoodMaterial),
  )
  hood.position.set(0, 1.87, 0.015)
  hood.scale.set(1.02, 1.16, 1.0)

  // The face is only a recessed black opening; there are no eyes or facial
  // details that can turn the enemy into another mannequin-like character.
  const faceVoid = register(
    group,
    parts,
    new THREE.Mesh(new THREE.CircleGeometry(0.235, 16), voidMaterial),
  )
  faceVoid.position.set(0, 1.87, -0.365)
  faceVoid.rotation.y = Math.PI
  faceVoid.scale.set(0.9, 1.18, 1)

  // Both sleeves point along local -Z. Main.ts already rotates that local
  // direction toward the player's path, so the arms remain outstretched while
  // the body glides without a walk, run, or attack cycle.
  for (const side of [-1, 1]) {
    const shoulder = register(
      group,
      parts,
      new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), sleeveMaterial),
    )
    shoulder.position.set(side * 0.35, 1.54, -0.06)

    const sleeve = register(
      group,
      parts,
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.18, 0.9, 6, 1, false),
        sleeveMaterial,
      ),
    )
    sleeve.position.set(side * 0.35, 1.53, -0.48)
    sleeve.rotation.x = Math.PI / 2

    const hand = register(
      group,
      parts,
      new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 5), handMaterial),
    )
    hand.position.set(side * 0.35, 1.52, -0.94)
    hand.scale.set(0.82, 0.9, 1.18)
  }

  // A few overlapping cloth flaps break up the otherwise perfectly level hem.
  for (const [x, z, yaw] of [
    [-0.38, -0.18, -0.18],
    [-0.13, -0.3, -0.05],
    [0.16, -0.27, 0.08],
    [0.41, -0.12, 0.2],
  ] as Array<[number, number, number]>) {
    const flap = register(
      group,
      parts,
      new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), robeMaterial),
    )
    flap.position.set(x, 0.17, z)
    flap.rotation.set(-0.04, yaw, 0)
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
  // Deliberately empty: the floor-length figures only translate over terrain.
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
