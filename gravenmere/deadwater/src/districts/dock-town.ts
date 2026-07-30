import * as THREE from 'three'
import type { EnvironmentMaterials } from '../environment'
import {
  ATLAS_TILES,
  forestAtlasTexture,
  mapGeometryToAtlas,
} from '../texture-atlas'
import type { Driveable, VehicleKind, WalkableZone } from '../world-objects-v5'
import { terrainHeightAt } from './dock-town-terrain'
import {
  ADMIN_BUILDING_POSITION,
  DOCK_TOWN_ROADS,
  IMPASSABLE_FOREST,
  TRANSMISSION_FIELD,
  // DEADWATER_DOCK_TOWN_SCALE_V9
  WATER_TOWER_POSITION,
  type PlannedRoad,
} from './dock-town-plan'

export type DockTownContext = {
  scene: THREE.Scene
  materials: EnvironmentMaterials
  shotTargets: THREE.Object3D[]
  addCollider: (x: number, z: number, width: number, depth: number, padding?: number) => void
}

export type DockTownDistrict = {
  vehicles: Driveable[]
  walkableZones: WalkableZone[]
  update: (dt: number, elapsed: number) => void
}

type DockTownMaterials = {
  asphalt: THREE.MeshStandardMaterial
  sidewalk: THREE.MeshStandardMaterial
  brick: THREE.MeshStandardMaterial
  painted: THREE.MeshStandardMaterial
  concrete: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
  roof: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  leaves: THREE.MeshStandardMaterial
  deadLeaves: THREE.MeshStandardMaterial
  grass: THREE.MeshStandardMaterial
  cable: THREE.MeshStandardMaterial
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

function patternMaterial(
  base: string,
  line: string,
  kind: 'brick' | 'boards' | 'concrete',
): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const draw = canvas.getContext('2d')!
  draw.fillStyle = base
  draw.fillRect(0, 0, 128, 128)
  draw.strokeStyle = line
  draw.lineWidth = kind === 'concrete' ? 1 : 3
  if (kind === 'brick') {
    for (let y = 0; y <= 128; y += 20) {
      draw.beginPath()
      draw.moveTo(0, y)
      draw.lineTo(128, y)
      draw.stroke()
      const offset = (y / 20) % 2 === 0 ? 0 : 18
      for (let x = offset; x <= 128; x += 36) {
        draw.beginPath()
        draw.moveTo(x, y)
        draw.lineTo(x, y + 20)
        draw.stroke()
      }
    }
  } else if (kind === 'boards') {
    for (let x = 0; x <= 128; x += 16) {
      draw.beginPath()
      draw.moveTo(x, 0)
      draw.lineTo(x, 128)
      draw.stroke()
    }
  } else {
    for (let index = 0; index < 110; index += 1) {
      const shade = 18 + Math.floor(Math.random() * 24)
      draw.fillStyle = `rgba(${shade},${shade},${shade},0.16)`
      draw.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 3)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2.5, 2.5)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.94 })
}

function createMaterials(base: EnvironmentMaterials): DockTownMaterials {
  const glass = new THREE.MeshStandardMaterial({
    color: 0x182126,
    emissive: 0x311812,
    emissiveIntensity: 0.34,
    roughness: 0.22,
    metalness: 0.12,
  })
  const asphalt = base.cracked.clone()
  asphalt.color.setHex(0x252321)
  asphalt.polygonOffset = true
  asphalt.polygonOffsetFactor = -4
  asphalt.polygonOffsetUnits = -4
  const sidewalk = base.concrete.clone()
  sidewalk.color.setHex(0x57514a)
  sidewalk.polygonOffset = true
  sidewalk.polygonOffsetFactor = -2
  sidewalk.polygonOffsetUnits = -2
  return {
    asphalt,
    sidewalk,
    brick: patternMaterial('#563127', '#2b1a17', 'brick'),
    painted: patternMaterial('#4b5550', '#303733', 'boards'),
    concrete: patternMaterial('#55504a', '#2a2826', 'concrete'),
    glass,
    roof: base.blackMetal,
    wood: new THREE.MeshStandardMaterial({
      color: 0xd8d1c8,
      map: forestAtlasTexture,
      roughness: 1,
      flatShading: true,
    }),
    leaves: new THREE.MeshStandardMaterial({
      color: 0xc5d0c9,
      map: forestAtlasTexture,
      roughness: 1,
      flatShading: true,
    }),
    deadLeaves: new THREE.MeshStandardMaterial({
      color: 0xc3b8aa,
      map: forestAtlasTexture,
      roughness: 1,
      flatShading: true,
    }),
    grass: new THREE.MeshStandardMaterial({ color: 0x343625, roughness: 1 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x171716, roughness: 0.7, metalness: 0.65 }),
  }
}

function createRibbon(points: THREE.Vector2[], width: number, material: THREE.Material, lift: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, 0, point.y)),
    false,
    'catmullrom',
    0.32,
  )
  const segments = Math.max(12, Math.round(curve.getLength() * 0.62))
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const center = curve.getPoint(t)
    const tangent = curve.getTangent(t).normalize()
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const left = center.clone().addScaledVector(normal, width / 2)
    const right = center.clone().addScaledVector(normal, -width / 2)
    positions.push(
      left.x,
      terrainHeightAt(left.x, left.z) + lift,
      left.z,
      right.x,
      terrainHeightAt(right.x, right.z) + lift,
      right.z,
    )
    if (index < segments) {
      const start = index * 2
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, material)
}

