import * as THREE from 'three'
import type { EnvironmentMaterials } from '../environment'
import {
  ATLAS_TILES,
  forestAtlasTexture,
  mapGeometryToAtlas,
} from '../texture-atlas'
import type {
  Driveable,
  FuelStation,
  TowerAccess,
  UpgradeMachine,
  VehicleKind,
  WalkableZone,
} from '../world-objects-v5'
import { terrainHeightAt } from './dock-town-terrain'
import {
  BAR_POSITION,
  DOCK_TOWN_ROADS,
  FALLOUT_HILLS,
  FORGE_POSITION,
  FUEL_STATION_POSITION,
  HOSPITAL_FOOTPRINT,
  HOSPITAL_POSITION,
  IMPASSABLE_FOREST,
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
  fuelStation: FuelStation
  towers: TowerAccess[]
  upgradeMachine: UpgradeMachine
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
  roadLine: THREE.MeshBasicMaterial
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
    roadLine: new THREE.MeshBasicMaterial({
      color: 0x9b8156,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    }),
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

  const curve = new THREE.CatmullRomCurve3(
    road.points.map((point) => new THREE.Vector3(point.x, 0, point.y)),
    false,
    'catmullrom',
    0.32,
  )
  const roadLength = curve.getLength()
  const dashCount = Math.max(2, Math.floor(roadLength / 8))
  for (let index = 1; index < dashCount; index += 1) {
    const t = index / dashCount
    const center = curve.getPoint(t)
    const tangent = curve.getTangent(t)
    const dash = box(0.24, 0.045, 3.65, materials.roadLine)
    dash.position.set(
      center.x,
      terrainHeightAt(center.x, center.z) + 0.225,
      center.z,
    )
    dash.rotation.y = Math.atan2(tangent.x, tangent.z)
    dash.renderOrder = 5
    context.scene.add(dash)
  }
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
): THREE.Group {
  const totalHeight = floors * 3.2
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)
  const floor = box(width, 0.22, depth, context.materials.concrete, 0, 0.11, 0)
  const roof = box(width + 0.6, 0.38, depth + 0.6, materials.roof, 0, totalHeight + 0.18, 0)
  group.add(floor, roof)
  if (floors > 1) {
    group.add(box(width - 0.5, 0.24, depth - 0.5, materials.concrete, 0, 3.42, 0))
  }

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
  return group
}

function addBar(
  context: DockTownContext,
  materials: DockTownMaterials,
): TowerAccess {
  const group = addEnterableBuilding(
    context,
    materials,
    BAR_POSITION.x,
    BAR_POSITION.y,
    20,
    18,
    2,
    'BENT NAIL BAR',
    materials.brick,
  )
  const tableMaterial = context.materials.darkRust
  for (const [x, z] of [[-5, -1], [0, -1], [5, -1], [-3, -4], [3, -4]] as Array<[number, number]>) {
    group.add(cylinder(0.95, 0.95, 0.12, 12, tableMaterial, x, 0.92, z))
    group.add(cylinder(0.13, 0.18, 0.88, 7, context.materials.metal, x, 0.44, z))
  }
  group.add(box(9.5, 1.05, 1.0, materials.wood, 0, 0.65, 6.4))
  group.add(box(9.2, 2.0, 0.18, materials.glass, 0, 2.0, 6.88))

  // The second floor opens directly onto a broad street-facing balcony.
  group.add(box(16.5, 0.26, 4.4, materials.concrete, 0, 3.48, -11.1))
  group.add(box(16.8, 0.16, 0.16, context.materials.metal, 0, 4.55, -13.25))
  for (const railX of [-8.25, -4.1, 0, 4.1, 8.25]) {
    group.add(box(0.14, 1.16, 0.14, context.materials.metal, railX, 4.02, -13.25))
  }
  for (const side of [-1, 1]) {
    group.add(box(0.16, 0.16, 4.25, context.materials.metal, side * 8.25, 4.55, -11.12))
    group.add(box(0.14, 1.16, 0.14, context.materials.metal, side * 8.25, 4.02, -9.0))
  }

  // A visible exterior staircase marks the interaction point used to reach the
  // playable upstairs floor without adding a heavy mobile stair solver.
  for (let index = 0; index < 11; index += 1) {
    const progress = index / 10
    group.add(box(
      2.15,
      0.26 + progress * 0.08,
      1.48,
      materials.concrete,
      -11.2,
      0.15 + progress * 3.18,
      6.0 - progress * 14.1,
    ))
  }
  group.add(box(0.16, 3.8, 15.2, context.materials.metal, -12.35, 2.05, -1.0))
  group.add(box(0.16, 3.8, 15.2, context.materials.metal, -10.05, 2.05, -1.0))

  // Upstairs furniture makes the second storey read as an actual bar room.
  for (const [x, z] of [[-4.8, 2.0], [0, 2.0], [4.8, 2.0], [-3.0, -2.2], [3.0, -2.2]] as Array<[number, number]>) {
    group.add(cylinder(0.82, 0.82, 0.12, 12, tableMaterial, x, 4.2, z))
    group.add(cylinder(0.12, 0.16, 0.72, 7, context.materials.metal, x, 3.82, z))
  }

  const ground = terrainHeightAt(BAR_POSITION.x, BAR_POSITION.y)
  return {
    id: 'bent-nail-upstairs',
    label: 'BENT NAIL UPSTAIRS',
    base: new THREE.Vector3(BAR_POSITION.x - 11.2, ground + 1.7, BAR_POSITION.y + 6.1),
    top: new THREE.Vector3(BAR_POSITION.x, ground + 5.18, BAR_POSITION.y - 1.0),
    halfWidth: 8.1,
    halfDepth: 11.7,
  }
}

