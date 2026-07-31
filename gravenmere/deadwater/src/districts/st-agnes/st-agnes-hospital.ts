import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { EnvironmentMaterials } from '../../environment'
import {
  HOSPITAL_FOOTPRINT,
  HOSPITAL_POSITION,
} from '../dock-town-plan'
import { terrainHeightAt } from '../dock-town-terrain'

const TILE = 4
const WALL_HEIGHT = 3.2
const KIT_URL = '/assets/st-agnes/st-agnes-kit.glb'

type DistrictMaterials = {
  asphalt: THREE.MeshStandardMaterial
  concrete: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
  roof: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  roadLine: THREE.MeshBasicMaterial
}

type StAgnesContext = {
  scene: THREE.Scene
  materials: EnvironmentMaterials
  shotTargets: THREE.Object3D[]
  addCollider: (x: number, z: number, width: number, depth: number, padding?: number) => void
}

export type StAgnesOptions = {
  context: StAgnesContext
  materials: DistrictMaterials
}

type ModuleName =
  | 'Wall'
  | 'WallDoorway'
  | 'Wall_Corner'
  | 'Floor'
  | 'Ceiling'
  | 'Pillar'
  | 'Stairs'
  | 'Stairs_Landing'
  | 'DoorwayConnector'

type ModulePlacement = {
  name: ModuleName
  x: number
  y: number
  z: number
  rotationY?: number
  scaleX?: number
  scaleY?: number
  scaleZ?: number
}

type GridCell = {
  gx: number
  gz: number
}

type Edge = 'north' | 'south' | 'east' | 'west'

type PropBox = {
  width: number
  height: number
  depth: number
  x: number
  y: number
  z: number
  rotationY?: number
}

type PropCylinder = {
  radiusTop: number
  radiusBottom: number
  height: number
  segments: number
  x: number
  y: number
  z: number
  rotationX?: number
  rotationZ?: number
}

type PreviewView = 'entrance' | 'lobby' | 'west-ward' | 'east-ward'

const unitBox = new THREE.BoxGeometry(1, 1, 1)
const instanceMatrix = new THREE.Matrix4()
const instancePosition = new THREE.Vector3()
const instanceScale = new THREE.Vector3()
const instanceQuaternion = new THREE.Quaternion()
const instanceEuler = new THREE.Euler()
let kitPromise: Promise<THREE.Group> | null = null

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

function makeTextMaterial(
  text: string,
  accent = '#9e3f2e',
  background = '#171514',
): THREE.MeshBasicMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const draw = canvas.getContext('2d')!
  draw.fillStyle = background
  draw.fillRect(0, 0, canvas.width, canvas.height)
  draw.strokeStyle = accent
  draw.lineWidth = 8
  draw.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
  draw.fillStyle = '#e3ded2'
  draw.font = '900 38px ui-monospace, monospace'
  draw.textAlign = 'center'
  draw.textBaseline = 'middle'
  draw.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
}

function addBoxBatch(
  group: THREE.Group,
  material: THREE.Material,
  specs: PropBox[],
  shotTargets?: THREE.Object3D[],
): THREE.InstancedMesh | null {
  if (specs.length === 0) return null
  const mesh = new THREE.InstancedMesh(unitBox, material, specs.length)
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index]
    instancePosition.set(spec.x, spec.y, spec.z)
    instanceEuler.set(0, spec.rotationY ?? 0, 0)
    instanceQuaternion.setFromEuler(instanceEuler)
    instanceScale.set(spec.width, spec.height, spec.depth)
    instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale)
    mesh.setMatrixAt(index, instanceMatrix)
  }
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  mesh.userData.blocksShot = Boolean(shotTargets)
  group.add(mesh)
  if (shotTargets) shotTargets.push(mesh)
  return mesh
}

function addCylinderBatch(
  group: THREE.Group,
  material: THREE.Material,
  specs: PropCylinder[],
): THREE.InstancedMesh | null {
  if (specs.length === 0) return null
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 10)
  const mesh = new THREE.InstancedMesh(geometry, material, specs.length)
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index]
    instancePosition.set(spec.x, spec.y, spec.z)
    instanceEuler.set(spec.rotationX ?? 0, 0, spec.rotationZ ?? 0)
    instanceQuaternion.setFromEuler(instanceEuler)
    instanceScale.set(spec.radiusBottom, spec.height, spec.radiusTop)
    instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale)
    mesh.setMatrixAt(index, instanceMatrix)
  }
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
  mesh.computeBoundingSphere()
  group.add(mesh)
  return mesh
}

