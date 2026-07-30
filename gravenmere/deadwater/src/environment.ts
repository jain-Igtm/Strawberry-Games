import * as THREE from 'three'
import { WEAPONS, type WeaponId } from './weapons'

export type EnvironmentMaterials = {
  concrete: THREE.MeshStandardMaterial
  cracked: THREE.MeshStandardMaterial
  rust: THREE.MeshStandardMaterial
  darkRust: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  blackMetal: THREE.MeshStandardMaterial
  warning: THREE.MeshStandardMaterial
  ember: THREE.MeshBasicMaterial
}

export type WeaponPickup = {
  group: THREE.Group
  weaponId: WeaponId
  active: boolean
  baseY: number
  phase: number
}

type BuildContext = {
  scene: THREE.Scene
  materials: EnvironmentMaterials
  shotTargets: THREE.Object3D[]
  addCollider: (x: number, z: number, width: number, depth: number, padding?: number) => void
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const result = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  result.position.set(x, y, z)
  return result
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const result = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  )
  result.position.set(x, y, z)
  return result
}

function makeLabelMaterial(text: string, accent: number): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const draw = canvas.getContext('2d')!
  draw.fillStyle = '#120a08'
  draw.fillRect(0, 0, 512, 128)
  draw.strokeStyle = `#${accent.toString(16).padStart(6, '0')}`
  draw.lineWidth = 9
  draw.strokeRect(7, 7, 498, 114)
  draw.fillStyle = '#ead8c4'
  draw.font = '900 43px ui-monospace, monospace'
  draw.textAlign = 'center'
  draw.textBaseline = 'middle'
  draw.fillText(text, 256, 67)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75 })
}

// DEADWATER_ENTERABLE_BUILDINGS_V5
function addServiceBuilding(
  context: BuildContext,
  x: number,
  z: number,
  width: number,
  depth: number,
  name: string,
  rotation = 0,
): void {
  const { materials, scene } = context
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation

  const addWall = (
    wallWidth: number,
    wallHeight: number,
    wallDepth: number,
    localX: number,
    localY: number,
    localZ: number,
    material: THREE.Material,
  ): void => {
    const wall = box(wallWidth, wallHeight, wallDepth, material, localX, localY, localZ)
    wall.userData.blocksShot = true
    group.add(wall)
    context.shotTargets.push(wall)
    const cosine = Math.cos(rotation)
    const sine = Math.sin(rotation)
    const centerX = x + localX * cosine + localZ * sine
    const centerZ = z - localX * sine + localZ * cosine
    const rotated = Math.abs(sine) > 0.5
    context.addCollider(
      centerX,
      centerZ,
      rotated ? wallDepth : wallWidth,
      rotated ? wallWidth : wallDepth,
      0.06,
    )
  }

  const wallHeight = 4.8
  const thickness = 0.28
  const doorway = 2.35
  const frontSegment = (width - doorway) / 2
  const floor = box(width, 0.2, depth, materials.concrete, 0, 0.1, 0)
  const roof = box(width + 0.7, 0.34, depth + 0.7, materials.blackMetal, 0, 4.94, 0)
  group.add(floor, roof)

  addWall(width, wallHeight, thickness, 0, 2.5, depth / 2, materials.darkRust)
  addWall(thickness, wallHeight, depth, -width / 2, 2.5, 0, materials.darkRust)
  addWall(thickness, wallHeight, depth, width / 2, 2.5, 0, materials.darkRust)
  addWall(
    frontSegment,
    wallHeight,
    thickness,
    -width / 2 + frontSegment / 2,
    2.5,
    -depth / 2,
    materials.rust,
  )
  addWall(
    frontSegment,
    wallHeight,
    thickness,
    width / 2 - frontSegment / 2,
    2.5,
    -depth / 2,
    materials.rust,
  )

  const awning = box(3.6, 0.18, 1.25, materials.metal, 0, 3.25, -depth / 2 - 0.56)
  awning.rotation.x = -0.08
  const vent = cylinder(0.46, 0.46, 1.6, 10, materials.metal, width * 0.28, 5.75, 0)
  const ventCap = cylinder(0.68, 0.45, 0.4, 10, materials.rust, width * 0.28, 6.65, 0)
  const sign = box(
    Math.min(width - 1.2, 6.7),
    1.05,
    0.14,
    makeLabelMaterial(name, 0x9f4829),
    0,
    3.9,
    -depth / 2 - 0.13,
  )
  group.add(awning, vent, ventCap, sign)

  const paneMaterial = new THREE.MeshStandardMaterial({
    color: 0x251816,
    emissive: 0x5b1d0f,
    emissiveIntensity: 0.48,
    roughness: 0.35,
    metalness: 0.1,
  })
  for (const side of [-1, 1]) {
    const windowFrame = box(1.35, 1.25, 0.16, materials.metal, side * width * 0.27, 2.65, -depth / 2 - 0.11)
    const pane = box(1.05, 0.95, 0.18, paneMaterial, side * width * 0.27, 2.65, -depth / 2 - 0.21)
    group.add(windowFrame, pane)
  }

  group.add(box(1.8, 0.9, 0.8, materials.blackMetal, -width * 0.24, 0.55, depth * 0.18))
  group.add(box(1.1, 1.45, 1.1, materials.metal, width * 0.26, 0.74, depth * 0.16))
  const ceilingLight = new THREE.MeshStandardMaterial({
    color: 0xb84c26,
    emissive: 0xff4b1c,
    emissiveIntensity: 1.1,
    roughness: 0.42,
  })
  group.add(box(1.3, 0.11, 0.38, ceilingLight, 0, 4.45, 0))
  scene.add(group)
}