function addStaticAmbulance(
  context: DockTownContext,
  x: number,
  z: number,
  yaw: number,
): void {
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z) + 0.1, z)
  group.rotation.y = yaw
  const white = context.materials.concrete.clone()
  white.color.setHex(0xb8b4a8)
  const red = context.materials.rust.clone()
  red.color.setHex(0x8a2f25)
  group.add(box(2.2, 1.3, 4.8, white, 0, 1.0, 0))
  group.add(box(2.05, 1.0, 1.45, context.materials.blackMetal, 0, 1.95, -1.45))
  group.add(box(2.25, 0.3, 3.8, red, 0, 1.05, 0.25))
  group.add(box(0.7, 0.18, 0.28, context.materials.warning, 0, 2.58, -0.55))
  for (const wheelZ of [-1.45, 1.45]) {
    group.add(wheel(context.materials.blackMetal, -1.17, 0.48, wheelZ))
    group.add(wheel(context.materials.blackMetal, 1.17, 0.48, wheelZ))
  }
  context.scene.add(group)
  context.addCollider(x, z, yaw === 0 ? 2.4 : 5.0, yaw === 0 ? 5.0 : 2.4, 0.1)
}

function addHospitalComplex(
  context: DockTownContext,
  materials: DockTownMaterials,
): void {
  const x = HOSPITAL_POSITION.x
  const z = HOSPITAL_POSITION.y
  const { width, depth } = HOSPITAL_FOOTPRINT
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const exteriorHeight = 14.1
  const interiorHeight = 3.25
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)

  const addWall = (
    localX: number,
    localZ: number,
    wallWidth: number,
    wallDepth: number,
    wallHeight = interiorHeight,
    material: THREE.Material = materials.painted,
  ): THREE.Mesh => {
    const wall = box(wallWidth, wallHeight, wallDepth, material, localX, wallHeight / 2, localZ)
    wall.userData.blocksShot = true
    group.add(wall)
    context.shotTargets.push(wall)
    context.addCollider(x + localX, z + localZ, wallWidth, wallDepth, 0.045)
    return wall
  }

  const addWallRunX = (
    start: number,
    end: number,
    localZ: number,
    doors: number[],
    wallHeight = interiorHeight,
    material: THREE.Material = materials.painted,
    doorWidth = 2.4,
  ): void => {
    let cursor = start
    for (const door of [...doors].sort((a, b) => a - b)) {
      const segmentEnd = Math.max(cursor, door - doorWidth / 2)
      if (segmentEnd - cursor > 0.15) {
        addWall((cursor + segmentEnd) / 2, localZ, segmentEnd - cursor, 0.28, wallHeight, material)
      }
      const lintelHeight = wallHeight - 2.55
      if (lintelHeight > 0.2) {
        const lintel = box(doorWidth, lintelHeight, 0.28, material, door, 2.55 + lintelHeight / 2, localZ)
        lintel.userData.blocksShot = true
        group.add(lintel)
        context.shotTargets.push(lintel)
      }
      cursor = Math.min(end, door + doorWidth / 2)
    }
    if (end - cursor > 0.15) {
      addWall((cursor + end) / 2, localZ, end - cursor, 0.28, wallHeight, material)
    }
  }

  const addWallRunZ = (
    localX: number,
    start: number,
    end: number,
    doors: number[],
    wallHeight = interiorHeight,
    material: THREE.Material = materials.painted,
    doorWidth = 2.4,
  ): void => {
    let cursor = start
    for (const door of [...doors].sort((a, b) => a - b)) {
      const segmentEnd = Math.max(cursor, door - doorWidth / 2)
      if (segmentEnd - cursor > 0.15) {
        addWall(localX, (cursor + segmentEnd) / 2, 0.28, segmentEnd - cursor, wallHeight, material)
      }
      const lintelHeight = wallHeight - 2.55
      if (lintelHeight > 0.2) {
        const lintel = box(0.28, lintelHeight, doorWidth, material, localX, 2.55 + lintelHeight / 2, door)
        lintel.userData.blocksShot = true
        group.add(lintel)
        context.shotTargets.push(lintel)
      }
      cursor = Math.min(end, door + doorWidth / 2)
    }
    if (end - cursor > 0.15) {
      addWall(localX, (cursor + end) / 2, 0.28, end - cursor, wallHeight, material)
    }
  }

  // A four-storey exterior wraps a fully playable ground-floor hospital. The
  // long central hall and crossing north hall divide the footprint into wards,
  // treatment rooms, reception, pharmacy and emergency spaces.
  group.add(box(width, 0.24, depth, context.materials.concrete, 0, 0.12, 0))
  group.add(box(width + 0.8, 0.45, depth + 0.8, materials.roof, 0, exteriorHeight + 0.22, 0))
  group.add(box(width - 0.7, 0.24, depth - 0.7, materials.concrete, 0, 3.55, 0))
  group.add(box(width + 0.5, 0.28, depth + 0.5, context.materials.rust, 0, 6.4, 0))
  group.add(box(width + 0.5, 0.24, depth + 0.5, context.materials.darkRust, 0, 9.6, 0))

  addWallRunX(-halfWidth, halfWidth, -halfDepth, [-22, 22], exteriorHeight, materials.concrete, 4.6)
  addWallRunX(-halfWidth, halfWidth, halfDepth, [0], exteriorHeight, materials.concrete, 3.6)
  addWallRunZ(-halfWidth, -halfDepth, halfDepth, [0], exteriorHeight, materials.concrete, 3.4)
  addWallRunZ(halfWidth, -halfDepth, halfDepth, [7], exteriorHeight, materials.concrete, 3.4)
  addFacadeWindows(group, materials.glass, width, depth, 4, 3.2)

  group.add(box(22, 1.25, 0.18, signMaterial('ST. AGNES HOSPITAL', '#b24f38'), -6, 4.9, -halfDepth - 0.22))
  group.add(box(13.5, 1.08, 0.18, signMaterial('EMERGENCY', '#bd352b'), 25, 4.35, -halfDepth - 0.24))
  group.add(box(13.5, 0.46, 5.8, context.materials.metal, 22, 3.62, -halfDepth - 2.75))
  for (const canopyX of [16, 28]) {
    group.add(box(0.36, 3.5, 0.36, context.materials.metal, canopyX, 1.75, -halfDepth - 5.2))
  }

  // Long east-west hall, with doors into every room bay.
  const roomDoors = [-33, -24, -15, -6, 6, 15, 24, 33]
  addWallRunX(-halfWidth, halfWidth, -3.15, roomDoors)
  addWallRunX(-halfWidth, halfWidth, 3.15, roomDoors)

  // South treatment rooms.
  for (const dividerX of [-29, -20, -11, -2, 8, 18, 28]) {
    addWallRunZ(dividerX, -halfDepth, -3.15, [-12.5])
  }

  // North wards surround a crossing corridor that reaches the rear exit.
  for (const dividerX of [-29, -20, -11, 11, 20, 29]) {
    addWallRunZ(dividerX, 3.15, halfDepth, [13.2])
  }
  addWallRunZ(-3.15, 3.15, halfDepth, [10, 19])
  addWallRunZ(3.15, 3.15, halfDepth, [10, 19])
  addWallRunX(-halfWidth, -3.15, 13.2, [-25, -15, -7])
  addWallRunX(3.15, halfWidth, 13.2, [8, 17, 27])

  // Reception, pharmacy and clinical room furniture.
  group.add(box(12.5, 1.05, 1.15, context.materials.metal, -22, 0.64, -8.2))
  group.add(box(8.5, 2.35, 0.28, materials.glass, -22, 1.55, -8.72))
  group.add(box(12, 1.0, 1.1, materials.wood, 25, 0.6, 8.4))
  group.add(box(11.6, 2.15, 0.24, materials.glass, 25, 1.55, 8.98))

  const bedPositions: Array<[number, number, number]> = [
    [-33, -13, 0], [-24.5, -13, 0], [-15.5, -13, 0], [-6.5, -13, 0],
    [12.5, -13, 0], [22.5, -13, 0], [32.5, -13, 0],
    [-33, 8.5, Math.PI], [-24.5, 8.5, Math.PI], [-15.5, 8.5, Math.PI],
    [15.5, 18, Math.PI], [25, 18, Math.PI], [33, 18, Math.PI],
  ]
  for (const [bedX, bedZ, rotation] of bedPositions) {
    const bed = new THREE.Group()
    bed.position.set(bedX, 0, bedZ)
    bed.rotation.y = rotation
    bed.add(box(2.25, 0.5, 0.95, context.materials.metal, 0, 0.42, 0))
    bed.add(box(1.92, 0.22, 0.82, materials.painted, 0, 0.78, 0))
    bed.add(box(0.52, 0.2, 0.76, materials.concrete, 0.66, 0.97, 0))
    group.add(bed)
  }
  for (const [chairX, chairZ] of [[-28, -18], [-24.5, -18], [-21, -18], [-17.5, -18], [17, -18], [20.5, -18]] as Array<[number, number]>) {
    group.add(box(1.2, 0.2, 1.2, context.materials.darkRust, chairX, 0.48, chairZ))
    group.add(box(1.2, 1.05, 0.2, context.materials.darkRust, chairX, 0.93, chairZ + 0.5))
  }

  const hospitalLightMaterial = new THREE.MeshBasicMaterial({ color: 0xffd2a6, toneMapped: false })
  for (const [lightX, lightZ] of [
    [-30, 0], [-18, 0], [-6, 0], [6, 0], [18, 0], [30, 0],
    [0, 9], [0, 18], [-24, -13], [24, -13], [-24, 17], [24, 17],
  ] as Array<[number, number]>) {
    group.add(box(3.2, 0.08, 0.52, hospitalLightMaterial, lightX, 3.39, lightZ))
  }
  for (const [lightX, lightZ] of [[-24, 0], [0, 0], [24, 0], [0, 16]] as Array<[number, number]>) {
    const light = new THREE.PointLight(0xffc89e, 3.6, 25, 2)
    light.position.set(lightX, 2.85, lightZ)
    group.add(light)
  }

  context.scene.add(group)

  const parking = box(79, 0.08, 8.5, materials.asphalt, x, terrainHeightAt(x, 79) + 0.1, 79)
  context.scene.add(parking)
  for (const xOffset of [-31, -23, -15, -7, 1, 9, 17, 25, 33]) {
    const stripe = box(0.18, 0.035, 5.8, materials.roadLine, x + xOffset, terrainHeightAt(x, 79) + 0.18, 79)
    context.scene.add(stripe)
  }
  addStaticAmbulance(context, 192, 79, Math.PI / 2)
  addStaticAmbulance(context, 204, 79, Math.PI / 2)
}