function addRoad(context: DockTownContext, materials: DockTownMaterials, road: PlannedRoad): void {
  if (road.sidewalks) {
    const pavement = createRibbon(road.points, road.width + 3.2, materials.sidewalk, 0.09)
    pavement.renderOrder = 3
    context.scene.add(pavement)
  }
  const surface = createRibbon(road.points, road.width, materials.asphalt, 0.14)
  surface.renderOrder = 4
  context.scene.add(surface)
}

function signMaterial(text: string, accent = '#9a4b2d'): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const draw = canvas.getContext('2d')!
  draw.fillStyle = '#17100d'
  draw.fillRect(0, 0, canvas.width, canvas.height)
  draw.strokeStyle = accent
  draw.lineWidth = 10
  draw.strokeRect(8, 8, 496, 144)
  draw.fillStyle = '#d9c7ae'
  draw.font = '900 44px ui-monospace, monospace'
  draw.textAlign = 'center'
  draw.textBaseline = 'middle'
  draw.fillText(text, 256, 82)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82 })
}

function addFacadeWindows(
  group: THREE.Group,
  material: THREE.Material,
  width: number,
  depth: number,
  floors: number,
  floorHeight: number,
): void {
  const frontColumns = Math.max(2, Math.floor(width / 3.2))
  for (let floor = 0; floor < floors; floor += 1) {
    const y = 2.1 + floor * floorHeight
    for (let column = 0; column < frontColumns; column += 1) {
      const x = -width / 2 + 1.5 + column * ((width - 3) / Math.max(1, frontColumns - 1))
      group.add(box(1.25, 1.45, 0.13, material, x, y, -depth / 2 - 0.08))
    }
    const sideColumns = Math.max(1, Math.floor(depth / 4.2))
    for (const side of [-1, 1]) {
      for (let column = 0; column < sideColumns; column += 1) {
        const z = -depth / 2 + 1.8 + column * ((depth - 3.6) / Math.max(1, sideColumns - 1))
        group.add(box(0.13, 1.35, 1.2, material, side * (width / 2 + 0.08), y, z))
      }
    }
  }
}

function addClosedBuilding(
  context: DockTownContext,
  materials: DockTownMaterials,
  x: number,
  z: number,
  width: number,
  depth: number,
  floors: number,
  label: string,
  facade: THREE.Material,
): void {
  const floorHeight = 3.2
  const height = floors * floorHeight
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)
  const shell = box(width, height, depth, facade, 0, height / 2, 0)
  shell.userData.blocksShot = true
  group.add(shell)
  group.add(box(width + 0.7, 0.38, depth + 0.7, materials.roof, 0, height + 0.18, 0))
  group.add(box(width + 0.35, 0.26, depth + 0.35, context.materials.rust, 0, floorHeight, 0))
  if (floors > 2) group.add(box(width + 0.35, 0.22, depth + 0.35, context.materials.darkRust, 0, floorHeight * 2, 0))
  addFacadeWindows(group, materials.glass, width, depth, floors, floorHeight)
  group.add(box(Math.min(width - 1.4, 8), 1.05, 0.14, signMaterial(label), 0, 2.7, -depth / 2 - 0.16))
  group.add(box(2.0, 2.55, 0.18, context.materials.blackMetal, 0, 1.28, -depth / 2 - 0.12))
  context.scene.add(group)
  context.shotTargets.push(shell)
  context.addCollider(x, z, width, depth, 0.18)
}

function addEnterableBuilding(
  context: DockTownContext,
  materials: DockTownMaterials,
  x: number,
  z: number,
  width: number,
  depth: number,
  floors: number,
  label: string,
  facade: THREE.Material,
): void {
  const totalHeight = floors * 3.2
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)
  const floor = box(width, 0.22, depth, context.materials.concrete, 0, 0.11, 0)
  const roof = box(width + 0.6, 0.38, depth + 0.6, materials.roof, 0, totalHeight + 0.18, 0)
  group.add(floor, roof)

  const thickness = 0.28
  const doorway = 2.35
  const frontHalf = (width - doorway) / 2
  const wallPieces = [
    box(width, totalHeight, thickness, facade, 0, totalHeight / 2, depth / 2),
    box(thickness, totalHeight, depth, facade, -width / 2, totalHeight / 2, 0),
    box(thickness, totalHeight, depth, facade, width / 2, totalHeight / 2, 0),
    box(frontHalf, totalHeight, thickness, facade, -width / 2 + frontHalf / 2, totalHeight / 2, -depth / 2),
    box(frontHalf, totalHeight, thickness, facade, width / 2 - frontHalf / 2, totalHeight / 2, -depth / 2),
  ]
  for (const wall of wallPieces) {
    wall.userData.blocksShot = true
    group.add(wall)
    context.shotTargets.push(wall)
  }
  context.addCollider(x, z + depth / 2, width, thickness, 0.05)
  context.addCollider(x - width / 2, z, thickness, depth, 0.05)
  context.addCollider(x + width / 2, z, thickness, depth, 0.05)
  context.addCollider(x - width * 0.33, z - depth / 2, frontHalf, thickness, 0.05)
  context.addCollider(x + width * 0.33, z - depth / 2, frontHalf, thickness, 0.05)

  addFacadeWindows(group, materials.glass, width, depth, Math.max(1, floors - 1), 3.2)
  group.add(box(Math.min(width - 1.4, 8), 1.0, 0.14, signMaterial(label), 0, 3.0, -depth / 2 - 0.16))
  group.add(box(4.5, 0.18, 1.35, context.materials.metal, 0, 3.45, -depth / 2 - 0.62))

  // Purposeful ground-floor interior rather than an empty shell.
  group.add(box(width * 0.58, 0.9, 0.75, context.materials.darkRust, 0, 0.55, depth * 0.2))
  group.add(box(0.22, 2.8, depth * 0.45, materials.painted, -width * 0.18, 1.5, depth * 0.17))
  group.add(box(1.5, 0.8, 1.5, context.materials.metal, width * 0.29, 0.5, depth * 0.22))
  group.add(box(1.3, 2.1, 0.55, context.materials.blackMetal, width * 0.3, 1.08, depth * 0.38))
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xb95c32,
    emissive: 0xff5c2d,
    emissiveIntensity: 1.25,
    roughness: 0.5,
  })
  group.add(box(1.5, 0.12, 0.35, lampMaterial, 0, 3.0, 0))
  context.scene.add(group)
}