function cellKey(gx: number, gz: number): string {
  return `${gx},${gz}`
}

function edgeKey(gx: number, gz: number, edge: Edge): string {
  return `${gx},${gz},${edge}`
}

function cellsForHospital(): GridCell[] {
  const cells = new Map<string, GridCell>()
  const addRect = (minX: number, maxX: number, minZ: number, maxZ: number): void => {
    for (let gx = minX; gx <= maxX; gx += 1) {
      for (let gz = minZ; gz <= maxZ; gz += 1) {
        cells.set(cellKey(gx, gz), { gx, gz })
      }
    }
  }

  // Street-facing administration and ER block.
  addRect(-9, 9, 0, 3)
  // Two long ward pavilions.
  addRect(-9, -4, 4, 10)
  addRect(4, 9, 4, 10)
  // Narrow transfer spine and the rear cross hall.
  addRect(-1, 1, 4, 8)
  addRect(-3, 3, 7, 8)
  return [...cells.values()]
}

function centerForCell(cell: GridCell): THREE.Vector2 {
  return new THREE.Vector2(cell.gx * TILE, -21 + cell.gz * TILE)
}

function boundaryPlacements(cells: GridCell[]): ModulePlacement[] {
  const occupied = new Set(cells.map((cell) => cellKey(cell.gx, cell.gz)))
  const doors = new Set<string>([
    edgeKey(0, 0, 'south'),
    edgeKey(6, 0, 'south'),
    edgeKey(-9, 6, 'west'),
    edgeKey(9, 6, 'east'),
    edgeKey(-6, 10, 'north'),
    edgeKey(6, 10, 'north'),
  ])
  const placements: ModulePlacement[] = []

  for (const cell of cells) {
    const center = centerForCell(cell)
    const edges: Array<{
      edge: Edge
      neighborX: number
      neighborZ: number
      x: number
      z: number
      rotationY: number
    }> = [
      {
        edge: 'north',
        neighborX: cell.gx,
        neighborZ: cell.gz + 1,
        x: center.x,
        z: center.y + TILE / 2,
        rotationY: 0,
      },
      {
        edge: 'south',
        neighborX: cell.gx,
        neighborZ: cell.gz - 1,
        x: center.x,
        z: center.y - TILE / 2,
        rotationY: 0,
      },
      {
        edge: 'east',
        neighborX: cell.gx + 1,
        neighborZ: cell.gz,
        x: center.x + TILE / 2,
        z: center.y,
        rotationY: Math.PI / 2,
      },
      {
        edge: 'west',
        neighborX: cell.gx - 1,
        neighborZ: cell.gz,
        x: center.x - TILE / 2,
        z: center.y,
        rotationY: Math.PI / 2,
      },
    ]

    for (const side of edges) {
      if (occupied.has(cellKey(side.neighborX, side.neighborZ))) continue
      placements.push({
        name: doors.has(edgeKey(cell.gx, cell.gz, side.edge)) ? 'WallDoorway' : 'Wall',
        x: side.x,
        y: 0,
        z: side.z,
        rotationY: side.rotationY,
      })
    }
  }
  return placements
}

function horizontalWall(
  placements: ModulePlacement[],
  z: number,
  xValues: number[],
  doorwayXs: number[] = [],
): void {
  for (const x of xValues) {
    placements.push({
      name: doorwayXs.includes(x) ? 'WallDoorway' : 'Wall',
      x,
      y: 0,
      z,
    })
  }
}

function verticalWall(
  placements: ModulePlacement[],
  x: number,
  zValues: number[],
  doorwayZs: number[] = [],
): void {
  for (const z of zValues) {
    placements.push({
      name: doorwayZs.includes(z) ? 'WallDoorway' : 'Wall',
      x,
      y: 0,
      z,
      rotationY: Math.PI / 2,
    })
  }
}