function addGasStation(
  context: DockTownContext,
  materials: DockTownMaterials,
): FuelStation {
  const x = FUEL_STATION_POSITION.x
  const z = FUEL_STATION_POSITION.y
  addEnterableBuilding(context, materials, x - 7, z + 2, 10, 10, 1, 'LAST STOP', materials.painted)
  const forecourt = box(24, 0.08, 13, materials.concrete, x + 3, terrainHeightAt(x, z) + 0.1, z)
  context.scene.add(forecourt)
  const canopy = box(17, 0.45, 8.5, context.materials.darkRust, x + 4, 4.2, z)
  context.scene.add(canopy)
  for (const offset of [-5.8, 5.8]) {
    context.scene.add(box(0.38, 4.1, 0.38, context.materials.metal, x + 4 + offset, 2.05, z))
  }
  const pumpGlow = new THREE.MeshStandardMaterial({
    color: 0xd18b4e,
    emissive: 0xff672f,
    emissiveIntensity: 0.8,
    roughness: 0.7,
  })
  for (const offset of [-3.2, 3.2]) {
    const pumpX = x + 4 + offset
    context.scene.add(box(1.0, 1.7, 0.85, context.materials.rust, pumpX, 0.9, z))
    context.scene.add(box(0.56, 0.5, 0.12, pumpGlow, pumpX, 1.25, z - 0.48))
    context.addCollider(pumpX, z, 1.2, 1.1, 0.08)
  }
  const signPost = box(0.45, 6.8, 0.45, context.materials.metal, x + 15, 3.4, z - 2)
  const sign = box(6.2, 3.0, 0.25, signMaterial('FUEL · 300 PTS'), x + 15, 6.7, z - 2)
  context.scene.add(signPost, sign)
  return {
    position: new THREE.Vector3(x + 4, terrainHeightAt(x, z), z),
    radius: 8.5,
    cost: 300,
  }
}