function smileMaterial(): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 180
  const draw = canvas.getContext('2d')!
  draw.fillStyle = '#80664f'
  draw.fillRect(0, 0, 256, 180)
  draw.globalAlpha = 0.52
  draw.strokeStyle = '#e1b36f'
  draw.lineWidth = 18
  draw.lineCap = 'round'
  draw.beginPath()
  draw.arc(128, 85, 58, 0.22, Math.PI - 0.22)
  draw.stroke()
  draw.fillStyle = '#e1b36f'
  draw.beginPath()
  draw.arc(82, 56, 11, 0, Math.PI * 2)
  draw.arc(174, 56, 11, 0, Math.PI * 2)
  draw.fill()
  draw.globalAlpha = 0.28
  draw.fillStyle = '#2d211a'
  for (let index = 0; index < 55; index += 1) {
    draw.fillRect(Math.random() * 256, Math.random() * 180, 2 + Math.random() * 8, 1 + Math.random() * 4)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.96 })
}

function addWaterTower(context: DockTownContext, materials: DockTownMaterials): void {
  const x = WATER_TOWER_POSITION.x
  const z = WATER_TOWER_POSITION.y
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)
  const legHeight = 11.5
  for (const legX of [-2.5, 2.5]) {
    for (const legZ of [-2.5, 2.5]) {
      const leg = box(0.38, legHeight, 0.38, context.materials.metal, legX, legHeight / 2, legZ)
      leg.rotation.z = legX * -0.011
      leg.rotation.x = legZ * 0.011
      group.add(leg)
    }
  }
  for (const y of [3.2, 6.3, 9.3]) {
    group.add(box(5.3, 0.18, 0.18, context.materials.rust, 0, y, -2.5))
    group.add(box(5.3, 0.18, 0.18, context.materials.rust, 0, y, 2.5))
    group.add(box(0.18, 0.18, 5.3, context.materials.rust, -2.5, y, 0))
    group.add(box(0.18, 0.18, 5.3, context.materials.rust, 2.5, y, 0))
  }
  const tank = cylinder(3.65, 3.65, 4.5, 18, context.materials.metal, 0, 13.3, 0)
  tank.scale.z = 0.92
  group.add(tank)
  group.add(cylinder(1.5, 3.45, 1.5, 16, context.materials.darkRust, 0, 16.15, 0))
  group.add(box(5.1, 3.55, 0.18, smileMaterial(), 0, 13.25, -3.52))
  const towerTimber = box(1.1, 10.8, 0.12, materials.wood, 3.0, 6.1, 0)
  mapGeometryToAtlas(towerTimber.geometry, ATLAS_TILES.topLeft)
  group.add(towerTimber)
  context.scene.add(group)
  context.addCollider(x, z, 6.6, 6.6, 0.18)
}

function addHouse(
  context: DockTownContext,
  materials: DockTownMaterials,
  x: number,
  z: number,
  width: number,
  depth: number,
  floors: number,
): void {
  const height = floors * 2.9
  const facade = Math.random() > 0.5 ? materials.painted : materials.brick
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)
  const shell = box(width, height, depth, facade, 0, height / 2, 0)
  shell.userData.blocksShot = true
  group.add(shell)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.72, 2.1, 4), materials.roof)
  roof.position.y = height + 1.0
  roof.rotation.y = Math.PI / 4
  group.add(roof)
  addFacadeWindows(group, materials.glass, width, depth, floors, 2.9)
  group.add(box(1.25, 2.2, 0.16, context.materials.darkRust, 0, 1.1, -depth / 2 - 0.1))
  context.scene.add(group)
  context.shotTargets.push(shell)
  context.addCollider(x, z, width, depth, 0.16)
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0xffffffff
  }
}