function addPipeBridge(
  context: BuildContext,
  x: number,
  z: number,
  span: number,
  rotation = 0,
): void {
  const { scene, materials } = context
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation
  const deck = box(span, 0.24, 1.7, materials.metal, 0, 4.45, 0)
  const pipeA = cylinder(0.25, 0.25, span, 10, materials.rust, 0, 5.35, -0.48)
  const pipeB = cylinder(0.18, 0.18, span, 10, materials.darkRust, 0, 5.05, 0.48)
  pipeA.rotation.z = Math.PI / 2
  pipeB.rotation.z = Math.PI / 2
  group.add(deck, pipeA, pipeB)
  for (const side of [-span / 2 + 0.8, span / 2 - 0.8]) {
    group.add(box(0.35, 4.5, 0.35, materials.blackMetal, side, 2.25, 0))
    group.add(box(0.95, 0.26, 2.2, materials.concrete, side, 0.13, 0))
  }
  for (let offset = -span / 2 + 1.4; offset <= span / 2 - 1.4; offset += 2.3) {
    group.add(box(0.09, 1.2, 0.09, materials.rust, offset, 5.05, -0.78))
    group.add(box(0.09, 1.2, 0.09, materials.rust, offset, 5.05, 0.78))
  }
  scene.add(group)
}

function addSubstation(context: BuildContext, x: number, z: number): void {
  const { scene, materials } = context
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  const slab = box(12, 0.25, 9, materials.concrete, 0, 0.125, 0)
  group.add(slab)
  for (const offsetX of [-3.3, 0, 3.3]) {
    const transformer = box(2.15, 2.4, 2.4, materials.metal, offsetX, 1.35, 0)
    const cap = cylinder(0.52, 0.52, 0.75, 10, materials.darkRust, offsetX - 0.48, 2.92, 0)
    const capB = cylinder(0.52, 0.52, 0.75, 10, materials.darkRust, offsetX + 0.48, 2.92, 0)
    group.add(transformer, cap, capB)
  }
  for (const sideZ of [-4.25, 4.25]) {
    group.add(box(12.4, 1.65, 0.08, materials.blackMetal, 0, 1.0, sideZ))
    for (let post = -6; post <= 6; post += 2) {
      group.add(box(0.09, 2.05, 0.09, materials.rust, post, 1.05, sideZ))
    }
  }
  for (const sideX of [-6.15, 6.15]) {
    group.add(box(0.08, 1.65, 8.5, materials.blackMetal, sideX, 1.0, 0))
  }
  scene.add(group)
  context.addCollider(x - 3.3, z, 2.15, 2.4, 0.18)
  context.addCollider(x, z, 2.15, 2.4, 0.18)
  context.addCollider(x + 3.3, z, 2.15, 2.4, 0.18)
}