function addSmallFactory(
  context: DockTownContext,
  materials: DockTownMaterials,
  x: number,
  z: number,
  label: string,
): void {
  const group = addEnterableBuilding(context, materials, x, z, 22, 18, 2, label, materials.concrete)
  group.add(cylinder(1.0, 1.25, 9.5, 9, context.materials.darkRust, 7.4, 9.0, 4.8))
  group.add(cylinder(0.7, 0.7, 2.0, 9, context.materials.rust, 7.4, 14.1, 4.8))
  group.add(box(5.6, 3.7, 0.22, context.materials.metal, -5.4, 2.0, 9.12))
}

function addForge(
  context: DockTownContext,
  materials: DockTownMaterials,
): UpgradeMachine {
  const x = FORGE_POSITION.x
  const z = FORGE_POSITION.y
  const group = new THREE.Group()
  group.position.set(x, terrainHeightAt(x, z), z)
  group.add(box(4.1, 3.9, 3.0, context.materials.darkRust, 0, 1.95, 0))
  group.add(box(4.45, 0.24, 3.35, context.materials.metal, 0, 4.05, 0))
  group.add(box(2.9, 0.62, 0.22, context.materials.blackMetal, 0, 2.45, -1.56))
  group.add(box(3.65, 0.88, 0.18, signMaterial('THE FORGE', '#ef6635'), 0, 3.45, -1.6))
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7a39,
    emissive: 0xff471d,
    emissiveIntensity: 2.35,
    roughness: 0.28,
    metalness: 0.28,
  })
  const core = cylinder(0.72, 0.72, 1.7, 12, coreMaterial, 0, 1.25, -1.52)
  core.rotation.x = Math.PI / 2
  group.add(core)
  group.add(box(0.22, 2.8, 0.22, materials.roadLine, -1.6, 1.55, -1.58))
  group.add(box(0.22, 2.8, 0.22, materials.roadLine, 1.6, 1.55, -1.58))
  context.scene.add(group)
  context.addCollider(x, z, 4.1, 3.0, 0.08)
  return { group, position: group.position, core }
}

