import * as THREE from 'three'
import type { EnvironmentMaterials, WeaponPickup } from './environment'
import { WEAPONS, type WeaponId } from './weapons'
import { terrainHeightAt } from './terrain-v5'

export type TowerAccess = {
  id: string
  label: string
  base: THREE.Vector3
  top: THREE.Vector3
  halfWidth: number
  halfDepth: number
}

export type QuestPickup = {
  id: 'propeller' | 'fuel-cell' | 'toolkit'
  label: string
  group: THREE.Group
  position: THREE.Vector3
  active: boolean
  phase: number
}

export type VehicleKind = 'truck' | 'buggy' | 'forklift' | 'boat'

export type Driveable = {
  id: string
  label: string
  kind: VehicleKind
  group: THREE.Group
  yaw: number
  speed: number
  maxSpeed: number
  turnRate: number
  repaired: boolean
  enterRadius: number
}

export type UpgradeMachine = {
  group: THREE.Group
  position: THREE.Vector3
  core: THREE.Mesh
}

export type WalkableZone = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type ObjectBuildContext = {
  scene: THREE.Scene
  materials: EnvironmentMaterials
  shotTargets: THREE.Object3D[]
  addCollider: (x: number, z: number, width: number, depth: number, padding?: number) => void
}

export type BuiltWorldObjects = {
  towers: TowerAccess[]
  questPickups: QuestPickup[]
  vehicles: Driveable[]
  upgradeMachine: UpgradeMachine
  weaponPickups: WeaponPickup[]
  walkableZones: WalkableZone[]
  update: (dt: number, elapsed: number) => void
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
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  return mesh
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
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  )
  mesh.position.set(x, y, z)
  return mesh
}

function labelMaterial(text: string, accent = 0xa85a2a): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const draw = canvas.getContext('2d')!
  draw.fillStyle = '#120a08'
  draw.fillRect(0, 0, 512, 128)
  draw.strokeStyle = `#${accent.toString(16).padStart(6, '0')}`
  draw.lineWidth = 8
  draw.strokeRect(6, 6, 500, 116)
  draw.fillStyle = '#ead8c4'
  draw.font = '900 42px ui-monospace, monospace'
  draw.textAlign = 'center'
  draw.textBaseline = 'middle'
  draw.fillText(text, 256, 67)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.78 })
}

function localToWorld(x: number, z: number, rotation: number, localX: number, localZ: number): THREE.Vector2 {
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  return new THREE.Vector2(
    x + localX * cosine + localZ * sine,
    z - localX * sine + localZ * cosine,
  )
}

function addWall(
  context: ObjectBuildContext,
  group: THREE.Group,
  buildingX: number,
  buildingZ: number,
  rotation: number,
  width: number,
  height: number,
  depth: number,
  localX: number,
  localY: number,
  localZ: number,
  material: THREE.Material,
): void {
  const wall = box(width, height, depth, material, localX, localY, localZ)
  wall.userData.blocksShot = true
  group.add(wall)
  context.shotTargets.push(wall)
  const center = localToWorld(buildingX, buildingZ, rotation, localX, localZ)
  const rotated = Math.abs(Math.sin(rotation)) > 0.5
  context.addCollider(center.x, center.y, rotated ? depth : width, rotated ? width : depth, 0.08)
}