function interiorPlacements(): ModulePlacement[] {
  const placements: ModulePlacement[] = []

  // Administration block: reception lobby, triage, pharmacy and offices.
  horizontalWall(
    placements,
    -15,
    [-34, -30, -26, -22, -18, -14, -10, -6, -2, 2, 6, 10, 14, 18, 22, 26, 30, 34],
    [-10, -2, 6, 22],
  )
  horizontalWall(
    placements,
    -7,
    [-34, -30, -26, -22, -18, -14, 14, 18, 22, 26, 30, 34],
    [-22, 22],
  )
  verticalWall(placements, -14, [-21, -17, -13, -9], [-17])
  verticalWall(placements, 14, [-21, -17, -13, -9], [-17])
  verticalWall(placements, -26, [-21, -17, -13, -9], [-13])
  verticalWall(placements, 26, [-21, -17, -13, -9], [-13])

  // Ward corridors. Four-metre circulation lanes remain clear for touch play.
  const wardZ = [-5, -1, 3, 7, 11, 15, 19]
  verticalWall(placements, -28, wardZ, [-5, 3, 11, 19])
  verticalWall(placements, -24, wardZ, [-1, 7, 15])
  verticalWall(placements, 24, wardZ, [-1, 7, 15])
  verticalWall(placements, 28, wardZ, [-5, 3, 11, 19])

  for (const z of [-3, 5, 13]) {
    horizontalWall(placements, z, [-36, -32, -20, -16, 16, 20, 32, 36])
  }

  // Transfer spine and rear cross hall.
  verticalWall(placements, -4, [-5, -1, 3], [-1])
  verticalWall(placements, 4, [-5, -1, 3], [3])
  horizontalWall(placements, 5, [-2, 2], [2])
  horizontalWall(placements, 13, [-10, -6, -2, 2, 6, 10], [-6, 6])

  return placements
}

function addWallCollider(
  context: StAgnesContext,
  placement: ModulePlacement,
  originX: number,
  originZ: number,
): void {
  const vertical = Math.abs(Math.sin(placement.rotationY ?? 0)) > 0.5
  const x = originX + placement.x
  const z = originZ + placement.z
  if (placement.name === 'WallDoorway') {
    const sideLength = 1.05
    const offset = 1.46
    if (vertical) {
      context.addCollider(x, z - offset, 0.3, sideLength, 0.035)
      context.addCollider(x, z + offset, 0.3, sideLength, 0.035)
    } else {
      context.addCollider(x - offset, z, sideLength, 0.3, 0.035)
      context.addCollider(x + offset, z, sideLength, 0.3, 0.035)
    }
    return
  }
  context.addCollider(
    x,
    z,
    vertical ? 0.3 : TILE,
    vertical ? TILE : 0.3,
    0.035,
  )
}

function cloneMaterial(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  return Array.isArray(material)
    ? material.map((entry) => entry.clone())
    : material.clone()
}

function findTemplate(root: THREE.Object3D, name: ModuleName): THREE.Mesh {
  const named = root.getObjectByName(name)
  if (named instanceof THREE.Mesh) return named
  let mesh: THREE.Mesh | null = null
  named?.traverse((child) => {
    if (!mesh && child instanceof THREE.Mesh) mesh = child
  })
  if (!mesh) throw new Error(`Missing St. Agnes module ${name}`)
  return mesh
}

async function loadKit(): Promise<THREE.Group> {
  if (!kitPromise) {
    kitPromise = new GLTFLoader().loadAsync(KIT_URL).then((gltf) => {
      gltf.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const entries = Array.isArray(child.material) ? child.material : [child.material]
        for (const entry of entries) {
          if (!(entry instanceof THREE.MeshStandardMaterial)) continue
          if (entry.name.includes('Wall')) {
            entry.color.setHex(0xc9d0cc)
            entry.emissive.setHex(0x252827)
            entry.emissiveIntensity = 0.16
            entry.roughness = 0.94
          } else if (entry.name.includes('Floor')) {
            entry.color.setHex(0xaab6b0)
            entry.emissive.setHex(0x171b19)
            entry.emissiveIntensity = 0.1
            entry.roughness = 0.9
          } else if (entry.name.includes('Metal')) {
            entry.color.setHex(0x8b908d)
            entry.roughness = 0.78
          }
        }
      })
      return gltf.scene
    })
  }
  return kitPromise
}