function addScrubCluster(
  scene: THREE.Scene,
  x: number,
  z: number,
  scale: number,
  phase: number,
): void {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = phase
  const branchMaterial = new THREE.MeshStandardMaterial({ color: 0x2b211b, roughness: 1 })
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: phase % 2 > 1 ? 0x39412d : 0x45402b,
    roughness: 1,
  })
  const dryMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3a27, roughness: 1 })
  const trunk = cylinder(0.08 * scale, 0.12 * scale, 0.9 * scale, 6, branchMaterial, 0, 0.45 * scale, 0)
  trunk.rotation.z = (Math.random() - 0.5) * 0.25
  group.add(trunk)
  const lobes = [
    [-0.34, 0.73, 0.02, 0.52],
    [0.3, 0.68, -0.08, 0.48],
    [0.02, 0.98, 0.06, 0.55],
    [-0.02, 0.5, -0.2, 0.4],
  ] as const
  for (let index = 0; index < lobes.length; index += 1) {
    const [lx, ly, lz, size] = lobes[index]
    const crown = new THREE.Mesh(
      new THREE.DodecahedronGeometry(size * scale, 0),
      index === lobes.length - 1 ? dryMaterial : leafMaterial,
    )
    crown.position.set(lx * scale, ly * scale, lz * scale)
    crown.scale.set(1, 0.72, 0.78)
    crown.rotation.set(Math.random(), Math.random(), Math.random())
    group.add(crown)
  }
  scene.add(group)
}

function addStreetLight(context: BuildContext, x: number, z: number, rotation = 0): void {
  const { scene, materials } = context
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation
  const post = box(0.18, 5.2, 0.18, materials.blackMetal, 0, 2.6, 0)
  const arm = box(1.8, 0.14, 0.14, materials.rust, 0.78, 5.05, 0)
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xe26a2e,
    emissive: 0xff4b19,
    emissiveIntensity: 1.6,
    roughness: 0.35,
  })
  const lamp = box(0.48, 0.18, 0.34, lampMaterial, 1.55, 4.86, 0)
  group.add(post, arm, lamp)
  scene.add(group)
}