function addTreeMass(
  context: DockTownContext,
  materials: DockTownMaterials,
  areas: Array<{ x: number; z: number; width: number; depth: number; count: number; seed: number }>,
): void {
  const positions: Array<{ x: number; z: number; scale: number; rotation: number; dead: boolean }> = []
  for (const area of areas) {
    const random = seededRandom(area.seed)
    for (let index = 0; index < area.count; index += 1) {
      positions.push({
        x: area.x + (random() - 0.5) * area.width,
        z: area.z + (random() - 0.5) * area.depth,
        scale: 0.72 + random() * 0.72,
        rotation: random() * Math.PI,
        dead: random() < 0.2,
      })
    }
  }
  const trunkGeometry = mapGeometryToAtlas(
    new THREE.CylinderGeometry(0.18, 0.28, 3.8, 6),
    ATLAS_TILES.topLeft,
  )
  const livingGeometry = mapGeometryToAtlas(
    new THREE.ConeGeometry(1.45, 3.4, 7),
    ATLAS_TILES.topRight,
  )
  const deadGeometry = mapGeometryToAtlas(
    new THREE.ConeGeometry(1.45, 3.4, 7),
    ATLAS_TILES.bottomLeft,
  )
  const trunks = new THREE.InstancedMesh(trunkGeometry, materials.wood, positions.length)
  const living = new THREE.InstancedMesh(livingGeometry, materials.leaves, positions.length)
  const dead = new THREE.InstancedMesh(deadGeometry, materials.deadLeaves, positions.length)
  const dummy = new THREE.Object3D()
  let livingIndex = 0
  let deadIndex = 0
  for (let index = 0; index < positions.length; index += 1) {
    const tree = positions[index]
    const ground = terrainHeightAt(tree.x, tree.z)
    dummy.position.set(tree.x, ground + 1.9 * tree.scale, tree.z)
    dummy.rotation.set(0, tree.rotation, 0)
    dummy.scale.set(tree.scale, tree.scale, tree.scale)
    dummy.updateMatrix()
    trunks.setMatrixAt(index, dummy.matrix)
    dummy.position.y = ground + 4.2 * tree.scale
    dummy.scale.set(tree.scale, tree.scale, tree.scale)
    dummy.updateMatrix()
    if (tree.dead) {
      dead.setMatrixAt(deadIndex, dummy.matrix)
      deadIndex += 1
    } else {
      living.setMatrixAt(livingIndex, dummy.matrix)
      livingIndex += 1
    }
  }
  living.count = livingIndex
  dead.count = deadIndex
  trunks.instanceMatrix.needsUpdate = true
  living.instanceMatrix.needsUpdate = true
  dead.instanceMatrix.needsUpdate = true
  context.scene.add(trunks, living, dead)
}