function addEnterableBuilding(
  context: ObjectBuildContext,
  x: number,
  z: number,
  width: number,
  depth: number,
  name: string,
  rotation = 0,
): void {
  const { scene, materials } = context
  const ground = terrainHeightAt(x, z)
  const group = new THREE.Group()
  group.position.set(x, ground, z)
  group.rotation.y = rotation

  const floor = box(width, 0.2, depth, materials.concrete, 0, 0.1, 0)
  const roof = box(width + 0.5, 0.3, depth + 0.5, materials.blackMetal, 0, 4.8, 0)
  group.add(floor, roof)

  const wallHeight = 4.65
  const thickness = 0.28
  addWall(context, group, x, z, rotation, width, wallHeight, thickness, 0, 2.42, depth / 2, materials.darkRust)
  addWall(context, group, x, z, rotation, thickness, wallHeight, depth, -width / 2, 2.42, 0, materials.darkRust)
  addWall(context, group, x, z, rotation, thickness, wallHeight, depth, width / 2, 2.42, 0, materials.darkRust)

  const doorway = 2.4
  const frontSegment = (width - doorway) / 2
  addWall(
    context,
    group,
    x,
    z,
    rotation,
    frontSegment,
    wallHeight,
    thickness,
    -width / 2 + frontSegment / 2,
    2.42,
    -depth / 2,
    materials.rust,
  )
  addWall(
    context,
    group,
    x,
    z,
    rotation,
    frontSegment,
    wallHeight,
    thickness,
    width / 2 - frontSegment / 2,
    2.42,
    -depth / 2,
    materials.rust,
  )

  const sign = box(Math.min(width - 1.2, 7.2), 1.0, 0.12, labelMaterial(name), 0, 3.75, -depth / 2 - 0.2)
  group.add(sign)
  const awning = box(4.2, 0.18, 1.25, materials.metal, 0, 3.25, -depth / 2 - 0.58)
  awning.rotation.x = -0.08
  group.add(awning)

  const interiorLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xc05a2c,
    emissive: 0xff4f1c,
    emissiveIntensity: 1.1,
    roughness: 0.45,
  })
  group.add(box(1.3, 0.12, 0.38, interiorLightMaterial, 0, 4.45, 0))
  group.add(box(1.7, 1.05, 0.8, materials.blackMetal, -width * 0.27, 0.63, depth * 0.2))
  group.add(box(1.2, 1.5, 1.2, materials.metal, width * 0.29, 0.76, depth * 0.2))
  scene.add(group)
}

function addDock(
  context: ObjectBuildContext,
  x: number,
  z: number,
  width: number,
  length: number,
  rotation = 0,
): WalkableZone {
  const { scene, materials } = context
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation
  const deck = box(width, 0.4, length, materials.metal, 0, 0.08, 0)
  group.add(deck)
  for (const side of [-width / 2 + 0.55, width / 2 - 0.55]) {
    for (let offset = -length / 2; offset <= length / 2; offset += 5.5) {
      group.add(cylinder(0.22, 0.28, 3.2, 8, materials.blackMetal, side, -1.0, offset))
    }
  }
  for (const side of [-width / 2, width / 2]) {
    group.add(box(0.12, 1.1, length, materials.rust, side, 0.76, 0))
  }
  scene.add(group)
  const rotated = Math.abs(Math.sin(rotation)) > 0.5
  return {
    minX: x - (rotated ? length : width) / 2,
    maxX: x + (rotated ? length : width) / 2,
    minZ: z - (rotated ? width : length) / 2,
    maxZ: z + (rotated ? width : length) / 2,
  }
}

function addTower(
  context: ObjectBuildContext,
  id: string,
  label: string,
  x: number,
  z: number,
  height: number,
): TowerAccess {
  const { scene, materials } = context
  const ground = terrainHeightAt(x, z)
  const group = new THREE.Group()
  group.position.set(x, ground, z)
  const platformY = height
  for (const cornerX of [-2.2, 2.2]) {
    for (const cornerZ of [-2.2, 2.2]) {
      group.add(box(0.28, height, 0.28, materials.blackMetal, cornerX, height / 2, cornerZ))
    }
  }
  group.add(box(5.3, 0.34, 5.3, materials.metal, 0, platformY, 0))
  group.add(box(4.6, 2.5, 3.5, materials.darkRust, 0, platformY + 1.42, 0.45))
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x182225,
    emissive: 0x442018,
    emissiveIntensity: 0.4,
    roughness: 0.25,
  })
  group.add(box(3.4, 1.1, 0.12, windowMaterial, 0, platformY + 1.75, -1.35))
  group.add(box(4.4, 0.16, 0.16, materials.rust, 0, platformY + 1.05, -2.5))
  group.add(box(0.16, 1.1, 4.8, materials.rust, -2.5, platformY + 0.58, 0))
  group.add(box(0.16, 1.1, 4.8, materials.rust, 2.5, platformY + 0.58, 0))
  const ladder = new THREE.Group()
  ladder.position.set(-2.45, 0, 2.15)
  for (let y = 0.8; y < height; y += 0.85) ladder.add(box(1.0, 0.08, 0.12, materials.metal, 0, y, 0))
  ladder.add(box(0.1, height, 0.1, materials.metal, -0.5, height / 2, 0))
  ladder.add(box(0.1, height, 0.1, materials.metal, 0.5, height / 2, 0))
  group.add(ladder)
  scene.add(group)
  return {
    id,
    label,
    base: new THREE.Vector3(x - 2.5, ground + 0.2, z + 2.4),
    top: new THREE.Vector3(x, ground + platformY + 1.75, z - 0.4),
    halfWidth: 2.25,
    halfDepth: 2.25,
  }
}