function addModuleInstances(
  group: THREE.Group,
  templates: THREE.Group,
  placements: ModulePlacement[],
  shotTargets: THREE.Object3D[],
): void {
  const byName = new Map<ModuleName, ModulePlacement[]>()
  for (const placement of placements) {
    const bucket = byName.get(placement.name)
    if (bucket) bucket.push(placement)
    else byName.set(placement.name, [placement])
  }

  for (const [name, entries] of byName) {
    const template = findTemplate(templates, name)
    const mesh = new THREE.InstancedMesh(
      template.geometry,
      cloneMaterial(template.material),
      entries.length,
    )
    mesh.name = `st-agnes-${name}`
    mesh.userData.blocksShot = true
    for (let index = 0; index < entries.length; index += 1) {
      const placement = entries[index]
      instancePosition.set(placement.x, placement.y, placement.z)
      instanceEuler.set(0, placement.rotationY ?? 0, 0)
      instanceQuaternion.setFromEuler(instanceEuler)
      instanceScale.set(
        placement.scaleX ?? 1,
        placement.scaleY ?? 1,
        placement.scaleZ ?? 1,
      )
      instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale)
      mesh.setMatrixAt(index, instanceMatrix)
    }
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
    group.add(mesh)
    shotTargets.push(mesh)
  }
}

function addExteriorShell(
  group: THREE.Group,
  context: StAgnesContext,
  materials: DistrictMaterials,
): void {
  const upperConcrete = new THREE.MeshStandardMaterial({
    color: 0x747872,
    roughness: 0.96,
    metalness: 0,
    emissive: 0x171918,
    emissiveIntensity: 0.16,
  })
  const trim = context.materials.darkRust.clone()
  trim.color.setHex(0x403733)

  // Only the non-playable upper storeys are solid masses. The entire playable
  // ground floor is built by the imported modular interior kit.
  group.add(box(76, 10.9, 16, upperConcrete, 0, 8.65, -15))
  group.add(box(24, 7.55, 30, upperConcrete, -26, 6.975, 7))
  group.add(box(24, 7.55, 30, upperConcrete, 26, 6.975, 7))
  group.add(box(28, 3.85, 8, upperConcrete, 0, 5.125, 9))

  group.add(box(76.8, 0.45, 16.8, materials.roof, 0, 14.32, -15))
  group.add(box(24.7, 0.42, 30.7, materials.roof, -26, 10.96, 7))
  group.add(box(24.7, 0.42, 30.7, materials.roof, 26, 10.96, 7))
  group.add(box(28.7, 0.4, 8.7, materials.roof, 0, 7.25, 9))

  for (const y of [4.85, 8.05, 11.25]) {
    group.add(box(76.4, 0.22, 16.35, trim, 0, y, -15))
  }
  for (const side of [-1, 1]) {
    for (const y of [4.85, 8.05]) {
      group.add(box(24.35, 0.2, 30.35, trim, side * 26, y, 7))
    }
  }

  const upperWindows: PropBox[] = []
  for (const y of [5.4, 8.6, 11.8]) {
    for (let x = -34; x <= 34; x += 4) {
      upperWindows.push({ width: 1.45, height: 1.55, depth: 0.12, x, y, z: -23.08 })
    }
  }
  for (const side of [-1, 1]) {
    for (const y of [5.35, 8.55]) {
      for (const z of [-4, 1, 6, 11, 16, 20]) {
        upperWindows.push({
          width: 0.12,
          height: 1.45,
          depth: 1.35,
          x: side * 38.08,
          y,
          z,
        })
      }
    }
  }
  addBoxBatch(group, materials.glass, upperWindows)

  const canopy = new THREE.Group()
  canopy.position.set(0, 0, -24.5)
  canopy.add(box(15.5, 0.38, 6.4, materials.roof, 0, 3.65, 0))
  for (const x of [-6.6, 6.6]) {
    canopy.add(box(0.34, 3.55, 0.34, context.materials.metal, x, 1.78, -2.35))
    canopy.add(box(0.34, 3.55, 0.34, context.materials.metal, x, 1.78, 2.35))
  }
  canopy.add(box(20, 1.22, 0.18, makeTextMaterial('ST. AGNES HOSPITAL'), 0, 5.05, 2.95))
  canopy.add(box(9.5, 0.84, 0.16, makeTextMaterial('EMERGENCY', '#d44735'), 24, 3.8, 2.95))
  const entryGlass = materials.glass.clone()
  entryGlass.color.setHex(0x78959a)
  entryGlass.emissive.setHex(0x26383b)
  entryGlass.emissiveIntensity = 0.34
  entryGlass.transparent = true
  entryGlass.opacity = 0.72
  canopy.add(box(1.45, 2.55, 0.09, entryGlass, -1.38, 1.32, 2.98))
  canopy.add(box(1.45, 2.55, 0.09, entryGlass, 1.38, 1.32, 2.98))
  const emergencyGlow = new THREE.MeshBasicMaterial({ color: 0xe65c45, toneMapped: false })
  canopy.add(box(2.8, 0.16, 0.16, emergencyGlow, 24, 2.92, 2.98))
  group.add(canopy)
}