function addTrafficLights(
  context: DockTownContext,
  materials: DockTownMaterials,
): void {
  const lensMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x351313, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: 0x332817, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: 0x132319, toneMapped: false }),
  ]
  const intersections: Array<[number, number, number]> = [
    [86, 72, 0],
    [132, 72, Math.PI],
    [132, 136, 0],
    [86, 166, Math.PI],
    [132, 166, Math.PI / 2],
  ]
  for (let index = 0; index < intersections.length; index += 1) {
    const [x, z, rotation] = intersections[index]
    const group = new THREE.Group()
    group.position.set(x + (rotation === 0 ? -6.5 : rotation === Math.PI ? 6.5 : 0), terrainHeightAt(x, z), z - 5.7)
    group.rotation.y = rotation
    group.rotation.z = index === 3 ? 0.055 : 0
    group.add(box(0.3, 6.6, 0.3, context.materials.metal, 0, 3.3, 0))
    group.add(box(6.9, 0.28, 0.28, context.materials.metal, 3.25, 6.35, 0))
    const signal = new THREE.Group()
    signal.position.set(6.05, 5.55, 0)
    signal.rotation.z = index === 2 ? -0.12 : 0
    signal.add(box(1.05, 2.8, 0.72, context.materials.blackMetal, 0, 0, 0))
    for (let lens = 0; lens < 3; lens += 1) {
      const face = cylinder(0.3, 0.3, 0.1, 12, lensMaterials[lens], 0, 0.82 - lens * 0.82, -0.4)
      face.rotation.x = Math.PI / 2
      signal.add(face)
    }
    group.add(signal)
    context.scene.add(group)
  }
  void materials
}

type FirePocket = {
  flame: THREE.Mesh
  glow: THREE.PointLight | null
  phase: number
}

function addFireSite(
  context: DockTownContext,
  x: number,
  z: number,
  large: boolean,
  lit: boolean,
): FirePocket {
  const ground = terrainHeightAt(x, z)
  const flameMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7b35,
    emissive: 0xff3f17,
    emissiveIntensity: 1.65,
    transparent: true,
    opacity: 0.86,
    roughness: 0.72,
  })
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(large ? 1.15 : 0.72, large ? 3.2 : 2.0, 7),
    flameMaterial,
  )
  flame.position.set(x, ground + (large ? 1.65 : 1.05), z)
  context.scene.add(flame)
  context.scene.add(box(
    large ? 3.2 : 2.2,
    0.45,
    large ? 2.8 : 1.8,
    context.materials.darkRust,
    x,
    ground + 0.24,
    z,
  ))
  const glow = lit ? new THREE.PointLight(0xff5a28, large ? 8 : 5, large ? 16 : 11, 2) : null
  if (glow) {
    glow.position.set(x, ground + 2.1, z)
    context.scene.add(glow)
  }
  return { flame, glow, phase: Math.random() * Math.PI * 2 }
}