function addWeaponPickup(
  context: BuildContext,
  weaponId: WeaponId,
  x: number,
  z: number,
  rotation = 0,
): WeaponPickup {
  const { scene, materials } = context
  const definition = WEAPONS[weaponId]
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: definition.accent,
    emissive: definition.accent,
    emissiveIntensity: 0.65,
    roughness: 0.52,
    metalness: 0.42,
  })
  const pedestal = box(1.9, 0.85, 1.2, materials.blackMetal, 0, 0.43, 0)
  const top = box(2.15, 0.14, 1.42, accentMaterial, 0, 0.92, 0)
  const label = box(2.1, 0.46, 0.08, makeLabelMaterial(definition.name, definition.accent), 0, 0.55, -0.65)
  group.add(pedestal, top, label)

  const weapon = new THREE.Group()
  const length = weaponId === 'smg' ? 1.25 : weaponId === 'shotgun' ? 2.2 : weaponId === 'marksman' ? 2.35 : 1.75
  const body = box(length * 0.55, 0.2, 0.24, materials.blackMetal, 0, 0, 0)
  const barrel = cylinder(0.05, 0.05, length * 0.62, 8, materials.metal, length * 0.45, 0, 0)
  barrel.rotation.z = Math.PI / 2
  const stock = box(length * 0.28, 0.26, 0.25, materials.darkRust, -length * 0.38, -0.02, 0)
  const grip = box(0.17, 0.38, 0.18, materials.rust, -0.08, -0.22, 0)
  grip.rotation.z = -0.2
  weapon.add(body, barrel, stock, grip)
  if (weaponId === 'shotgun') {
    const pump = box(0.48, 0.18, 0.31, accentMaterial, 0.48, -0.03, 0)
    weapon.add(pump)
  } else if (weaponId === 'marksman') {
    const scope = cylinder(0.11, 0.11, 0.55, 10, accentMaterial, 0.05, 0.24, 0)
    scope.rotation.z = Math.PI / 2
    weapon.add(scope)
  } else if (weaponId === 'smg') {
    const magazine = box(0.17, 0.48, 0.2, accentMaterial, 0.05, -0.28, 0)
    weapon.add(magazine)
  }
  weapon.position.set(0, 1.42, 0)
  weapon.rotation.y = Math.PI / 2
  group.add(weapon)

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: definition.accent,
    transparent: true,
    opacity: 0.72,
  })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 6, 24), ringMaterial)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 1.12
  group.add(ring)

  scene.add(group)
  return {
    group,
    weaponId,
    active: true,
    baseY: 0,
    phase: Math.random() * Math.PI * 2,
  }
}

export function buildExpandedInfrastructure(context: BuildContext): WeaponPickup[] {
  addServiceBuilding(context, -6, 32, 10, 7, 'MAINTENANCE', 0)
  addServiceBuilding(context, 39, -20, 8, 6.5, 'SECURITY', Math.PI / 2)
  addServiceBuilding(context, -44, 17, 8.5, 7, 'CONTROL', Math.PI / 2)
  addServiceBuilding(context, 17, -37, 10.5, 7.5, 'GENERATOR', 0)
  addServiceBuilding(context, 45, 22, 7, 6, 'DOCK OFFICE', Math.PI / 2)

  addPipeBridge(context, -14, -7, 18, 0)
  addPipeBridge(context, 11, 17, 15, Math.PI / 2)
  addSubstation(context, 17, -25)

  const lampPositions = [
    [-12, 1, 0], [12, 1, Math.PI], [1, -18, Math.PI / 2], [1, 18, -Math.PI / 2],
    [-31, 5, 0], [31, 8, Math.PI], [-9, -35, Math.PI / 2], [9, 35, -Math.PI / 2],
  ] as Array<[number, number, number]>
  for (const [x, z, rotation] of lampPositions) addStreetLight(context, x, z, rotation)

  const scrubPositions = [
    [-50, -2, 0.9], [-48, 31, 1.1], [-37, 39, 0.8], [-22, 44, 1.15], [-10, 47, 0.75],
    [5, 48, 0.9], [21, 45, 0.72], [37, 41, 0.95], [49, 31, 0.82], [51, 14, 1.1],
    [51, -7, 0.78], [47, -34, 1.05], [31, -44, 0.82], [4, -49, 0.9], [-17, -47, 1.0],
    [-37, -40, 0.75], [-49, -27, 1.08], [-29, 8, 0.65], [-15, 14, 0.7], [9, 27, 0.72],
    [28, -29, 0.68], [35, 12, 0.62], [-8, -23, 0.7], [23, 12, 0.66],
  ] as Array<[number, number, number]>
  scrubPositions.forEach(([x, z, scale], index) => addScrubCluster(context.scene, x, z, scale, index * 0.73))

  return [
    addWeaponPickup(context, 'smg', -5, 27, 0),
    addWeaponPickup(context, 'shotgun', -20, 16.5, Math.PI / 2),
    addWeaponPickup(context, 'marksman', 0, -53, 0),
  ]
}