function addFloorAndCeilingPlacements(cells: GridCell[]): ModulePlacement[] {
  const placements: ModulePlacement[] = []
  for (const cell of cells) {
    const center = centerForCell(cell)
    placements.push({ name: 'Floor', x: center.x, y: 0.02, z: center.y })
    placements.push({ name: 'Ceiling', x: center.x, y: WALL_HEIGHT - 0.12, z: center.y })
  }
  return placements
}

function makePropMaterials(context: StAgnesContext) {
  const hospitalBlue = new THREE.MeshStandardMaterial({ color: 0x506a70, roughness: 0.88 })
  const mattress = new THREE.MeshStandardMaterial({ color: 0xb3b9b3, roughness: 0.94 })
  const pillow = new THREE.MeshStandardMaterial({ color: 0xd6d4c8, roughness: 1 })
  const curtain = new THREE.MeshStandardMaterial({
    color: 0x748f8a,
    roughness: 1,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  })
  const cabinet = new THREE.MeshStandardMaterial({ color: 0x727974, roughness: 0.82, metalness: 0.18 })
  const screen = new THREE.MeshStandardMaterial({
    color: 0x172226,
    emissive: 0x31545a,
    emissiveIntensity: 0.62,
    roughness: 0.32,
  })
  const light = new THREE.MeshBasicMaterial({ color: 0xffddbd, toneMapped: false })
  const red = context.materials.rust.clone()
  red.color.setHex(0x8d322b)
  return { hospitalBlue, mattress, pillow, curtain, cabinet, screen, light, red }
}

function addBed(
  group: THREE.Group,
  context: StAgnesContext,
  propMaterials: ReturnType<typeof makePropMaterials>,
  x: number,
  z: number,
  rotationY: number,
): void {
  const bed = new THREE.Group()
  bed.position.set(x, 0, z)
  bed.rotation.y = rotationY
  bed.add(box(2.1, 0.18, 0.94, context.materials.metal, 0, 0.56, 0))
  bed.add(box(1.86, 0.22, 0.82, propMaterials.mattress, 0, 0.72, 0))
  bed.add(box(0.42, 0.12, 0.68, propMaterials.pillow, -0.66, 0.89, 0))
  for (const offsetX of [-0.86, 0.86]) {
    for (const offsetZ of [-0.37, 0.37]) {
      bed.add(cylinder(0.065, 0.065, 0.48, 8, context.materials.blackMetal, offsetX, 0.28, offsetZ))
    }
  }
  bed.add(box(0.09, 0.55, 0.92, context.materials.metal, -1.03, 0.82, 0))
  bed.add(box(0.07, 0.38, 0.88, context.materials.metal, 1.03, 0.72, 0))
  group.add(bed)

  const vertical = Math.abs(Math.sin(rotationY)) > 0.5
  context.addCollider(
    HOSPITAL_POSITION.x + x,
    HOSPITAL_POSITION.y + z,
    vertical ? 1.1 : 2.25,
    vertical ? 2.25 : 1.1,
    0.05,
  )
}

function addNurseStation(
  group: THREE.Group,
  context: StAgnesContext,
  propMaterials: ReturnType<typeof makePropMaterials>,
  x: number,
  z: number,
): void {
  const station = new THREE.Group()
  station.position.set(x, 0, z)
  station.add(box(5.6, 1.05, 1.35, propMaterials.cabinet, 0, 0.525, 0))
  station.add(box(5.85, 0.16, 1.55, context.materials.metal, 0, 1.1, 0))
  for (const screenX of [-1.6, 0, 1.6]) {
    station.add(box(0.72, 0.46, 0.1, propMaterials.screen, screenX, 1.51, -0.25))
    station.add(box(0.08, 0.3, 0.08, context.materials.blackMetal, screenX, 1.27, -0.18))
  }
  station.add(box(2.8, 0.72, 0.2, makeTextMaterial('NURSES', '#536f72'), 0, 2.35, 0.72))
  group.add(station)
  context.addCollider(HOSPITAL_POSITION.x + x, HOSPITAL_POSITION.y + z, 5.9, 1.65, 0.08)
}