function addFalloutHillsAndCloud(
  context: DockTownContext,
  materials: DockTownMaterials,
): void {
  const hillMaterial = materials.grass.clone()
  hillMaterial.color.setHex(0x241d18)
  hillMaterial.flatShading = true
  const hillSpecs = [
    { x: FALLOUT_HILLS.x + 9, z: FALLOUT_HILLS.z - 8, radius: 24, sx: 1.25, sz: 0.82 },
    { x: FALLOUT_HILLS.x - 17, z: FALLOUT_HILLS.z + 4, radius: 30, sx: 1.1, sz: 0.76 },
    { x: FALLOUT_HILLS.x - 38, z: FALLOUT_HILLS.z + 19, radius: 35, sx: 1.35, sz: 0.7 },
  ]
  for (const hill of hillSpecs) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(hill.radius, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      hillMaterial,
    )
    mesh.position.set(hill.x, -1.2, hill.z)
    mesh.scale.set(hill.sx, 0.62, hill.sz)
    context.scene.add(mesh)
  }

  const smokeMaterial = new THREE.MeshStandardMaterial({
    color: 0x51443d,
    emissive: 0x4b2116,
    emissiveIntensity: 0.24,
    roughness: 1,
    transparent: true,
    opacity: 0.92,
    flatShading: true,
  })
  const cloud = new THREE.Group()
  cloud.position.set(FALLOUT_HILLS.cloudX, 0, FALLOUT_HILLS.cloudZ)
  for (let level = 0; level < 8; level += 1) {
    const puff = new THREE.Mesh(
      new THREE.DodecahedronGeometry(7.2 + level * 1.25, 0),
      smokeMaterial,
    )
    puff.position.set((level % 2 - 0.5) * 3.2, 12 + level * 7.0, (level % 3 - 1) * 2.0)
    puff.scale.set(0.86, 1.38, 0.86)
    cloud.add(puff)
  }
  const capOffsets: Array<[number, number, number, number]> = [
    [-28, 67, 2, 16],
    [-18, 74, -3, 19],
    [-7, 79, 1, 22],
    [7, 80, -1, 23],
    [21, 75, 3, 19],
    [32, 68, -2, 15],
    [-14, 88, 2, 16],
    [2, 93, -2, 18],
    [18, 87, 1, 15],
  ]
  for (const [px, py, pz, radius] of capOffsets) {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), smokeMaterial)
    puff.position.set(px, py, pz)
    puff.scale.y = 0.74
    cloud.add(puff)
  }
  const underside = new THREE.PointLight(0xff4a22, 8.5, 120, 2)
  underside.position.set(0, 57, 0)
  cloud.add(underside)
  context.scene.add(cloud)

  const warning = box(16, 2.2, 0.22, signMaterial('ROAD CLOSED · FALLOUT'), -2, 4.2, 184)
  warning.rotation.y = -0.52
  context.scene.add(warning)
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
  const legHeight = 19.5
  for (const legX of [-2.5, 2.5]) {
    for (const legZ of [-2.5, 2.5]) {
      const leg = box(0.38, legHeight, 0.38, context.materials.metal, legX, legHeight / 2, legZ)
      leg.rotation.z = legX * -0.011
      leg.rotation.x = legZ * 0.011
      group.add(leg)
    }
  }
  for (const y of [4.2, 8.4, 12.6, 16.7]) {
    group.add(box(5.3, 0.18, 0.18, context.materials.rust, 0, y, -2.5))
    group.add(box(5.3, 0.18, 0.18, context.materials.rust, 0, y, 2.5))
    group.add(box(0.18, 0.18, 5.3, context.materials.rust, -2.5, y, 0))
    group.add(box(0.18, 0.18, 5.3, context.materials.rust, 2.5, y, 0))
  }
  const tank = cylinder(3.85, 3.85, 5.0, 18, context.materials.metal, 0, 22.0, 0)
  tank.scale.z = 0.92
  group.add(tank)
  group.add(cylinder(1.65, 3.65, 1.8, 16, context.materials.darkRust, 0, 25.35, 0))
  group.add(box(5.45, 3.9, 0.18, smileMaterial(), 0, 21.95, -3.72))
  const towerTimber = box(1.1, 18.6, 0.12, materials.wood, 3.15, 9.8, 0)
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
  const minX = Math.min(...polygon.map((point) => point.x))
  const maxX = Math.max(...polygon.map((point) => point.x))
  const minZ = Math.min(...polygon.map((point) => point.y))
  const maxZ = Math.max(...polygon.map((point) => point.y))

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
  while (trees.length < 184 && attempts < 1800) {
    attempts += 1
    const px = minX + random() * (maxX - minX)
    const pz = minZ + random() * (maxZ - minZ)
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
    { px: x - 18, pz: z - 9, width: 34, height: 21, rotation: 0.08 },
    { px: x + 4, pz: z + 3, width: 38, height: 23, rotation: -0.16 },
    { px: x - 15, pz: z + 15, width: 35, height: 21, rotation: 0.22 },
    { px: x + 18, pz: z - 11, width: 34, height: 22, rotation: Math.PI / 2 + 0.12 },
    { px: x - 27, pz: z + 1, width: 36, height: 22, rotation: Math.PI / 2 - 0.1 },
    { px: x + 12, pz: z + 17, width: 33, height: 21, rotation: Math.PI / 3 },
    { px: x, pz: z, width: 34, height: 24, rotation: -Math.PI / 4 },
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
    { px: x - 21, pz: z - 3, rotation: 0.32, phase: 0.4 },
    { px: x + 9, pz: z + 7, rotation: -0.62, phase: 2.1 },
    { px: x - 7, pz: z + 17, rotation: 1.05, phase: 4.3 },
    { px: x + 22, pz: z - 10, rotation: 0.74, phase: 5.6 },
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
  context.addCollider(161, 35, 78, 52, 0.8)
  context.addCollider(118, 38, 23, 35, 0.8)
  context.addCollider(208, 38, 22, 42, 0.8)
  context.addCollider(168, 62, 75, 12, 0.8)
  context.addCollider(158, 12, 88, 15, 0.8)

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
  const networks: Array<Array<[number, number]>> = [
    [[13, 7], [13, 21], [13, 37], [13, 54], [13, 68]],
    [[46, 7], [46, 21], [46, 38], [46, 54], [46, 68]],
    [[79, 7], [79, 21], [79, 38], [79, 54], [79, 68]],
    [[3, 78], [29, 78], [56, 78], [83, 78], [109, 78], [130, 78]],
    [[139, 78], [164, 78], [190, 78], [214, 78]],
    [[92, 142], [116, 142], [140, 142], [164, 142], [190, 142], [214, 142]],
  ]
  let globalIndex = 0
  for (const network of networks) {
    const wireTops: THREE.Vector3[] = []
    for (const [x, z] of network) {
      const ground = terrainHeightAt(x, z)
      const group = new THREE.Group()
      group.position.set(x, ground, z)
      group.rotation.z = (globalIndex % 3 - 1) * 0.022
      const pole = cylinder(0.15, 0.23, 7.2, 7, materials.wood, 0, 3.6, 0)
      mapGeometryToAtlas(pole.geometry, ATLAS_TILES.topLeft)
      group.add(pole)
      group.add(box(2.5, 0.16, 0.16, context.materials.darkRust, 0, 6.65, 0))
      group.add(cylinder(0.08, 0.08, 0.34, 6, context.materials.metal, -0.85, 6.92, 0))
      group.add(cylinder(0.08, 0.08, 0.34, 6, context.materials.metal, 0.85, 6.92, 0))
      context.scene.add(group)
      wireTops.push(new THREE.Vector3(x, ground + 6.95, z))
      globalIndex += 1
    }
    for (let index = 0; index < wireTops.length - 1; index += 1) {
      if ((globalIndex + index) % 9 === 0) continue
      context.scene.add(cableBetween(
        wireTops[index],
        wireTops[index + 1],
        materials.cable,
        (globalIndex + index) % 7 === 0 ? 1.4 : 0.65,
      ))
    }
  }
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
    fuel: kind === 'truck' ? 58 : 68,
    startingFuel: kind === 'truck' ? 58 : 68,
    fuelCapacity: 100,
  }
}