function wheel(material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const result = cylinder(0.48, 0.48, 0.34, 10, material, x, y, z)
  result.rotation.z = Math.PI / 2
  return result
}

function addVehicle(
  context: ObjectBuildContext,
  id: string,
  label: string,
  kind: VehicleKind,
  x: number,
  z: number,
  yaw: number,
): Driveable {
  const { scene, materials } = context
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z) + 0.1, z)
  group.rotation.y = yaw

  if (kind === 'boat') {
    const hullMaterial = materials.darkRust.clone()
    hullMaterial.color.setHex(0x263235)
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.15, 6.2, 8), hullMaterial)
    hull.rotation.x = Math.PI / 2
    hull.scale.z = 0.55
    hull.position.y = -0.25
    group.add(hull)
    group.add(box(2.3, 1.2, 2.1, materials.blackMetal, 0, 0.72, 0.7))
    group.add(box(0.18, 3.1, 0.18, materials.rust, 0.7, 2.1, 0.5))
    group.add(box(2.2, 0.14, 0.14, materials.rust, -0.3, 3.2, 0.5))
  } else {
    const bodyLength = kind === 'truck' ? 4.9 : kind === 'forklift' ? 3.1 : 3.8
    const bodyWidth = kind === 'truck' ? 2.25 : 1.9
    const bodyMaterial = kind === 'buggy' ? materials.warning : materials.rust
    group.add(box(bodyWidth, 0.75, bodyLength, bodyMaterial, 0, 0.72, 0))
    group.add(box(bodyWidth * 0.9, 1.15, bodyLength * 0.38, materials.blackMetal, 0, 1.55, -bodyLength * 0.18))
    group.add(wheel(materials.blackMetal, -bodyWidth * 0.55, 0.45, -bodyLength * 0.32))
    group.add(wheel(materials.blackMetal, bodyWidth * 0.55, 0.45, -bodyLength * 0.32))
    group.add(wheel(materials.blackMetal, -bodyWidth * 0.55, 0.45, bodyLength * 0.32))
    group.add(wheel(materials.blackMetal, bodyWidth * 0.55, 0.45, bodyLength * 0.32))
    if (kind === 'forklift') {
      group.add(box(0.18, 3.4, 0.18, materials.metal, -0.75, 1.9, 1.55))
      group.add(box(0.18, 3.4, 0.18, materials.metal, 0.75, 1.9, 1.55))
      group.add(box(1.65, 0.12, 2.0, materials.metal, 0, 0.25, 2.35))
    }
  }
  scene.add(group)

  return {
    id,
    label,
    kind,
    group,
    yaw,
    speed: 0,
    maxSpeed: kind === 'boat' ? 13.5 : kind === 'buggy' ? 16.5 : kind === 'truck' ? 13 : 9.5,
    turnRate: kind === 'boat' ? 1.15 : kind === 'buggy' ? 1.8 : 1.35,
    repaired: kind !== 'boat',
    enterRadius: kind === 'boat' ? 4.2 : 3.2,
  }
}