function addImpassableBurningForest(
  context: DockTownContext,
  materials: DockTownMaterials,
): Array<{ material: THREE.MeshStandardMaterial; phase: number }> {
  // DEADWATER_FOREST_LANDMASS_V12
  const { x, z, polygon } = IMPASSABLE_FOREST
  const random = seededRandom(712991)

  const pointInsidePolygon = (px: number, pz: number): boolean => {
    let inside = false
    for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
      const currentPoint = polygon[current]
      const previousPoint = polygon[previous]
      const intersects =
        currentPoint.y > pz !== previousPoint.y > pz &&
        px <
          ((previousPoint.x - currentPoint.x) * (pz - currentPoint.y)) /
            (previousPoint.y - currentPoint.y + Number.EPSILON) +
          currentPoint.x
      if (intersects) inside = !inside
    }
    return inside
  }

  const trees: Array<{ x: number; z: number; scale: number; rotation: number; dead: boolean }> = []

  // Distribute the visible tree wall around the full jagged road-facing perimeter,
  // not around a circle or a rectangle.
  for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
    const start = polygon[edgeIndex]
    const end = polygon[(edgeIndex + 1) % polygon.length]
    const edgeLength = start.distanceTo(end)
    const samples = Math.max(4, Math.ceil(edgeLength / 2.35))
    for (let sample = 0; sample < samples; sample += 1) {
      const progress = (sample + 0.2 + random() * 0.6) / samples
      const px = THREE.MathUtils.lerp(start.x, end.x, progress)
      const pz = THREE.MathUtils.lerp(start.y, end.y, progress)
      const tangentX = end.x - start.x
      const tangentZ = end.y - start.y
      const tangentLength = Math.max(0.001, Math.hypot(tangentX, tangentZ))
      const inwardX = -tangentZ / tangentLength
      const inwardZ = tangentX / tangentLength
      const inwardDistance = 0.7 + random() * 3.2
      trees.push({
        x: px + inwardX * inwardDistance,
        z: pz + inwardZ * inwardDistance,
        scale: 0.88 + random() * 0.58,
        rotation: random() * Math.PI,
        dead: random() < 0.16,
      })
    }
  }

  // A smaller number of genuine interior trees preserves parallax between the
  // perimeter and the cheap deep-forest layers.
  let attempts = 0
  while (trees.length < 138 && attempts < 1200) {
    attempts += 1
    const px = 13 + random() * 58
    const pz = 79 + random() * 57
    if (!pointInsidePolygon(px, pz)) continue
    trees.push({
      x: px,
      z: pz,
      scale: 0.82 + random() * 0.7,
      rotation: random() * Math.PI,
      dead: random() < 0.2,
    })
  }

  const treeCount = trees.length
  const trunkMaterial = materials.wood.clone()
  trunkMaterial.color.setHex(0xb7afa5)
  const foliageMaterial = materials.leaves.clone()
  foliageMaterial.color.setHex(0xb5c2ba)
  const deadMaterial = materials.deadLeaves.clone()
  deadMaterial.color.setHex(0xb2a89b)

  const trunkGeometry = mapGeometryToAtlas(
    new THREE.CylinderGeometry(0.23, 0.43, 8.6, 6),
    ATLAS_TILES.topLeft,
  )
  const lowerLivingGeometry = mapGeometryToAtlas(
    new THREE.ConeGeometry(2.5, 4.5, 7),
    ATLAS_TILES.topRight,
  )
  const middleLivingGeometry = mapGeometryToAtlas(
    new THREE.ConeGeometry(2.04, 4.0, 7),
    ATLAS_TILES.topRight,
  )
  const crownLivingGeometry = mapGeometryToAtlas(
    new THREE.ConeGeometry(1.46, 3.55, 7),
    ATLAS_TILES.topRight,
  )
  const lowerDeadGeometry = mapGeometryToAtlas(
    new THREE.ConeGeometry(2.5, 4.5, 7),
    ATLAS_TILES.bottomLeft,
  )
  const middleDeadGeometry = mapGeometryToAtlas(
    new THREE.ConeGeometry(2.04, 4.0, 7),
    ATLAS_TILES.bottomLeft,
  )
  const crownDeadGeometry = mapGeometryToAtlas(
    new THREE.ConeGeometry(1.46, 3.55, 7),
    ATLAS_TILES.bottomLeft,
  )
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount)
  const lowerLiving = new THREE.InstancedMesh(lowerLivingGeometry, foliageMaterial, treeCount)
  const middleLiving = new THREE.InstancedMesh(middleLivingGeometry, foliageMaterial, treeCount)
  const crownLiving = new THREE.InstancedMesh(crownLivingGeometry, foliageMaterial, treeCount)
  const lowerDead = new THREE.InstancedMesh(lowerDeadGeometry, deadMaterial, treeCount)
  const middleDead = new THREE.InstancedMesh(middleDeadGeometry, deadMaterial, treeCount)
  const crownDead = new THREE.InstancedMesh(crownDeadGeometry, deadMaterial, treeCount)
  const dummy = new THREE.Object3D()
  let livingIndex = 0
  let deadIndex = 0
  let trunkIndex = 0

  for (const tree of trees) {
    const ground = terrainHeightAt(tree.x, tree.z)
    dummy.position.set(tree.x, ground + 4.3 * tree.scale, tree.z)
    dummy.rotation.set(0, tree.rotation, (random() - 0.5) * 0.038)
    dummy.scale.set(tree.scale, tree.scale, tree.scale)
    dummy.updateMatrix()
    trunks.setMatrixAt(trunkIndex, dummy.matrix)
    trunkIndex += 1

    const targetLower = tree.dead ? lowerDead : lowerLiving
    const targetMiddle = tree.dead ? middleDead : middleLiving
    const targetCrown = tree.dead ? crownDead : crownLiving
    const targetIndex = tree.dead ? deadIndex : livingIndex

    dummy.rotation.set(0, tree.rotation, 0)
    dummy.position.y = ground + 6.5 * tree.scale
    dummy.scale.set(tree.scale, tree.scale, tree.scale)
    dummy.updateMatrix()
    targetLower.setMatrixAt(targetIndex, dummy.matrix)

    dummy.position.y = ground + 8.85 * tree.scale
    dummy.scale.set(tree.scale * 0.94, tree.scale * 0.94, tree.scale * 0.94)
    dummy.updateMatrix()
    targetMiddle.setMatrixAt(targetIndex, dummy.matrix)

    dummy.position.y = ground + 10.95 * tree.scale
    dummy.scale.set(tree.scale * 0.9, tree.scale * 0.9, tree.scale * 0.9)
    dummy.updateMatrix()
    targetCrown.setMatrixAt(targetIndex, dummy.matrix)

    if (tree.dead) deadIndex += 1
    else livingIndex += 1
  }

  trunks.count = trunkIndex
  lowerLiving.count = livingIndex
  middleLiving.count = livingIndex
  crownLiving.count = livingIndex
  lowerDead.count = deadIndex
  middleDead.count = deadIndex
  crownDead.count = deadIndex
  for (const mesh of [trunks, lowerLiving, middleLiving, crownLiving, lowerDead, middleDead, crownDead]) {
    mesh.instanceMatrix.needsUpdate = true
    context.scene.add(mesh)
  }

  // A transparent cluster texture is used only deep inside the polygon. Several
  // crossed panels at different positions create depth without forming a shell.
  const clusterCanvas = document.createElement('canvas')
  clusterCanvas.width = 1024
  clusterCanvas.height = 512
  const draw = clusterCanvas.getContext('2d')!
  draw.clearRect(0, 0, 1024, 512)
  const clusterRandom = seededRandom(96112)

  const drawClusterTree = (treeX: number, baseY: number, height: number, widthPx: number, shade: string): void => {
    draw.fillStyle = shade
    draw.fillRect(treeX - widthPx * 0.055, baseY - height * 0.48, widthPx * 0.11, height * 0.5)
    for (let tier = 0; tier < 6; tier += 1) {
      const progress = tier / 5
      const tierY = baseY - height + progress * height * 0.79
      const tierWidth = widthPx * (0.28 + progress * 0.72)
      draw.beginPath()
      draw.moveTo(treeX, tierY - height * 0.075)
      draw.lineTo(treeX - tierWidth, tierY + height * 0.13)
      draw.lineTo(treeX - tierWidth * 0.32, tierY + height * 0.1)
      draw.lineTo(treeX + tierWidth * 0.38, tierY + height * 0.08)
      draw.lineTo(treeX + tierWidth, tierY + height * 0.14)
      draw.closePath()
      draw.fill()
    }
  }

  for (let index = 0; index < 24; index += 1) {
    const treeX = index * 44 + (clusterRandom() - 0.5) * 34
    const height = 205 + clusterRandom() * 245
    const baseY = 489 + clusterRandom() * 18
    drawClusterTree(
      treeX,
      baseY,
      height,
      36 + clusterRandom() * 46,
      index % 4 === 0 ? '#1d281f' : index % 3 === 0 ? '#121d16' : '#0b1510',
    )
  }

  const clusterTexture = new THREE.CanvasTexture(clusterCanvas)
  clusterTexture.colorSpace = THREE.SRGBColorSpace
  clusterTexture.minFilter = THREE.LinearMipmapLinearFilter
  clusterTexture.magFilter = THREE.LinearFilter
  clusterTexture.generateMipmaps = true
  const clusterMaterial = new THREE.MeshStandardMaterial({
    map: clusterTexture,
    transparent: true,
    alphaTest: 0.14,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
    depthWrite: true,
  })

  const clusterPanels = [
    { px: 34, pz: 99, width: 31, height: 20, rotation: 0.08 },
    { px: 47, pz: 110, width: 34, height: 22, rotation: -0.16 },
    { px: 31, pz: 119, width: 31, height: 19, rotation: 0.22 },
    { px: 51, pz: 94, width: 30, height: 20, rotation: Math.PI / 2 + 0.12 },
    { px: 27, pz: 106, width: 32, height: 21, rotation: Math.PI / 2 - 0.1 },
    { px: 45, pz: 122, width: 29, height: 20, rotation: Math.PI / 3 },
    { px: 39, pz: 106, width: 28, height: 23, rotation: -Math.PI / 4 },
  ]
  for (let index = 0; index < clusterPanels.length; index += 1) {
    const panelInfo = clusterPanels[index]
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(panelInfo.width, panelInfo.height), clusterMaterial)
    panel.position.set(
      panelInfo.px,
      terrainHeightAt(panelInfo.px, panelInfo.pz) + panelInfo.height / 2 - 0.25,
      panelInfo.pz,
    )
    panel.rotation.y = panelInfo.rotation
    if (index % 2 === 1) panel.scale.x = -1
    context.scene.add(panel)
  }

  // The forest floor follows the jagged authored perimeter rather than exposing a
  // circular or rectangular base.
  const floorShape = new THREE.Shape()
  floorShape.moveTo(polygon[0].x - x, polygon[0].y - z)
  for (let index = 1; index < polygon.length; index += 1) {
    floorShape.lineTo(polygon[index].x - x, polygon[index].y - z)
  }
  floorShape.closePath()
  const forestFloorMaterial = new THREE.MeshStandardMaterial({
    color: 0x191a13,
    roughness: 1,
    side: THREE.DoubleSide,
  })
  const forestFloor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), forestFloorMaterial)
  forestFloor.rotation.x = Math.PI / 2
  forestFloor.position.set(x, terrainHeightAt(x, z) + 0.055, z)
  context.scene.add(forestFloor)

  // A few small low-intensity glows sit deep behind several tree layers. They are
  // intentionally not tall enough to read as exposed flame walls.
  const glowCanvas = document.createElement('canvas')
  glowCanvas.width = 256
  glowCanvas.height = 256
  const glowDraw = glowCanvas.getContext('2d')!
  glowDraw.clearRect(0, 0, 256, 256)
  const radial = glowDraw.createRadialGradient(128, 196, 3, 128, 196, 76)
  radial.addColorStop(0, 'rgba(255,128,54,0.74)')
  radial.addColorStop(0.35, 'rgba(171,55,23,0.28)')
  radial.addColorStop(0.75, 'rgba(65,20,12,0.07)')
  radial.addColorStop(1, 'rgba(0,0,0,0)')
  glowDraw.fillStyle = radial
  glowDraw.fillRect(0, 0, 256, 256)
  const glowTexture = new THREE.CanvasTexture(glowCanvas)
  glowTexture.colorSpace = THREE.SRGBColorSpace

  const glowMaterials: Array<{ material: THREE.MeshStandardMaterial; phase: number }> = []
  const glowSpots = [
    { px: 32, pz: 104, rotation: 0.32, phase: 0.4 },
    { px: 48, pz: 112, rotation: -0.62, phase: 2.1 },
    { px: 38, pz: 122, rotation: 1.05, phase: 4.3 },
    { px: 51, pz: 97, rotation: 0.74, phase: 5.6 },
  ]
  for (const spot of glowSpots) {
    const glowMaterial = new THREE.MeshStandardMaterial({
      map: glowTexture,
      emissive: 0xff5424,
      emissiveMap: glowTexture,
      emissiveIntensity: 0.2,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      roughness: 1,
      depthWrite: false,
    })
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 3.5), glowMaterial)
    glow.position.set(spot.px, terrainHeightAt(spot.px, spot.pz) + 1.65, spot.pz)
    glow.rotation.y = spot.rotation
    glow.renderOrder = 1
    context.scene.add(glow)
    glowMaterials.push({ material: glowMaterial, phase: spot.phase })
  }

  // Several overlapping collision blocks approximate the irregular polygon and
  // leave the named surrounding roads open.
  context.addCollider(40, 106, 38, 46, 0.8)
  context.addCollider(29, 111, 23, 36, 0.8)
  context.addCollider(55, 104, 20, 31, 0.8)
  context.addCollider(43, 124, 32, 15, 0.8)
  context.addCollider(40, 89, 35, 12, 0.8)

  return glowMaterials
}

function cableBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.Material,
  sag: number,
): THREE.Mesh {
  const middle = start.clone().lerp(end, 0.5)
  middle.y -= sag
  const curve = new THREE.CatmullRomCurve3([start, middle, end], false, 'catmullrom', 0.3)
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.035, 4, false), material)
}

function addUtilityPoles(context: DockTownContext, materials: DockTownMaterials): void {
  const polePoints = [
    new THREE.Vector3(70, 0, 71),
    new THREE.Vector3(78, 0, 64),
    new THREE.Vector3(88, 0, 59),
    new THREE.Vector3(99, 0, 59),
    new THREE.Vector3(110, 0, 63),
    new THREE.Vector3(120, 0, 69),
  ]
  const wireTops: THREE.Vector3[] = []
  for (let index = 0; index < polePoints.length; index += 1) {
    const point = polePoints[index]
    const ground = terrainHeightAt(point.x, point.z)
    const group = new THREE.Group()
    group.position.set(point.x, ground, point.z)
    group.rotation.z = (index % 3 - 1) * 0.025
    const pole = cylinder(0.15, 0.23, 7.2, 7, materials.wood, 0, 3.6, 0)
    mapGeometryToAtlas(pole.geometry, ATLAS_TILES.topLeft)
    group.add(pole)
    group.add(box(2.5, 0.16, 0.16, context.materials.darkRust, 0, 6.65, 0))
    group.add(cylinder(0.08, 0.08, 0.34, 6, context.materials.metal, -0.85, 6.92, 0))
    group.add(cylinder(0.08, 0.08, 0.34, 6, context.materials.metal, 0.85, 6.92, 0))
    context.scene.add(group)
    wireTops.push(new THREE.Vector3(point.x, ground + 6.95, point.z))
  }
  for (let index = 0; index < wireTops.length - 1; index += 1) {
    // Broken network: every third span is missing and one hangs much lower.
    if (index === 2) continue
    context.scene.add(cableBetween(wireTops[index], wireTops[index + 1], materials.cable, index === 4 ? 1.5 : 0.65))
  }
}