function addReception(
  group: THREE.Group,
  context: StAgnesContext,
  propMaterials: ReturnType<typeof makePropMaterials>,
): void {
  const reception = new THREE.Group()
  reception.position.set(0, 0, -17.4)
  reception.add(box(9.5, 1.08, 1.4, propMaterials.cabinet, 0, 0.54, 0))
  reception.add(box(9.8, 0.16, 1.65, context.materials.metal, 0, 1.12, 0))
  reception.add(box(1.35, 1.08, 4.3, propMaterials.cabinet, -4.1, 0.54, 1.65))
  reception.add(box(1.35, 1.08, 4.3, propMaterials.cabinet, 4.1, 0.54, 1.65))
  for (const x of [-2.6, 0, 2.6]) {
    reception.add(box(0.7, 0.44, 0.1, propMaterials.screen, x, 1.5, -0.24))
    reception.add(box(0.08, 0.28, 0.08, context.materials.blackMetal, x, 1.27, -0.18))
  }
  group.add(reception)
  context.addCollider(HOSPITAL_POSITION.x, HOSPITAL_POSITION.y - 17.4, 9.9, 1.7, 0.08)
  context.addCollider(HOSPITAL_POSITION.x - 4.1, HOSPITAL_POSITION.y - 15.75, 1.6, 4.5, 0.08)
  context.addCollider(HOSPITAL_POSITION.x + 4.1, HOSPITAL_POSITION.y - 15.75, 1.6, 4.5, 0.08)
}

function addWaitingChairs(
  group: THREE.Group,
  context: StAgnesContext,
  propMaterials: ReturnType<typeof makePropMaterials>,
): void {
  const seats: PropBox[] = []
  const backs: PropBox[] = []
  const legs: PropCylinder[] = []
  for (const side of [-1, 1]) {
    for (const z of [-20.2, -18.2, -16.2]) {
      const x = side * 8.6
      seats.push({ width: 1.15, height: 0.16, depth: 0.78, x, y: 0.56, z })
      backs.push({ width: 1.15, height: 0.84, depth: 0.14, x, y: 1.02, z: z + side * 0.31 })
      for (const legX of [-0.43, 0.43]) {
        legs.push({ radiusTop: 0.06, radiusBottom: 0.06, height: 0.52, segments: 7, x: x + legX, y: 0.26, z })
      }
    }
  }
  addBoxBatch(group, propMaterials.hospitalBlue, seats)
  addBoxBatch(group, propMaterials.hospitalBlue, backs)
  addCylinderBatch(group, context.materials.blackMetal, legs)
}

function addRoomFurniture(
  group: THREE.Group,
  context: StAgnesContext,
  propMaterials: ReturnType<typeof makePropMaterials>,
): void {
  const bedSpecs: Array<[number, number, number]> = []
  for (const z of [-3, 5, 13, 19]) {
    bedSpecs.push([-35, z, 0], [-17, z, Math.PI], [17, z, 0], [35, z, Math.PI])
  }
  for (const [x, z, rotation] of bedSpecs) addBed(group, context, propMaterials, x, z, rotation)

  const cabinetSpecs: PropBox[] = []
  for (const [x, z] of bedSpecs.map(([bedX, bedZ]) => [bedX + (bedX < 0 ? 1.7 : -1.7), bedZ + 1.2])) {
    cabinetSpecs.push({ width: 0.82, height: 1.25, depth: 0.72, x, y: 0.625, z })
    cabinetSpecs.push({ width: 0.92, height: 0.12, depth: 0.82, x, y: 1.29, z })
  }
  addBoxBatch(group, propMaterials.cabinet, cabinetSpecs, context.shotTargets)

  const curtainSpecs: PropBox[] = []
  for (const [x, z] of [[-31, -3], [-31, 5], [-31, 13], [31, -3], [31, 5], [31, 13]] as Array<[number, number]>) {
    curtainSpecs.push({ width: 0.08, height: 2.2, depth: 3.15, x, y: 1.45, z })
  }
  addBoxBatch(group, propMaterials.curtain, curtainSpecs)
}