function addQuestPickup(
  context: ObjectBuildContext,
  id: QuestPickup['id'],
  label: string,
  x: number,
  z: number,
): QuestPickup {
  const { scene, materials } = context
  const group = new THREE.Group()
  const ground = terrainHeightAt(x, z)
  group.position.set(x, ground + 0.6, z)
  const glowMaterial = materials.ember.clone()
  glowMaterial.color.setHex(id === 'fuel-cell' ? 0xff8736 : id === 'propeller' ? 0x79a7aa : 0xd3a15d)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 6, 20), glowMaterial)
  ring.rotation.x = Math.PI / 2
  group.add(ring)
  if (id === 'propeller') {
    group.add(cylinder(0.12, 0.12, 1.55, 8, materials.metal, 0, 0.35, 0))
    const blade = box(1.65, 0.16, 0.38, materials.metal, 0, 0.35, 0)
    blade.rotation.y = 0.62
    group.add(blade)
  } else if (id === 'fuel-cell') {
    group.add(box(0.8, 1.05, 0.62, materials.warning, 0, 0.38, 0))
    group.add(box(0.45, 0.18, 0.4, materials.blackMetal, 0, 1.0, 0))
  } else {
    group.add(box(1.2, 0.52, 0.68, materials.darkRust, 0, 0.3, 0))
    group.add(box(0.8, 0.12, 0.2, materials.metal, 0, 0.68, 0))
  }
  scene.add(group)
  return { id, label, group, position: group.position, active: true, phase: Math.random() * Math.PI * 2 }
}

function addWeaponPickup(
  context: ObjectBuildContext,
  weaponId: WeaponId,
  x: number,
  z: number,
  rotation = 0,
): WeaponPickup {
  const { scene, materials } = context
  const definition = WEAPONS[weaponId]
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)
  group.rotation.y = rotation
  const accent = new THREE.MeshStandardMaterial({
    color: definition.accent,
    emissive: definition.accent,
    emissiveIntensity: 0.75,
    roughness: 0.45,
    metalness: 0.5,
  })
  group.add(box(2.0, 0.82, 1.25, materials.blackMetal, 0, 0.42, 0))
  group.add(box(2.2, 0.12, 1.42, accent, 0, 0.9, 0))
  group.add(box(2.15, 0.46, 0.08, labelMaterial(definition.name, definition.accent), 0, 0.54, -0.67))
  const weapon = new THREE.Group()
  const length = weaponId === 'harpoon' ? 2.8 : weaponId === 'lmg' ? 2.3 : 2.05
  weapon.add(box(length * 0.55, 0.22, 0.28, materials.blackMetal, 0, 0, 0))
  const barrel = cylinder(0.055, 0.055, length * 0.65, 8, materials.metal, length * 0.48, 0, 0)
  barrel.rotation.z = Math.PI / 2
  weapon.add(barrel)
  weapon.add(box(length * 0.28, 0.3, 0.3, materials.darkRust, -length * 0.38, -0.02, 0))
  weapon.add(box(0.18, 0.45, 0.2, accent, -0.03, -0.25, 0))
  if (definition.scopeFov) {
    const scope = cylinder(0.12, 0.12, 0.65, 10, accent, 0.05, 0.25, 0)
    scope.rotation.z = Math.PI / 2
    weapon.add(scope)
  }
  weapon.position.set(0, 1.4, 0)
  weapon.rotation.y = Math.PI / 2
  group.add(weapon)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.04, 6, 22), accent)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 1.1
  group.add(ring)
  scene.add(group)
  return {
    group,
    weaponId,
    active: true,
    baseY: group.position.y,
    phase: Math.random() * Math.PI * 2,
  }
}