function beamBetween(start: THREE.Vector3, end: THREE.Vector3, material: THREE.Material, thickness = 0.18): THREE.Mesh {
  const direction = end.clone().sub(start)
  const length = direction.length()
  const beam = box(thickness, length, thickness, material)
  beam.position.copy(start).add(end).multiplyScalar(0.5)
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return beam
}

function createRuinedPylon(
  context: DockTownContext,
  materials: DockTownMaterials,
  x: number,
  z: number,
  height: number,
  lean: number,
  collapsed: boolean,
): THREE.Group {
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)
  const steel = context.materials.metal
  const halfBase = 3.1
  const top = height
  const points = {
    lb: new THREE.Vector3(-halfBase, 0, 0),
    rb: new THREE.Vector3(halfBase, 0, 0),
    lt: new THREE.Vector3(-0.75, top, 0),
    rt: new THREE.Vector3(0.75, top, 0),
  }
  group.add(beamBetween(points.lb, points.lt, steel, 0.28))
  group.add(beamBetween(points.rb, points.rt, steel, 0.28))
  for (const y of [3.2, 6.4, 9.6]) {
    const width = THREE.MathUtils.lerp(halfBase * 2, 1.5, y / top)
    group.add(box(width, 0.18, 0.18, steel, 0, y, 0))
    group.add(beamBetween(new THREE.Vector3(-width / 2, y - 1.4, 0), new THREE.Vector3(width / 2, y + 1.4, 0), steel, 0.13))
    group.add(beamBetween(new THREE.Vector3(width / 2, y - 1.4, 0), new THREE.Vector3(-width / 2, y + 1.4, 0), steel, 0.13))
  }
  group.add(box(8.5, 0.22, 0.22, context.materials.rust, 0, height - 1.0, 0))
  group.add(box(5.8, 0.18, 0.18, context.materials.darkRust, 0, height - 3.1, 0))
  group.rotation.z = collapsed ? Math.PI / 2.7 : lean
  if (collapsed) group.position.y += 0.4
  context.scene.add(group)
  return group
}

function addTransmissionField(context: DockTownContext, materials: DockTownMaterials): void {
  const { x, z, width, depth } = TRANSMISSION_FIELD
  const field = box(width, 0.09, depth, materials.grass, x, 0.055, z)
  context.scene.add(field)

  const west = createRuinedPylon(context, materials, 108, 120, 13.5, -0.12, false)
  const middle = createRuinedPylon(context, materials, 120, 112, 12.7, 0.27, false)
  createRuinedPylon(context, materials, 128, 103, 12.5, 0, true)
  const westTop = new THREE.Vector3(108, terrainHeightAt(108, 120) + 11.9, 120)
  const middleTop = new THREE.Vector3(120, terrainHeightAt(120, 112) + 10.8, 112)
  context.scene.add(cableBetween(westTop, middleTop, materials.cable, 2.8))
  const danglingStart = new THREE.Vector3(120, terrainHeightAt(120, 112) + 10.1, 112)
  const danglingEnd = new THREE.Vector3(130, terrainHeightAt(130, 106) + 0.4, 106)
  context.scene.add(cableBetween(danglingStart, danglingEnd, materials.cable, 4.4))
  west.userData.ruined = true
  middle.userData.ruined = true

  // The field is visibly choked by ruins and trees; this collider follows that mass.
  context.addCollider(121, 113, 22, 21, 0.4)
}

function wheel(material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const result = cylinder(0.46, 0.46, 0.32, 9, material, x, y, z)
  result.rotation.z = Math.PI / 2
  return result
}