function addBoundaryBarricades(
  context: DockTownContext,
  materials: DockTownMaterials,
): void {
  const addGate = (x: number, z: number, depth: number, rotation = 0): void => {
    const group = new THREE.Group()
    group.position.set(x, terrainHeightAt(x, z), z)
    group.rotation.y = rotation
    for (const offset of [-depth * 0.34, 0, depth * 0.34]) {
      group.add(box(0.9, 1.1, depth * 0.24, materials.concrete, 0, 0.55, offset))
    }
    group.add(box(0.28, 1.8, depth, context.materials.darkRust, 0, 1.15, 0))
    group.add(box(0.34, 0.24, depth, context.materials.warning, 0, 2.0, 0))
    context.scene.add(group)
    const sine = Math.abs(Math.sin(rotation))
    context.addCollider(
      x,
      z,
      THREE.MathUtils.lerp(1.2, depth, sine),
      THREE.MathUtils.lerp(depth, 1.2, sine),
      0.22,
    )
  }

  // Every outward road ends physically inside this build. The future Shipyard,
  // beach and harbor remain separate selectable maps rather than walkable seams.
  addGate(-7.2, 187.8, 11.2, 0.22)
  addGate(-7.5, 72, 12.4)
  addGate(216.2, 72, 12.4)
  addGate(219.2, 136, 10.4)
  addGate(219.2, 166, 10.4)
}