function addUpgradeMachine(context: ObjectBuildContext, x: number, z: number): UpgradeMachine {
  const { scene, materials } = context
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)
  const shell = box(3.2, 4.0, 2.5, materials.darkRust, 0, 2.0, 0)
  const frame = box(3.55, 0.22, 2.85, materials.metal, 0, 4.05, 0)
  const slot = box(2.0, 0.55, 0.18, materials.blackMetal, 0, 2.55, -1.32)
  const sign = box(2.8, 0.78, 0.14, labelMaterial('THE FORGE', 0xff6d32), 0, 3.45, -1.34)
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6b2d,
    emissive: 0xff3d14,
    emissiveIntensity: 1.6,
    roughness: 0.3,
    metalness: 0.25,
  })
  const core = cylinder(0.62, 0.62, 1.45, 12, coreMaterial, 0, 1.25, -1.2)
  core.rotation.x = Math.PI / 2
  group.add(shell, frame, slot, sign, core)
  scene.add(group)
  context.addCollider(x, z, 3.2, 2.5, 0.1)
  return { group, position: group.position, core }
}

export function buildWorldObjects(context: ObjectBuildContext): BuiltWorldObjects {
  addEnterableBuilding(context, -55, 91, 12, 9, 'FIELD STATION', Math.PI / 2)
  addEnterableBuilding(context, -118, -4, 13, 10, 'DRAINAGE', Math.PI / 2)
  addEnterableBuilding(context, 111, -72, 12, 9, 'COAST BUNKER', 0)
  addEnterableBuilding(context, 20, -108, 14, 10, 'RESEARCH ANNEX', 0)
  addEnterableBuilding(context, 116, 34, 13, 9, 'FARM DEPOT', Math.PI / 2)
  addEnterableBuilding(context, 202, -58, 12, 9, 'BLACKWATER LAB', 0)

  const walkableZones = [
    addDock(context, 70, 136, 9, 34, 0),
    addDock(context, 184, -58, 8, 30, Math.PI / 2),
    addDock(context, -151, -18, 7, 22, Math.PI / 2),
  ]

  const towers = [
    addTower(context, 'west-tower', 'WEST RIDGE TOWER', -72, 64, 13.5),
    addTower(context, 'coast-tower', 'COAST WATCHTOWER', 92, -58, 15),
    addTower(context, 'blackwater-tower', 'OUTPOST LIGHT', 211, -48, 12),
  ]

  const vehicles = [
    addVehicle(context, 'service-truck', 'SERVICE TRUCK', 'truck', -50, 72, 0.4),
    addVehicle(context, 'field-buggy', 'FIELD BUGGY', 'buggy', 105, 31, -0.8),
    addVehicle(context, 'dock-forklift', 'DOCK FORKLIFT', 'forklift', 58, 112, 0),
    addVehicle(context, 'deadwater-boat', 'DEADWATER LAUNCH', 'boat', 70, 145, Math.PI),
  ]

  const questPickups = [
    addQuestPickup(context, 'propeller', 'MARINE PROPELLER', -119, -12),
    addQuestPickup(context, 'fuel-cell', 'SEALED FUEL CELL', 112, -76),
    addQuestPickup(context, 'toolkit', 'MARINE TOOLKIT', 22, -108),
  ]

  const upgradeMachine = addUpgradeMachine(context, 43, 69)
  const weaponPickups = [
    addWeaponPickup(context, 'lmg', -118, 0, Math.PI / 2),
    addWeaponPickup(context, 'arc', 20, -107, 0),
    addWeaponPickup(context, 'harpoon', 205, -59, Math.PI / 2),
  ]

  const update = (dt: number, elapsed: number): void => {
    for (const pickup of questPickups) {
      if (!pickup.active) continue
      pickup.group.rotation.y += dt * 0.35
      pickup.group.position.y = terrainHeightAt(pickup.position.x, pickup.position.z) + 0.6 + Math.sin(elapsed * 2 + pickup.phase) * 0.08
    }
    upgradeMachine.core.rotation.z += dt * 0.9
    upgradeMachine.core.scale.setScalar(0.96 + Math.sin(elapsed * 4.2) * 0.04)
  }

  return {
    towers,
    questPickups,
    vehicles,
    upgradeMachine,
    weaponPickups,
    walkableZones,
    update,
  }
}

