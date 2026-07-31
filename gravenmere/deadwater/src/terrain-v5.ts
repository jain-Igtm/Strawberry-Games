import * as THREE from 'three'
import type { EnvironmentMaterials } from './environment'

// DEADWATER_NATURAL_TERRAIN_V6
// DEADWATER_TERRAIN_WINDING_V6
type Hill = {
  x: number
  z: number
  radiusX: number
  radiusZ: number
  height: number
  rotation: number
  seed: number
}

type TerrainClearance = {
  x: number
  z: number
  radius: number
}

const hills: Hill[] = [
  { x: -103, z: 73, radiusX: 27, radiusZ: 19, height: 7.4, rotation: -0.28, seed: 1.7 },
  { x: -111, z: -49, radiusX: 24, radiusZ: 26, height: 7.0, rotation: 0.22, seed: 3.1 },
  { x: 76, z: 75, radiusX: 25, radiusZ: 18, height: 8.0, rotation: 0.36, seed: 4.8 },
  { x: 137, z: -66, radiusX: 25, radiusZ: 22, height: 6.8, rotation: -0.18, seed: 6.2 },
  { x: -29, z: -97, radiusX: 27, radiusZ: 18, height: 6.2, rotation: 0.15, seed: 8.4 },
  { x: 30, z: 119, radiusX: 19, radiusZ: 13, height: 4.8, rotation: -0.42, seed: 10.1 },
]

const terrainClearances: TerrainClearance[] = [
  { x: 62, z: 104, radius: 13 }, { x: -55, z: 91, radius: 12 },
  { x: -118, z: -4, radius: 13 }, { x: 111, z: -72, radius: 13 },
  { x: 20, z: -108, radius: 14 }, { x: 116, z: 34, radius: 13 },
  { x: 202, z: -58, radius: 13 }, { x: -72, z: 64, radius: 8 },
  { x: 92, z: -58, radius: 8 }, { x: 211, z: -48, radius: 8 },
  { x: 43, z: 69, radius: 8 }, { x: 70, z: 136, radius: 9 },
  { x: 184, z: -58, radius: 8 }, { x: -151, z: -18, radius: 8 },
  { x: -50, z: 72, radius: 6 }, { x: 105, z: 31, radius: 6 },
  { x: 58, z: 112, radius: 6 }, { x: 70, z: 145, radius: 7 },
  { x: -6, z: 32, radius: 8 }, { x: 39, z: -20, radius: 7 },
  { x: -44, z: 17, radius: 7 }, { x: 17, z: -37, radius: 8 },
  { x: 45, z: 22, radius: 7 },
  // Authored Dock Town footprint and named road exits.
  { x: 61, z: 96, radius: 48 },
  { x: 104, z: 108, radius: 40 },
  { x: 83, z: 61, radius: 37 },
  { x: 23, z: 108, radius: 25 },
]