function addCorridorDetails(
  group: THREE.Group,
  context: StAgnesContext,
  propMaterials: ReturnType<typeof makePropMaterials>,
): void {
  const lights: PropBox[] = []
  const wallRails: PropBox[] = []
  const vents: PropBox[] = []
  const corridorCenters = [-26, 0, 26]
  for (const x of corridorCenters) {
    const zValues = x === 0 ? [-19, -15, -11, -5, -1, 3, 7, 11] : [-5, -1, 3, 7, 11, 15, 19]
    for (const z of zValues) {
      lights.push({ width: x === 0 ? 2.8 : 0.58, height: 0.06, depth: x === 0 ? 0.58 : 2.8, x, y: 3.07, z })
      vents.push({ width: 0.58, height: 0.04, depth: 0.58, x: x + 1.05, y: 3.055, z: z + 1.1 })
    }
  }
  for (const side of [-1, 1]) {
    for (const z of [-3, 5, 13, 19]) {
      wallRails.push({ width: 0.14, height: 0.16, depth: 3.2, x: side * 28.18, y: 1.02, z })
      wallRails.push({ width: 0.14, height: 0.16, depth: 3.2, x: side * 23.82, y: 1.02, z })
    }
  }
  addBoxBatch(group, propMaterials.light, lights)
  addBoxBatch(group, context.materials.metal, vents)
  addBoxBatch(group, propMaterials.hospitalBlue, wallRails)

  const gurneyMaterial = propMaterials.mattress.clone()
  gurneyMaterial.color.setHex(0x899a95)
  for (const [x, z, rotation] of [[0, -9, 0], [-26, 9, Math.PI / 2], [26, 15, Math.PI / 2]] as Array<[number, number, number]>) {
    const gurney = new THREE.Group()
    gurney.position.set(x, 0, z)
    gurney.rotation.y = rotation
    gurney.add(box(2.05, 0.16, 0.82, gurneyMaterial, 0, 0.92, 0))
    gurney.add(box(2.16, 0.1, 0.94, context.materials.metal, 0, 0.73, 0))
    for (const wheelX of [-0.82, 0.82]) {
      for (const wheelZ of [-0.32, 0.32]) {
        const wheel = cylinder(0.09, 0.09, 0.12, 8, context.materials.blackMetal, wheelX, 0.25, wheelZ)
        wheel.rotation.x = Math.PI / 2
        gurney.add(wheel)
        gurney.add(box(0.06, 0.45, 0.06, context.materials.metal, wheelX, 0.52, wheelZ))
      }
    }
    group.add(gurney)
  }
}

function addClinicalProps(
  group: THREE.Group,
  context: StAgnesContext,
): void {
  const props = makePropMaterials(context)
  addReception(group, context, props)
  addWaitingChairs(group, context, props)
  addNurseStation(group, context, props, -26, 8)
  addNurseStation(group, context, props, 26, 8)
  addRoomFurniture(group, context, props)
  addCorridorDetails(group, context, props)

  const signage: Array<[string, number, number, number]> = [
    ['TRIAGE', -20, 2.45, -14.82],
    ['PHARMACY', 20, 2.45, -14.82],
    ['WARD A', -26, 2.45, -6.82],
    ['WARD B', 26, 2.45, -6.82],
    ['ISOLATION', 0, 2.45, 5.18],
  ]
  for (const [label, x, y, z] of signage) {
    group.add(box(4.6, 0.66, 0.08, makeTextMaterial(label, '#516b6e'), x, y, z))
  }

  const oxygenTanks: PropCylinder[] = []
  for (const [x, z] of [[-21.5, 17], [-18.5, 17], [18.5, 17], [21.5, 17]] as Array<[number, number]>) {
    oxygenTanks.push({ radiusTop: 0.19, radiusBottom: 0.23, height: 1.38, segments: 10, x, y: 0.69, z })
  }
  addCylinderBatch(group, props.hospitalBlue, oxygenTanks)
}

