import * as THREE from 'three'
import type { EnvironmentMaterials } from './environment'

type Hill = {
  x: number
  z: number
  radiusX: number
  radiusZ: number
  height: number
}

const hills: Hill[] = [
  { x: -86, z: 58, radiusX: 34, radiusZ: 27, height: 11 },
  { x: -112, z: -43, radiusX: 28, radiusZ: 32, height: 9 },
  { x: 73, z: 66, radiusX: 36, radiusZ: 27, height: 13 },
  { x: 102, z: -52, radiusX: 31, radiusZ: 34, height: 10 },
  { x: 22, z: -96, radiusX: 42, radiusZ: 24, height: 8 },
]

export type TerrainBuildContext = {
  scene: THREE.Scene
  materials: EnvironmentMaterials
}

export type TerrainWorld = {
  spawnPoints: THREE.Vector3[]
  heightAt: (x: number, z: number) => number
  isLandAt: (x: number, z: number) => boolean
  isMainLandAt: (x: number, z: number) => boolean
  canBoatAt: (x: number, z: number) => boolean
  districtAt: (x: number, z: number) => string
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

export function isMainLandAt(x: number, z: number): boolean {
  const central = (x / 153) ** 2 + (z / 128) ** 2 <= 1
  const easternPeninsula = ((x - 112) / 58) ** 2 + ((z - 25) / 54) ** 2 <= 1
  const westernPeninsula = ((x + 122) / 49) ** 2 + ((z + 18) / 58) ** 2 <= 1
  return central || easternPeninsula || westernPeninsula
}

export function isLandAt(x: number, z: number): boolean {
  const offshore = (x - 205) ** 2 + (z + 58) ** 2 <= 25 ** 2
  return isMainLandAt(x, z) || offshore
}

export function terrainHeightAt(x: number, z: number): number {
  if (!isLandAt(x, z)) return 0
  let height = 0
  for (const hill of hills) {
    const nx = (x - hill.x) / hill.radiusX
    const nz = (z - hill.z) / hill.radiusZ
    const distance = nx * nx + nz * nz
    if (distance >= 1) continue
    const profile = Math.pow(1 - distance, 1.65)
    height = Math.max(height, profile * hill.height)
  }
  return height
}

function addRoadSegment(
  scene: THREE.Scene,
  material: THREE.Material,
  from: THREE.Vector2,
  to: THREE.Vector2,
  width: number,
): void {
  const dx = to.x - from.x
  const dz = to.y - from.y
  const length = Math.hypot(dx, dz)
  const midpointX = (from.x + to.x) / 2
  const midpointZ = (from.y + to.y) / 2
  const road = box(width, 0.11, length, material, midpointX, terrainHeightAt(midpointX, midpointZ) + 0.12, midpointZ)
  road.rotation.y = Math.atan2(dx, dz)
  scene.add(road)
}

function createRiverRibbon(points: THREE.Vector2[], width: number, material: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, 0.08, point.y)),
    false,
    'catmullrom',
    0.35,
  )
  const segments = 54
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const center = curve.getPoint(t)
    const tangent = curve.getTangent(t).normalize()
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const wobble = Math.sin(t * Math.PI * 5) * width * 0.08
    const halfWidth = width * 0.5 + wobble
    const left = center.clone().addScaledVector(normal, halfWidth)
    const right = center.clone().addScaledVector(normal, -halfWidth)
    positions.push(left.x, 0.085, left.z, right.x, 0.085, right.z)
    if (index < segments) {
      const base = index * 2
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, material)
}

function addBridge(
  scene: THREE.Scene,
  materials: EnvironmentMaterials,
  x: number,
  z: number,
  length: number,
  rotation: number,
): void {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = rotation
  const deck = box(length, 0.34, 6.2, materials.metal, 0, 0.38, 0)
  const road = box(length - 0.5, 0.12, 5.1, materials.cracked, 0, 0.61, 0)
  group.add(deck, road)
  for (const side of [-2.85, 2.85]) {
    group.add(box(length, 0.14, 0.14, materials.rust, 0, 1.35, side))
    for (let offset = -length / 2 + 1; offset < length / 2; offset += 2.4) {
      group.add(box(0.11, 1.1, 0.11, materials.blackMetal, offset, 0.86, side))
    }
  }
  scene.add(group)
}