function addVehicle(
  context: DockTownContext,
  id: string,
  label: string,
  kind: VehicleKind,
  x: number,
  z: number,
  yaw: number,
): Driveable {
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z) + 0.1, z)
  group.rotation.y = yaw
  const length = kind === 'truck' ? 4.8 : 3.9
  const width = kind === 'truck' ? 2.2 : 1.9
  const bodyMaterial = kind === 'truck' ? context.materials.rust : context.materials.warning
  group.add(box(width, 0.72, length, bodyMaterial, 0, 0.72, 0))
  group.add(box(width * 0.88, 1.05, length * 0.38, context.materials.blackMetal, 0, 1.52, -length * 0.17))
  group.add(wheel(context.materials.blackMetal, -width * 0.55, 0.43, -length * 0.32))
  group.add(wheel(context.materials.blackMetal, width * 0.55, 0.43, -length * 0.32))
  group.add(wheel(context.materials.blackMetal, -width * 0.55, 0.43, length * 0.32))
  group.add(wheel(context.materials.blackMetal, width * 0.55, 0.43, length * 0.32))
  context.scene.add(group)
  return {
    id,
    label,
    kind,
    group,
    yaw,
    speed: 0,
    maxSpeed: kind === 'truck' ? 13 : 16.2,
    turnRate: kind === 'truck' ? 1.35 : 1.75,
    repaired: true,
    enterRadius: 3.2,
  }
}

function addBoundaryBarricades(
  context: DockTownContext,
  materials: DockTownMaterials,
): void {
  const addGate = (x: number, z: number, depth: number): void => {
    const group = new THREE.Group()
    group.position.set(x, terrainHeightAt(x, z), z)
    for (const offset of [-depth * 0.34, 0, depth * 0.34]) {
      group.add(box(0.9, 1.1, depth * 0.24, materials.concrete, 0, 0.55, offset))
    }
    group.add(box(0.28, 1.8, depth, context.materials.darkRust, 0, 1.15, 0))
    group.add(box(0.34, 0.24, depth, context.materials.warning, 0, 2.0, 0))
    context.scene.add(group)
    context.addCollider(x, z, 1.2, depth, 0.22)
  }

  // The road stubs end physically inside this build. Adjacent districts are
  // separate maps rather than scenery placed within walking distance.
  addGate(-8.4, 132.1, 10.8)
  addGate(138.2, 79.2, 17.5)
}

export function buildDockTownDistrict(context: DockTownContext): DockTownDistrict {
  const materials = createMaterials(context.materials)
  for (const road of DOCK_TOWN_ROADS) addRoad(context, materials, road)

  // Compact downtown: taller street walls and a few purposeful interiors.
  addClosedBuilding(context, materials, 82, 89, 12, 14, 4, 'HARBOR HOUSE', materials.brick)
  addClosedBuilding(context, materials, 98, 90, 13, 15, 5, 'MARINER HOTEL', materials.concrete)
  addEnterableBuilding(context, materials, 58, 87, 11, 12, 3, 'HARBOR SUPPLY', materials.painted)
  addEnterableBuilding(context, materials, 88, 112, 13, 13, 3, 'DOCK EXCHANGE', materials.brick)
  addClosedBuilding(context, materials, 112, 91, 11, 13, 3, 'TIDE BUILDING', materials.painted)

  // Working edge and warehouses reached through the wooded corridor.
  addEnterableBuilding(context, materials, 0, 106, 17, 15, 2, 'WAREHOUSE ONE', materials.concrete)
  addClosedBuilding(context, materials, 7, 122, 15, 12, 2, 'NET & CABLE', materials.brick)
  addClosedBuilding(context, materials, 0, 89, 14, 12, 2, 'COLD STORAGE', materials.painted)

  // Administrative anchor beside the ruined transmission field.
  addEnterableBuilding(
    context,
    materials,
    ADMIN_BUILDING_POSITION.x,
    ADMIN_BUILDING_POSITION.y,
    18,
    16,
    3,
    'HARBOR ADMIN',
    materials.concrete,
  )

  addWaterTower(context, materials)

  // Neighborhood houses are deliberately closed; selected civic/commercial buildings are not.
  addHouse(context, materials, 72, 62, 8.5, 9.5, 2)
  addHouse(context, materials, 84, 54, 8.2, 9.2, 2)
  addHouse(context, materials, 97, 55, 9.0, 9.5, 2)
  addHouse(context, materials, 110, 63, 8.5, 9.0, 1)
  addHouse(context, materials, 92, 68, 8.0, 8.5, 1)
  addHouse(context, materials, 118, 71, 7.5, 8.2, 1)

  // The inaccessible forest is inside Dock Town, not on its outer rim. It
  // occupies the land between four named roads and forces navigation around it.
  const forestFire = addImpassableBurningForest(context, materials)

  // Smaller tree belts continue the forest illusion toward the ruined power
  // field without creating another fully blocked region.
  addTreeMass(context, materials, [
    { x: 128, z: 118, width: 19, depth: 23, count: 28, seed: 1204 },
    { x: 112, z: 132, width: 28, depth: 10, count: 20, seed: 1205 },
    { x: 18, z: 67, width: 18, depth: 16, count: 18, seed: 1206 },
  ])
  context.addCollider(132, 119, 10, 20, 0.2)

  addUtilityPoles(context, materials)
  addTransmissionField(context, materials)
  addBoundaryBarricades(context, materials)

  const vehicles = [
    addVehicle(context, 'docktown-pickup', 'DOCK TOWN PICKUP', 'truck', 31, 88, 0.25),
    addVehicle(context, 'neighborhood-sedan', 'ABANDONED SEDAN', 'buggy', 83, 76, -0.2),
  ]

  return {
    vehicles,
    walkableZones: [],
    update: (_dt, elapsed) => {
      for (const pocket of forestFire) {
        pocket.material.emissiveIntensity = 1.05 + Math.sin(elapsed * 3.2 + pocket.phase) * 0.34
      }
    },
  }
}