export function buildDockTownDistrict(context: DockTownContext): DockTownDistrict {
  const materials = createMaterials(context.materials)
  for (const road of DOCK_TOWN_ROADS) addRoad(context, materials, road)

  // The southwest neighborhood follows the three drawn residential rows, with
  // paved streets and a cross street separating the north and south blocks.
  const houses: Array<[number, number, number]> = [
    [7, 13, 1], [38, 13, 2], [71, 13, 1],
    [7, 25, 2], [38, 25, 1], [71, 25, 2],
    [7, 48, 2], [38, 48, 1], [71, 48, 2],
    [7, 60, 1], [38, 60, 2], [71, 60, 1],
  ]
  for (const [x, z, floors] of houses) {
    addHouse(context, materials, x, z, 8.4, 8.2, floors)
  }

  // The dense tower block stands opposite the bar block across Water Tower
  // Avenue. These remain closed, detailed street walls with few gaps.
  addClosedBuilding(context, materials, 48, 91, 14, 13, 5, 'CIVIC HOTEL', materials.brick)
  addClosedBuilding(context, materials, 66, 91, 14, 12, 6, 'TOWER HOUSE', materials.concrete)
  addClosedBuilding(context, materials, 96, 91, 9, 13, 4, 'CITY ROOMS', materials.painted)
  addWaterTower(context, materials)
  const barTower = addBar(context, materials)
  const fuelStation = addGasStation(context, materials)

  // St. Agnes and its attached ER form the main eastern gameplay interior.
  // The ambulance apron sits directly across Main Street from the forest.
  addHospitalComplex(context, materials)

  // Two modest enterable factories sit beside the paved Shipyard Road bend.
  addSmallFactory(context, materials, 21, 148, 'MERCER MACHINE')
  addSmallFactory(context, materials, 54, 127, 'ASHFALL TOOL')
  const upgradeMachine = addForge(context, materials)

  // The shopping district is three close building rows running north-south.
  // Alleys between the rows connect Shopping Street and Market Street.
  addClosedBuilding(context, materials, 147, 150, 14, 11, 4, 'ALDER DEPT', materials.brick)
  addEnterableBuilding(context, materials, 166, 150, 15, 11, 4, 'FIVE & DIME', materials.painted)
  addEnterableBuilding(context, materials, 196, 150, 17, 11, 4, 'NORTH MARKET', materials.concrete)
  addClosedBuilding(context, materials, 147, 181, 14, 13, 5, 'MILLER BLOCK', materials.concrete)
  addClosedBuilding(context, materials, 166, 181, 15, 13, 4, 'GRAYSON STORE', materials.brick)
  addEnterableBuilding(context, materials, 196, 181, 17, 13, 4, 'CROWN OUTFITTERS', materials.painted)
  for (const alleyX of [156.5, 181]) {
    const alley = box(2.5, 0.06, 55, materials.concrete, alleyX, terrainHeightAt(alleyX, 166) + 0.1, 166)
    context.scene.add(alley)
  }

  // The southeast forest has visible depth and concealed fire but no traversable
  // interior. Its north edge is a zombie entrance directly across Main Street
  // from the hospital.
  const forestFire = addImpassableBurningForest(context, materials)

  // Only light, sparse tree cover appears elsewhere in this town map.
  addTreeMass(context, materials, [
    { x: 7, z: 36, width: 8, depth: 8, count: 4, seed: 1204 },
    { x: 38, z: 36, width: 8, depth: 8, count: 4, seed: 1205 },
    { x: 71, z: 36, width: 8, depth: 8, count: 4, seed: 1206 },
    { x: 4, z: 159, width: 13, depth: 31, count: 17, seed: 1207 },
    { x: 75, z: 180, width: 12, depth: 13, count: 8, seed: 1208 },
  ])

  const roadFires = [
    addFireSite(context, 120, 62, true, true),
    addFireSite(context, 214, 124, false, false),
    addFireSite(context, 142, 162, false, true),
    addFireSite(context, 59, 143, true, true),
    addFireSite(context, 31, 67, false, false),
    addFireSite(context, 124, 70, false, true),
  ]
  addFalloutHillsAndCloud(context, materials)
  addUtilityPoles(context, materials)
  addTrafficLights(context, materials)
  addBoundaryBarricades(context, materials)

  const vehicles = [
    addVehicle(context, 'town-pickup', 'TOWN PICKUP', 'truck', 101, 67, Math.PI / 2),
    addVehicle(context, 'neighborhood-sedan', 'NEIGHBORHOOD SEDAN', 'buggy', 65, 43, 0),
  ]

  return {
    vehicles,
    fuelStation,
    towers: [barTower],
    upgradeMachine,
    walkableZones: [],
    update: (_dt, elapsed) => {
      upgradeMachine.core.rotation.z += _dt * 0.9
      upgradeMachine.core.scale.setScalar(0.96 + Math.sin(elapsed * 4.2) * 0.04)
      for (const pocket of forestFire) {
        pocket.material.emissiveIntensity = 1.05 + Math.sin(elapsed * 3.2 + pocket.phase) * 0.34
      }
      for (const pocket of roadFires) {
        const pulse = 0.88 + Math.sin(elapsed * 7.2 + pocket.phase) * 0.12
        pocket.flame.scale.set(pulse, 0.88 + pulse * 0.2, pulse)
        if (pocket.glow) pocket.glow.intensity = 5.2 * pulse
      }
    },
  }
}