function addField(
  scene: THREE.Scene,
  materials: EnvironmentMaterials,
  x: number,
  z: number,
  width: number,
  depth: number,
  count: number,
  seed: number,
): void {
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x353322, roughness: 1 })
  const ground = box(width, 0.08, depth, groundMaterial, x, 0.04, z)
  scene.add(ground)

  const stalkMaterial = new THREE.MeshStandardMaterial({ color: 0x4e4930, roughness: 1 })
  const stalkGeometry = new THREE.ConeGeometry(0.08, 0.7, 5)
  const stalks = new THREE.InstancedMesh(stalkGeometry, stalkMaterial, count)
  const dummy = new THREE.Object3D()
  let value = seed >>> 0
  const random = (): number => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0xffffffff
  }
  for (let index = 0; index < count; index += 1) {
    const px = x + (random() - 0.5) * (width - 2)
    const pz = z + (random() - 0.5) * (depth - 2)
    const scale = 0.55 + random() * 0.8
    dummy.position.set(px, 0.36 * scale, pz)
    dummy.rotation.y = random() * Math.PI
    dummy.rotation.z = (random() - 0.5) * 0.18
    dummy.scale.set(scale, scale, scale)
    dummy.updateMatrix()
    stalks.setMatrixAt(index, dummy.matrix)
  }
  stalks.instanceMatrix.needsUpdate = true
  scene.add(stalks)

  const fenceMaterial = materials.darkRust
  for (const side of [-1, 1]) {
    const fence = box(width, 0.12, 0.12, fenceMaterial, x, 0.8, z + side * depth / 2)
    scene.add(fence)
    for (let offset = -width / 2; offset <= width / 2; offset += 4) {
      scene.add(box(0.12, 1.55, 0.12, materials.blackMetal, x + offset, 0.78, z + side * depth / 2))
    }
  }
}

function addHillMeshes(scene: THREE.Scene, materials: EnvironmentMaterials): void {
  const hillMaterial = materials.island.clone()
  hillMaterial.color.setHex(0x372b21)
  for (const hill of hills) {
    const geometry = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2)
    const mesh = new THREE.Mesh(geometry, hillMaterial)
    mesh.position.set(hill.x, 0, hill.z)
    mesh.scale.set(hill.radiusX, hill.height, hill.radiusZ)
    scene.add(mesh)
  }
}

function addRoadNetwork(scene: THREE.Scene, materials: EnvironmentMaterials): void {
  const paths: THREE.Vector2[][] = [
    [new THREE.Vector2(0, 44), new THREE.Vector2(5, 78), new THREE.Vector2(28, 106), new THREE.Vector2(64, 118)],
    [new THREE.Vector2(42, 4), new THREE.Vector2(76, 7), new THREE.Vector2(108, 24), new THREE.Vector2(139, 37)],
    [new THREE.Vector2(-42, 12), new THREE.Vector2(-72, 7), new THREE.Vector2(-102, -7), new THREE.Vector2(-142, -18)],
    [new THREE.Vector2(-18, -45), new THREE.Vector2(-24, -72), new THREE.Vector2(-5, -101), new THREE.Vector2(28, -113)],
    [new THREE.Vector2(52, -28), new THREE.Vector2(84, -37), new THREE.Vector2(107, -62), new THREE.Vector2(124, -91)],
    [new THREE.Vector2(-52, 35), new THREE.Vector2(-70, 59), new THREE.Vector2(-61, 88), new THREE.Vector2(-37, 108)],
  ]
  for (const path of paths) {
    for (let index = 0; index < path.length - 1; index += 1) {
      addRoadSegment(scene, materials.cracked, path[index], path[index + 1], index % 2 === 0 ? 8.2 : 7.2)
    }
  }

  addBridge(scene, materials, 54, 83, 17, 0.2)
  addBridge(scene, materials, -92, -11, 16, -0.35)
  addBridge(scene, materials, 13, -86, 18, Math.PI / 2)
}