export type TerrainBuildContext = {
  scene: THREE.Scene
  materials: EnvironmentMaterials & {
    island: THREE.MeshStandardMaterial
    water: THREE.MeshStandardMaterial
  }
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

function clearanceMultiplierAt(x: number, z: number): number {
  let multiplier = 1
  for (const zone of terrainClearances) {
    const distance = Math.hypot(x - zone.x, z - zone.z)
    if (distance <= zone.radius) return 0
    if (distance < zone.radius + 7) {
      const blend = (distance - zone.radius) / 7
      multiplier = Math.min(multiplier, blend * blend * (3 - 2 * blend))
    }
  }
  return multiplier
}

function hillHeightAt(hill: Hill, x: number, z: number): number {
  const dx = x - hill.x
  const dz = z - hill.z
  const cosine = Math.cos(hill.rotation)
  const sine = Math.sin(hill.rotation)
  const localX = dx * cosine + dz * sine
  const localZ = -dx * sine + dz * cosine
  const normalizedX = localX / hill.radiusX
  const normalizedZ = localZ / hill.radiusZ
  const angle = Math.atan2(normalizedZ, normalizedX)
  const edgeWobble =
    1 +
    Math.sin(angle * 3 + hill.seed) * 0.075 +
    Math.sin(angle * 5 - hill.seed * 0.63) * 0.038
  const distance = Math.hypot(normalizedX, normalizedZ) / edgeWobble
  if (distance >= 1) return 0
  const broadSlope = Math.pow(1 - distance * distance, 1.72)
  const erosion = 0.94 + Math.sin(angle * 2.2 + hill.seed) * 0.035
  return broadSlope * hill.height * erosion * clearanceMultiplierAt(x, z)
}

export function terrainHeightAt(x: number, z: number): number {
  if (!isLandAt(x, z)) return 0
  let height = 0
  for (const hill of hills) height = Math.max(height, hillHeightAt(hill, x, z))
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
  materials: EnvironmentMaterials & {
    island: THREE.MeshStandardMaterial
    water: THREE.MeshStandardMaterial
  },
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
  materials: EnvironmentMaterials & {
    island: THREE.MeshStandardMaterial
    water: THREE.MeshStandardMaterial
  },
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

function addHillMeshes(scene: THREE.Scene, materials: TerrainBuildContext['materials']): void {
  const hillMaterial = materials.island.clone()
  hillMaterial.color.setHex(0x372b21)
  hillMaterial.flatShading = true
  hillMaterial.side = THREE.DoubleSide

  const rings = 7
  const segments = 16
  for (const hill of hills) {
    const positions: number[] = []
    const indices: number[] = []
    const cosine = Math.cos(hill.rotation)
    const sine = Math.sin(hill.rotation)

    positions.push(hill.x, terrainHeightAt(hill.x, hill.z) + 0.018, hill.z)
    for (let ring = 1; ring <= rings; ring += 1) {
      const radial = ring / rings
      for (let segment = 0; segment < segments; segment += 1) {
        const angle = (segment / segments) * Math.PI * 2
        const edgeWobble =
          1 +
          Math.sin(angle * 3 + hill.seed) * 0.075 +
          Math.sin(angle * 5 - hill.seed * 0.63) * 0.038
        const localX = Math.cos(angle) * hill.radiusX * radial * edgeWobble
        const localZ = Math.sin(angle) * hill.radiusZ * radial * edgeWobble
        const worldX = hill.x + localX * cosine - localZ * sine
        const worldZ = hill.z + localX * sine + localZ * cosine
        const surfaceY = terrainHeightAt(worldX, worldZ)
        positions.push(worldX, surfaceY + (ring === rings ? 0.012 : 0.018), worldZ)
      }
    }

    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments
      indices.push(0, 1 + next, 1 + segment)
    }
    for (let ring = 1; ring < rings; ring += 1) {
      const innerStart = 1 + (ring - 1) * segments
      const outerStart = 1 + ring * segments
      for (let segment = 0; segment < segments; segment += 1) {
        const next = (segment + 1) % segments
        const inner = innerStart + segment
        const innerNext = innerStart + next
        const outer = outerStart + segment
        const outerNext = outerStart + next
        indices.push(inner, innerNext, outer, innerNext, outerNext, outer)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, hillMaterial)
    mesh.renderOrder = 1
    scene.add(mesh)
  }
}

function addRoadNetwork(scene: THREE.Scene, materials: EnvironmentMaterials & {
    island: THREE.MeshStandardMaterial
    water: THREE.MeshStandardMaterial
  }): void {
  const paths: THREE.Vector2[][] = [
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

  addBridge(scene, materials, 141, 81, 17, 0.08)
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
    new THREE.Vector2(149, 132),
    new THREE.Vector2(141, 106),
    new THREE.Vector2(145, 82),
    new THREE.Vector2(137, 55),
    new THREE.Vector2(141, 28),
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
    if (z > 122 && x > 25) return 'NORTH DOCKS'
    if (x > 4 && x < 136 && z > 46 && z <= 122) return 'DOCK TOWN'
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