function installPreviewCamera(scene: THREE.Scene): void {
  const params = new URLSearchParams(location.search)
  if (!params.has('hospitalPreview')) return
  const camera = scene.children.find(
    (child): child is THREE.PerspectiveCamera => child instanceof THREE.PerspectiveCamera,
  )
  if (!camera) return

  const views: Record<PreviewView, { position: THREE.Vector3; target: THREE.Vector3 }> = {
    entrance: {
      position: new THREE.Vector3(HOSPITAL_POSITION.x - 30, 9, HOSPITAL_POSITION.y - 33),
      target: new THREE.Vector3(HOSPITAL_POSITION.x, 4.8, HOSPITAL_POSITION.y - 15),
    },
    lobby: {
      position: new THREE.Vector3(HOSPITAL_POSITION.x - 7.2, 1.72, HOSPITAL_POSITION.y - 19.8),
      target: new THREE.Vector3(HOSPITAL_POSITION.x + 1.2, 1.45, HOSPITAL_POSITION.y - 9.2),
    },
    'west-ward': {
      position: new THREE.Vector3(HOSPITAL_POSITION.x - 26, 1.72, HOSPITAL_POSITION.y - 4),
      target: new THREE.Vector3(HOSPITAL_POSITION.x - 26, 1.55, HOSPITAL_POSITION.y + 18),
    },
    'east-ward': {
      position: new THREE.Vector3(HOSPITAL_POSITION.x + 26, 1.72, HOSPITAL_POSITION.y + 18),
      target: new THREE.Vector3(HOSPITAL_POSITION.x + 26, 1.55, HOSPITAL_POSITION.y - 4),
    },
  }

  camera.fov = 72
  camera.near = 0.05
  camera.updateProjectionMatrix()
  camera.children.forEach((child) => { child.visible = false })

  const updateView = (view: PreviewView): void => {
    const selected = views[view]
    camera.position.copy(selected.position)
    camera.lookAt(selected.target)
    camera.updateMatrixWorld(true)
  }

  const initial = params.get('hospitalPreview') as PreviewView | null
  updateView(initial && initial in views ? initial : 'entrance')
  ;(window as unknown as { setStAgnesPreview?: (view: PreviewView) => void }).setStAgnesPreview = updateView
}

export function addStAgnesHospital({ context, materials }: StAgnesOptions): THREE.Group {
  const originX = HOSPITAL_POSITION.x
  const originZ = HOSPITAL_POSITION.y
  const ground = terrainHeightAt(originX, originZ)
  const group = new THREE.Group()
  group.name = 'st-agnes-modular-hospital'
  group.position.set(originX, ground, originZ)
  context.scene.add(group)

  addExteriorShell(group, context, materials)
  addClinicalProps(group, context)

  const cells = cellsForHospital()
  const boundary = boundaryPlacements(cells)
  const interior = interiorPlacements()
  const architecture = [...addFloorAndCeilingPlacements(cells), ...boundary, ...interior]
  for (const wall of [...boundary, ...interior]) {
    addWallCollider(context, wall, originX, originZ)
  }

  // Courtyard planters and the two transfer-hall columns retain the pavilion
  // silhouette while giving the rear halls recognizable landmarks.
  const courtyardMaterial = materials.concrete.clone()
  courtyardMaterial.color.setHex(0x4d5047)
  for (const x of [-9, 9]) {
    group.add(box(5.2, 0.58, 5.2, courtyardMaterial, x, 0.29, 1.0))
    group.add(cylinder(1.2, 1.6, 2.8, 8, context.materials.darkRust, x, 1.45, 1.0))
    context.addCollider(originX + x, originZ + 1, 5.3, 5.3, 0.04)
  }

  void loadKit()
    .then((templates) => {
      addModuleInstances(group, templates, architecture, context.shotTargets)
      installPreviewCamera(context.scene)
      ;(window as unknown as { __ST_AGNES_READY__?: boolean }).__ST_AGNES_READY__ = true
    })
    .catch((error: unknown) => {
      console.error('St. Agnes modular kit failed to load', error)
      ;(window as unknown as { __ST_AGNES_READY__?: boolean }).__ST_AGNES_READY__ = false
    })

  // Keep the imported kit inside the exact authored footprint.
  group.userData.footprint = {
    width: HOSPITAL_FOOTPRINT.width,
    depth: HOSPITAL_FOOTPRINT.depth,
  }
  return group
}