export function buildExpandedTerrain(context: TerrainBuildContext): TerrainWorld {
  const { scene, materials } = context
  const outerMaterial = materials.island.clone()
  outerMaterial.color.setHex(0x30261d)
  const outerIsland = cylinder(153, 158, 2.6, 40, outerMaterial, 0, -1.42, 0)
  outerIsland.scale.z = 0.84
  scene.add(outerIsland)

  const eastPeninsula = cylinder(58, 62, 2.5, 28, outerMaterial, 112, -1.4, 25)
  eastPeninsula.scale.z = 0.93
  scene.add(eastPeninsula)
  const westPeninsula = cylinder(49, 54, 2.5, 26, outerMaterial, -122, -1.4, -18)
  westPeninsula.scale.z = 1.18
  scene.add(westPeninsula)

  const offshoreMaterial = materials.island.clone()
  offshoreMaterial.color.setHex(0x29251d)
  const offshore = cylinder(25, 29, 2.5, 22, offshoreMaterial, 205, -1.35, -58)
  scene.add(offshore)

  addHillMeshes(scene, materials)
  addRoadNetwork(scene, materials)
  addField(scene, materials, -22, 91, 42, 27, 72, 3182)
  addField(scene, materials, 93, 37, 36, 30, 68, 9927)
  addField(scene, materials, -118, -42, 31, 35, 58, 4401)

  const riverMaterial = materials.water.clone()
  riverMaterial.color.setHex(0x111e20)
  riverMaterial.opacity = 0.96
  riverMaterial.side = THREE.DoubleSide
  riverMaterial.polygonOffset = true
  riverMaterial.polygonOffsetFactor = -5
  riverMaterial.polygonOffsetUnits = -5
  scene.add(createRiverRibbon([
    new THREE.Vector2(78, 133),
    new THREE.Vector2(64, 102),
    new THREE.Vector2(70, 78),
    new THREE.Vector2(52, 54),
    new THREE.Vector2(58, 28),
  ], 8.5, riverMaterial))
  scene.add(createRiverRibbon([
    new THREE.Vector2(-151, -4),
    new THREE.Vector2(-119, -9),
    new THREE.Vector2(-94, -2),
    new THREE.Vector2(-73, -20),
    new THREE.Vector2(-53, -36),
  ], 7.2, riverMaterial))
  scene.add(createRiverRibbon([
    new THREE.Vector2(4, -128),
    new THREE.Vector2(9, -103),
    new THREE.Vector2(3, -83),
    new THREE.Vector2(19, -63),
  ], 6.8, riverMaterial))

  const spawnPoints: THREE.Vector3[] = []
  for (let index = 0; index < 28; index += 1) {
    const angle = (index / 28) * Math.PI * 2
    const radiusX = index % 3 === 0 ? 137 : 124
    const radiusZ = index % 3 === 0 ? 111 : 101
    spawnPoints.push(new THREE.Vector3(Math.sin(angle) * radiusX, 0, Math.cos(angle) * radiusZ))
  }
  spawnPoints.push(
    new THREE.Vector3(-130, 22, -18),
    new THREE.Vector3(132, 0, 37),
    new THREE.Vector3(94, 0, -89),
    new THREE.Vector3(-41, 0, 111),
  )

  const canBoatAt = (x: number, z: number): boolean => {
    if (Math.abs(x) > 255 || Math.abs(z) > 185) return false
    const dockChannel = x > 52 && x < 85 && z > 108
    const islandCove = x > 175 && x < 216 && z > -91 && z < -31
    return !isLandAt(x, z) || dockChannel || islandCove
  }

  const districtAt = (x: number, z: number): string => {
    if ((x - 205) ** 2 + (z + 58) ** 2 < 30 ** 2) return 'BLACKWATER OUTPOST'
    if (z > 105 && x > 35) return 'NORTH DOCKS'
    if (z > 73 && x < 18) return 'ASH FIELDS'
    if (x < -96 && z > 8) return 'WESTERN RIDGE'
    if (x < -92 && z < 4) return 'DRAINAGE WORKS'
    if (x > 96 && z > -15) return 'EAST FARMS'
    if (x > 82 && z < -20) return 'COAST ROAD'
    if (z < -78 && x < 55) return 'SOUTHERN MARSH'
    if (Math.abs(x) < 58 && Math.abs(z) < 58) return 'OLD REFINERY'
    return 'DEADWATER INTERIOR'
  }

  return {
    spawnPoints,
    heightAt: terrainHeightAt,
    isLandAt,
    isMainLandAt,
    canBoatAt,
    districtAt,
  }
}
