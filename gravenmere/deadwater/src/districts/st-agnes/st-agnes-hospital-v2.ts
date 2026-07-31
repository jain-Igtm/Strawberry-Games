import * as THREE from 'three'
import type { EnvironmentMaterials } from '../../environment'
import {
  HOSPITAL_FOOTPRINT,
  HOSPITAL_POSITION,
} from '../dock-town-plan'
import { terrainHeightAt } from '../dock-town-terrain'

const WALL_HEIGHT = 3.2
const FLOOR_Y = 0.035

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

type BoxSpec = {
  width: number
  height: number
  depth: number
  x: number
  y: number
  z: number
  rotationX?: number
  rotationY?: number
  rotationZ?: number
}

type CylinderSpec = {
  radius: number
  height: number
  x: number
  y: number
  z: number
  rotationX?: number
  rotationY?: number
  rotationZ?: number
}

type PreviewView = 'entrance' | 'lobby' | 'west-ward' | 'east-ward'

type HospitalMaterials = ReturnType<typeof makeHospitalMaterials>

const unitBox = new THREE.BoxGeometry(1, 1, 1)
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10)
const matrix = new THREE.Matrix4()
const position = new THREE.Vector3()
const scale = new THREE.Vector3()
const quaternion = new THREE.Quaternion()
const euler = new THREE.Euler()

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
  radius: number,
  height: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segments = 10,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    material,
  )
  mesh.position.set(x, y, z)
  return mesh
}

function addBoxBatch(
  group: THREE.Group,
  material: THREE.Material,
  specs: BoxSpec[],
  shotTargets?: THREE.Object3D[],
): THREE.InstancedMesh | null {
  if (specs.length === 0) return null
  const mesh = new THREE.InstancedMesh(unitBox, material, specs.length)
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index]
    position.set(spec.x, spec.y, spec.z)
    euler.set(spec.rotationX ?? 0, spec.rotationY ?? 0, spec.rotationZ ?? 0)
    quaternion.setFromEuler(euler)
    scale.set(spec.width, spec.height, spec.depth)
    matrix.compose(position, quaternion, scale)
    mesh.setMatrixAt(index, matrix)
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
  specs: CylinderSpec[],
): THREE.InstancedMesh | null {
  if (specs.length === 0) return null
  const mesh = new THREE.InstancedMesh(unitCylinder, material, specs.length)
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index]
    position.set(spec.x, spec.y, spec.z)
    euler.set(spec.rotationX ?? 0, spec.rotationY ?? 0, spec.rotationZ ?? 0)
    quaternion.setFromEuler(euler)
    scale.set(spec.radius, spec.height, spec.radius)
    matrix.compose(position, quaternion, scale)
    mesh.setMatrixAt(index, matrix)
  }
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
  mesh.computeBoundingSphere()
  group.add(mesh)
  return mesh
}

function makePaintTexture(base: string, fleck: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const draw = canvas.getContext('2d')!
  draw.fillStyle = base
  draw.fillRect(0, 0, 256, 256)
  let seed = 113
  for (let index = 0; index < 1800; index += 1) {
    seed = (seed * 16807) % 2147483647
    const x = seed % 256
    seed = (seed * 16807) % 2147483647
    const y = seed % 256
    seed = (seed * 16807) % 2147483647
    const alpha = 0.015 + (seed % 25) / 1000
    draw.fillStyle = `${fleck}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
    draw.fillRect(x, y, 1 + (seed % 2), 1 + ((seed >> 2) % 2))
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  return texture
}

function makeTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const draw = canvas.getContext('2d')!
  draw.fillStyle = '#9da6a0'
  draw.fillRect(0, 0, 512, 512)
  const tile = 64
  for (let y = 0; y < 512; y += tile) {
    for (let x = 0; x < 512; x += tile) {
      const checker = ((x + y) / tile) % 2 === 0
      draw.fillStyle = checker ? '#aeb6b0' : '#a5ada8'
      draw.fillRect(x + 2, y + 2, tile - 4, tile - 4)
      draw.fillStyle = 'rgba(65,73,69,0.16)'
      draw.fillRect(x, y, tile, 2)
      draw.fillRect(x, y, 2, tile)
    }
  }
  let seed = 71
  for (let index = 0; index < 4200; index += 1) {
    seed = (seed * 48271) % 2147483647
    const x = seed % 512
    seed = (seed * 48271) % 2147483647
    const y = seed % 512
    const shade = 72 + (seed % 58)
    draw.fillStyle = `rgba(${shade},${shade + 5},${shade + 2},0.055)`
    draw.fillRect(x, y, 1 + (seed % 2), 1 + ((seed >> 3) % 2))
  }
  for (let index = 0; index < 32; index += 1) {
    seed = (seed * 48271) % 2147483647
    const x = seed % 512
    seed = (seed * 48271) % 2147483647
    const y = seed % 512
    draw.strokeStyle = 'rgba(55,48,43,0.11)'
    draw.lineWidth = 1 + (seed % 2)
    draw.beginPath()
    draw.moveTo(x, y)
    draw.lineTo(x + 12 + (seed % 36), y + 2 + ((seed >> 4) % 12))
    draw.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

function makeCeilingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const draw = canvas.getContext('2d')!
  draw.fillStyle = '#b8b8ae'
  draw.fillRect(0, 0, 256, 256)
  for (let y = 0; y < 256; y += 5) {
    for (let x = 0; x < 256; x += 5) {
      const alpha = ((x * 17 + y * 31) % 9) / 900
      draw.fillStyle = `rgba(65,67,63,${0.025 + alpha})`
      draw.fillRect(x, y, 1, 1)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 3)
  return texture
}

function makeSignMaterial(
  text: string,
  accent = '#416f78',
  background = '#182326',
): THREE.MeshBasicMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 192
  const draw = canvas.getContext('2d')!
  draw.fillStyle = background
  draw.fillRect(0, 0, 768, 192)
  draw.fillStyle = accent
  draw.fillRect(0, 0, 18, 192)
  draw.fillStyle = '#e9ece7'
  draw.font = '800 62px ui-monospace, monospace'
  draw.textAlign = 'center'
  draw.textBaseline = 'middle'
  draw.fillText(text, 400, 100)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
}

function makeBloodMaterial(): THREE.MeshBasicMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const draw = canvas.getContext('2d')!
  draw.clearRect(0, 0, 512, 256)
  draw.fillStyle = 'rgba(62,18,16,0.72)'
  draw.beginPath()
  draw.ellipse(210, 130, 170, 58, -0.08, 0, Math.PI * 2)
  draw.ellipse(385, 115, 56, 24, 0.2, 0, Math.PI * 2)
  draw.fill()
  for (const [x, y, radius] of [[55, 158, 15], [88, 100, 9], [448, 150, 12], [474, 92, 7]] as Array<[number, number, number]>) {
    draw.beginPath()
    draw.arc(x, y, radius, 0, Math.PI * 2)
    draw.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    toneMapped: false,
  })
}

function makeHospitalMaterials(context: StAgnesContext, district: DistrictMaterials) {
  const upperWall = new THREE.MeshStandardMaterial({
    map: makePaintTexture('#c8c6b8', '#5d625e'),
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0,
  })
  const lowerWall = new THREE.MeshStandardMaterial({
    map: makePaintTexture('#617c7b', '#263c3e'),
    color: 0xffffff,
    roughness: 0.89,
    metalness: 0,
  })
  const baseboard = new THREE.MeshStandardMaterial({ color: 0x293638, roughness: 0.76 })
  const trim = new THREE.MeshStandardMaterial({ color: 0x4e5f60, roughness: 0.74, metalness: 0.12 })
  const door = new THREE.MeshStandardMaterial({ color: 0x56777c, roughness: 0.82 })
  const doorDark = new THREE.MeshStandardMaterial({ color: 0x263638, roughness: 0.8 })
  const tileMap = makeTileTexture()
  const tileBase = new THREE.MeshStandardMaterial({ map: tileMap, color: 0xffffff, roughness: 0.72 })
  const ceiling = new THREE.MeshStandardMaterial({
    map: makeCeilingTexture(),
    color: 0xffffff,
    roughness: 0.97,
    emissive: 0x22231f,
    emissiveIntensity: 0.08,
  })
  const lightOn = new THREE.MeshBasicMaterial({ color: 0xe8f1ea, toneMapped: false })
  const lightWarm = new THREE.MeshBasicMaterial({ color: 0xffd5aa, toneMapped: false })
  const lightOff = new THREE.MeshStandardMaterial({ color: 0x303632, roughness: 0.92 })
  const glass = district.glass.clone()
  glass.color.setHex(0x8eabb0)
  glass.emissive.setHex(0x172527)
  glass.emissiveIntensity = 0.18
  glass.transparent = true
  glass.opacity = 0.38
  glass.roughness = 0.24
  const frostedGlass = glass.clone()
  frostedGlass.color.setHex(0xb7c9c8)
  frostedGlass.opacity = 0.56
  frostedGlass.roughness = 0.58
  const metal = context.materials.metal.clone()
  metal.color.setHex(0x8c9692)
  metal.roughness = 0.58
  const blackMetal = context.materials.blackMetal.clone()
  const cabinet = new THREE.MeshStandardMaterial({ color: 0x6a7774, roughness: 0.78, metalness: 0.16 })
  const cabinetLight = new THREE.MeshStandardMaterial({ color: 0x9ca49f, roughness: 0.82, metalness: 0.08 })
  const mattress = new THREE.MeshStandardMaterial({ color: 0xc6ccc7, roughness: 0.94 })
  const linen = new THREE.MeshStandardMaterial({ color: 0x7d9694, roughness: 1 })
  const pillow = new THREE.MeshStandardMaterial({ color: 0xe2dfd2, roughness: 1 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x202423, roughness: 0.98 })
  const screen = new THREE.MeshStandardMaterial({
    color: 0x172326,
    emissive: 0x4f8d92,
    emissiveIntensity: 0.85,
    roughness: 0.26,
  })
  const warning = new THREE.MeshBasicMaterial({ color: 0xb44a32, toneMapped: false })
  const stripe = new THREE.MeshBasicMaterial({ color: 0x607f80, toneMapped: false })
  const stripeWarm = new THREE.MeshBasicMaterial({ color: 0xaa704a, toneMapped: false })
  const exterior = new THREE.MeshStandardMaterial({ color: 0x686e69, roughness: 0.95 })
  const exteriorDark = new THREE.MeshStandardMaterial({ color: 0x3d4543, roughness: 0.91 })
  const blood = makeBloodMaterial()
  return {
    upperWall,
    lowerWall,
    baseboard,
    trim,
    door,
    doorDark,
    tileBase,
    ceiling,
    lightOn,
    lightWarm,
    lightOff,
    glass,
    frostedGlass,
    metal,
    blackMetal,
    cabinet,
    cabinetLight,
    mattress,
    linen,
    pillow,
    rubber,
    screen,
    warning,
    stripe,
    stripeWarm,
    exterior,
    exteriorDark,
    blood,
  }
}

function floorMaterial(base: THREE.MeshStandardMaterial, width: number, depth: number, tint: number): THREE.MeshStandardMaterial {
  const material = base.clone()
  material.color.setHex(tint)
  if (material.map) {
    material.map = material.map.clone()
    material.map.wrapS = THREE.RepeatWrapping
    material.map.wrapT = THREE.RepeatWrapping
    material.map.repeat.set(width / 4.8, depth / 4.8)
    material.map.needsUpdate = true
  }
  return material
}

function addFloor(
  group: THREE.Group,
  material: THREE.MeshStandardMaterial,
  width: number,
  depth: number,
  x: number,
  z: number,
): void {
  const geometry = new THREE.PlaneGeometry(width, depth)
  geometry.rotateX(-Math.PI / 2)
  const floor = new THREE.Mesh(geometry, floorMaterial(material, width, depth, 0xffffff))
  floor.position.set(x, FLOOR_Y, z)
  floor.userData.blocksShot = false
  group.add(floor)
}

function addFloorStrip(
  group: THREE.Group,
  material: THREE.Material,
  width: number,
  depth: number,
  x: number,
  z: number,
): void {
  const geometry = new THREE.PlaneGeometry(width, depth)
  geometry.rotateX(-Math.PI / 2)
  const strip = new THREE.Mesh(geometry, material)
  strip.position.set(x, FLOOR_Y + 0.012, z)
  group.add(strip)
}

function addDecal(
  group: THREE.Group,
  material: THREE.Material,
  width: number,
  depth: number,
  x: number,
  z: number,
  rotationY = 0,
): void {
  const geometry = new THREE.PlaneGeometry(width, depth)
  geometry.rotateX(-Math.PI / 2)
  const decal = new THREE.Mesh(geometry, material)
  decal.position.set(x, FLOOR_Y + 0.028, z)
  decal.rotation.y = rotationY
  group.add(decal)
}

function addArchitecture(
  group: THREE.Group,
  context: StAgnesContext,
  mats: HospitalMaterials,
): void {
  addFloor(group, mats.tileBase, 76, 16, 0, -15)
  addFloor(group, mats.tileBase, 28, 30, -24, 8)
  addFloor(group, mats.tileBase, 28, 30, 24, 8)
  addFloor(group, mats.tileBase, 10, 30, 0, 8)
  addFloor(group, mats.tileBase, 20, 4, 0, 15)

  addFloorStrip(group, mats.stripe, 0.62, 13.6, 0, -14.7)
  addFloorStrip(group, mats.stripe, 0.56, 29.2, -24, 8)
  addFloorStrip(group, mats.stripeWarm, 0.56, 29.2, 24, 8)
  addFloorStrip(group, mats.stripe, 9.2, 0.5, 0, 15)

  const upper: BoxSpec[] = []
  const lower: BoxSpec[] = []
  const base: BoxSpec[] = []
  const frames: BoxSpec[] = []
  const doors: BoxSpec[] = []
  const glass: BoxSpec[] = []

  const addWallPiece = (
    x: number,
    z: number,
    length: number,
    vertical: boolean,
    collider = true,
  ): void => {
    if (length <= 0.12) return
    const width = vertical ? 0.22 : length
    const depth = vertical ? length : 0.22
    lower.push({ width, height: 1.08, depth, x, y: 0.54, z })
    upper.push({ width, height: WALL_HEIGHT - 1.08, depth, x, y: 1.08 + (WALL_HEIGHT - 1.08) / 2, z })
    base.push({
      width: vertical ? 0.3 : length,
      height: 0.1,
      depth: vertical ? length : 0.3,
      x,
      y: 0.08,
      z,
    })
    if (collider) {
      context.addCollider(
        HOSPITAL_POSITION.x + x,
        HOSPITAL_POSITION.y + z,
        vertical ? 0.24 : length,
        vertical ? length : 0.24,
        0.035,
      )
    }
  }

  const addDoorFrame = (
    center: number,
    fixed: number,
    vertical: boolean,
    width: number,
    glassDoor = false,
    openDirection = 1,
  ): void => {
    if (vertical) {
      frames.push(
        { width: 0.34, height: 2.42, depth: 0.16, x: fixed, y: 1.21, z: center - width / 2 },
        { width: 0.34, height: 2.42, depth: 0.16, x: fixed, y: 1.21, z: center + width / 2 },
        { width: 0.34, height: 0.18, depth: width + 0.32, x: fixed, y: 2.34, z: center },
      )
      doors.push({
        width: width * 0.5,
        height: 2.16,
        depth: 0.08,
        x: fixed + 0.42 * openDirection,
        y: 1.11,
        z: center + width * 0.23,
        rotationY: Math.PI / 2 + openDirection * 1.02,
      })
      if (glassDoor) {
        glass.push({ width: 0.06, height: 1.38, depth: width * 0.42, x: fixed + 0.44 * openDirection, y: 1.3, z: center + width * 0.23, rotationY: openDirection * 1.02 })
      }
    } else {
      frames.push(
        { width: 0.16, height: 2.42, depth: 0.34, x: center - width / 2, y: 1.21, z: fixed },
        { width: 0.16, height: 2.42, depth: 0.34, x: center + width / 2, y: 1.21, z: fixed },
        { width: width + 0.32, height: 0.18, depth: 0.34, x: center, y: 2.34, z: fixed },
      )
      doors.push({
        width: width * 0.5,
        height: 2.16,
        depth: 0.08,
        x: center + width * 0.23,
        y: 1.11,
        z: fixed + 0.42 * openDirection,
        rotationY: openDirection * 1.02,
      })
      if (glassDoor) {
        glass.push({ width: width * 0.42, height: 1.38, depth: 0.06, x: center + width * 0.23, y: 1.3, z: fixed + 0.44 * openDirection, rotationY: openDirection * 1.02 })
      }
    }
  }

  const wallRunX = (
    start: number,
    end: number,
    z: number,
    doorwayCenters: number[] = [],
    doorwayWidth = 2.3,
    glassDoor = false,
  ): void => {
    let cursor = start
    const sorted = [...doorwayCenters].sort((a, b) => a - b)
    for (let index = 0; index < sorted.length; index += 1) {
      const doorCenter = sorted[index]
      const segmentEnd = doorCenter - doorwayWidth / 2
      addWallPiece((cursor + segmentEnd) / 2, z, segmentEnd - cursor, false)
      upper.push({
        width: doorwayWidth,
        height: WALL_HEIGHT - 2.42,
        depth: 0.22,
        x: doorCenter,
        y: 2.42 + (WALL_HEIGHT - 2.42) / 2,
        z,
      })
      addDoorFrame(doorCenter, z, false, doorwayWidth, glassDoor, index % 2 === 0 ? 1 : -1)
      cursor = doorCenter + doorwayWidth / 2
    }
    addWallPiece((cursor + end) / 2, z, end - cursor, false)
  }

  const wallRunZ = (
    x: number,
    start: number,
    end: number,
    doorwayCenters: number[] = [],
    doorwayWidth = 2.3,
    glassDoor = false,
  ): void => {
    let cursor = start
    const sorted = [...doorwayCenters].sort((a, b) => a - b)
    for (let index = 0; index < sorted.length; index += 1) {
      const doorCenter = sorted[index]
      const segmentEnd = doorCenter - doorwayWidth / 2
      addWallPiece(x, (cursor + segmentEnd) / 2, segmentEnd - cursor, true)
      upper.push({
        width: 0.22,
        height: WALL_HEIGHT - 2.42,
        depth: doorwayWidth,
        x,
        y: 2.42 + (WALL_HEIGHT - 2.42) / 2,
        z: doorCenter,
      })
      addDoorFrame(doorCenter, x, true, doorwayWidth, glassDoor, index % 2 === 0 ? 1 : -1)
      cursor = doorCenter + doorwayWidth / 2
    }
    addWallPiece(x, (cursor + end) / 2, end - cursor, true)
  }

  // Exterior ground-floor envelope.
  wallRunX(-38, 38, -23, [0, 26], 4.1, true)
  wallRunZ(-38, -23, 23, [6], 2.7)
  wallRunZ(38, -23, 23, [6], 2.7)
  wallRunX(-38, -10, 23, [-24], 2.7)
  wallRunX(-5, 5, 23, [0], 2.7)
  wallRunX(10, 38, 23, [24], 2.7)

  // Administration block and vestibule.
  wallRunX(-38, -10, -7, [-24], 2.5)
  wallRunX(-5, 5, -7, [0], 2.5)
  wallRunX(10, 38, -7, [24], 2.5)
  wallRunZ(-28, -23, -7, [-15], 2.3)
  wallRunZ(-14, -23, -7, [-15], 2.3)
  wallRunZ(14, -23, -7, [-15], 2.3)
  wallRunZ(28, -23, -7, [-15], 2.3)
  wallRunZ(-7, -23, -18, [-20.5], 2.2, true)
  wallRunZ(7, -23, -18, [-20.5], 2.2, true)
  wallRunX(-7, 7, -18, [0], 3.2, true)

  // Ward corridors and repeated patient-room rhythm.
  wallRunZ(-26, -7, 23, [-2, 6, 14, 20], 2.25)
  wallRunZ(-22, -7, 23, [2, 10, 18], 2.25)
  wallRunZ(22, -7, 23, [2, 10, 18], 2.25)
  wallRunZ(26, -7, 23, [-2, 6, 14, 20], 2.25)
  for (const z of [2, 10, 18]) {
    wallRunX(-38, -26, z, [])
    wallRunX(-22, -10, z, [])
    wallRunX(10, 22, z, [])
    wallRunX(26, 38, z, [])
  }

  // Central transfer spine and the rear bridge.
  wallRunZ(-5, -7, 13, [-2, 7], 2.35)
  wallRunZ(5, -7, 13, [2, 9], 2.35)
  wallRunZ(-5, 17, 23, [20], 2.35)
  wallRunZ(5, 17, 23, [20], 2.35)
  wallRunX(-10, 10, 13, [-7, 0, 7], 2.25)
  wallRunX(-10, 10, 17, [-7, 0, 7], 2.25)

  // Full-height courtyard glazing adds daylight and spatial variety.
  const glassRuns: Array<{ x: number; start: number; end: number }> = [
    { x: -10, start: -7, end: 23 },
    { x: -5, start: -7, end: 13 },
    { x: -5, start: 17, end: 23 },
    { x: 5, start: -7, end: 13 },
    { x: 5, start: 17, end: 23 },
    { x: 10, start: -7, end: 23 },
  ]
  for (const run of glassRuns) {
    for (let z = run.start + 1.5; z < run.end; z += 3) {
      glass.push({ width: 0.09, height: 1.92, depth: 2.65, x: run.x, y: 1.62, z })
      frames.push({ width: 0.16, height: 2.55, depth: 0.12, x: run.x, y: 1.28, z: z - 1.38 })
      lower.push({ width: 0.2, height: 0.64, depth: 2.78, x: run.x, y: 0.32, z })
      upper.push({ width: 0.2, height: 0.48, depth: 2.78, x: run.x, y: 2.96, z })
    }
    context.addCollider(
      HOSPITAL_POSITION.x + run.x,
      HOSPITAL_POSITION.y + (run.start + run.end) / 2,
      0.2,
      run.end - run.start,
      0.03,
    )
  }

  addBoxBatch(group, mats.upperWall, upper, context.shotTargets)
  addBoxBatch(group, mats.lowerWall, lower, context.shotTargets)
  addBoxBatch(group, mats.baseboard, base)
  addBoxBatch(group, mats.trim, frames)
  addBoxBatch(group, mats.door, doors, context.shotTargets)
  addBoxBatch(group, mats.glass, glass)

  // Acoustic tile ceiling and recessed fixtures. Courtyards remain open.
  const ceilingTiles: BoxSpec[] = []
  const missingTiles: BoxSpec[] = []
  const lightOn: BoxSpec[] = []
  const lightWarm: BoxSpec[] = []
  const lightOff: BoxSpec[] = []
  const zones = [
    { minX: -38, maxX: 38, minZ: -23, maxZ: -7 },
    { minX: -38, maxX: -10, minZ: -7, maxZ: 23 },
    { minX: 10, maxX: 38, minZ: -7, maxZ: 23 },
    { minX: -5, maxX: 5, minZ: -7, maxZ: 23 },
    { minX: -10, maxX: 10, minZ: 13, maxZ: 17 },
  ]
  let tileIndex = 0
  for (const zone of zones) {
    for (let x = zone.minX + 1; x <= zone.maxX - 1; x += 2) {
      for (let z = zone.minZ + 1; z <= zone.maxZ - 1; z += 2) {
        tileIndex += 1
        if (tileIndex % 83 === 0 || tileIndex % 127 === 0) {
          missingTiles.push({ width: 1.84, height: 0.035, depth: 1.84, x, y: 3.17, z })
          continue
        }
        ceilingTiles.push({ width: 1.86, height: 0.045, depth: 1.86, x, y: 3.16, z })
      }
    }
  }
  const fixturePositions: Array<[number, number, number]> = [
    [-30, -15, 0], [-20, -15, 0], [-10, -15, 0], [0, -15, 0], [10, -15, 0], [20, -15, 0], [30, -15, 0],
    [-24, -4, Math.PI / 2], [-24, 4, Math.PI / 2], [-24, 12, Math.PI / 2], [-24, 20, Math.PI / 2],
    [24, -4, Math.PI / 2], [24, 4, Math.PI / 2], [24, 12, Math.PI / 2], [24, 20, Math.PI / 2],
    [0, -4, Math.PI / 2], [0, 5, Math.PI / 2], [0, 15, 0], [0, 21, Math.PI / 2],
  ]
  fixturePositions.forEach(([x, z, rotationY], index) => {
    const spec = { width: 1.72, height: 0.055, depth: 0.5, x, y: 3.12, z, rotationY }
    if (index === 3 || index === 9 || index === 13) lightWarm.push(spec)
    else if (index === 6 || index === 11 || index === 17) lightOff.push(spec)
    else lightOn.push(spec)
  })
  addBoxBatch(group, mats.ceiling, ceilingTiles)
  addBoxBatch(group, mats.lightOff, missingTiles)
  addBoxBatch(group, mats.lightOn, lightOn)
  addBoxBatch(group, mats.lightWarm, lightWarm)
  addBoxBatch(group, mats.lightOff, lightOff)

  // A few lightweight local lights counter the global ash-orange grade indoors.
  for (const [x, z, color, intensity, distance] of [
    [0, -15, 0xdcebe7, 0.48, 14],
    [-24, 4, 0xdbe8e4, 0.34, 11],
    [-24, 16, 0xffd1a6, 0.3, 10],
    [24, 4, 0xdbe8e4, 0.34, 11],
    [24, 16, 0xffd1a6, 0.3, 10],
    [0, 15, 0xdcebe7, 0.34, 10],
  ] as Array<[number, number, number, number, number]>) {
    const light = new THREE.PointLight(color, intensity, distance, 2)
    light.position.set(x, 2.65, z)
    group.add(light)
  }

  // Courtyards: pale ash, dead planters, and exposed daylight shafts.
  const courtyard = new THREE.MeshStandardMaterial({ color: 0x565b53, roughness: 1 })
  addFloor(group, courtyard, 5, 30, -7.5, 8)
  addFloor(group, courtyard, 5, 30, 7.5, 8)
  const planters: BoxSpec[] = []
  const trunks: CylinderSpec[] = []
  for (const x of [-7.5, 7.5]) {
    for (const z of [-1, 8, 19]) {
      planters.push({ width: 3.1, height: 0.62, depth: 2.25, x, y: 0.31, z })
      trunks.push({ radius: 0.16, height: 2.25, x, y: 1.48, z })
      context.addCollider(HOSPITAL_POSITION.x + x, HOSPITAL_POSITION.y + z, 3.2, 2.35, 0.03)
    }
  }
  addBoxBatch(group, mats.exteriorDark, planters)
  addCylinderBatch(group, context.materials.darkRust, trunks)
}

function addExterior(
  group: THREE.Group,
  context: StAgnesContext,
  district: DistrictMaterials,
  mats: HospitalMaterials,
): void {
  // Upper storeys remain solid for performance, but facade rhythm and windows
  // prevent the old monolithic-box appearance.
  group.add(box(76, 7.2, 16, mats.exterior, 0, 6.8, -15))
  group.add(box(28, 4.0, 30, mats.exterior, -24, 5.2, 8))
  group.add(box(28, 4.0, 30, mats.exterior, 24, 5.2, 8))
  group.add(box(10, 4.0, 30, mats.exteriorDark, 0, 5.2, 8))
  group.add(box(76.8, 0.42, 16.8, district.roof, 0, 10.62, -15))
  group.add(box(28.7, 0.4, 30.7, district.roof, -24, 7.42, 8))
  group.add(box(28.7, 0.4, 30.7, district.roof, 24, 7.42, 8))
  group.add(box(10.7, 0.4, 30.7, district.roof, 0, 7.42, 8))

  const windows: BoxSpec[] = []
  const piers: BoxSpec[] = []
  for (const y of [4.55, 7.55]) {
    for (let x = -34; x <= 34; x += 4) {
      windows.push({ width: 1.55, height: 1.52, depth: 0.1, x, y, z: -23.08 })
      piers.push({ width: 0.18, height: 2.55, depth: 0.2, x: x + 2, y, z: -23.02 })
    }
  }
  for (const side of [-1, 1]) {
    for (const y of [4.45, 6.25]) {
      for (const z of [-4, 1, 6, 11, 16, 21]) {
        windows.push({ width: 0.1, height: 1.32, depth: 1.55, x: side * 38.08, y, z })
      }
    }
  }
  addBoxBatch(group, mats.glass, windows)
  addBoxBatch(group, mats.trim, piers)

  const canopy = new THREE.Group()
  canopy.position.set(0, 0, -25.6)
  canopy.add(box(17, 0.38, 5.2, district.roof, 0, 3.7, 0))
  for (const x of [-7.2, 7.2]) {
    canopy.add(box(0.3, 3.5, 0.3, mats.metal, x, 1.75, -1.9))
  }
  canopy.add(box(22, 1.1, 0.16, makeSignMaterial('ST. AGNES HOSPITAL', '#9d4c39'), 0, 4.95, 2.48))
  canopy.add(box(10, 0.86, 0.16, makeSignMaterial('EMERGENCY', '#c34b37'), 26, 3.95, 2.48))
  canopy.add(box(3.4, 0.16, 0.18, mats.warning, 26, 3.1, 2.48))
  group.add(canopy)

  const rooftop: BoxSpec[] = [
    { width: 7.4, height: 1.7, depth: 4.2, x: -19, y: 11.55, z: -14 },
    { width: 5.2, height: 1.25, depth: 3.2, x: 13, y: 11.32, z: -14 },
    { width: 4.2, height: 1.1, depth: 3.8, x: 25, y: 8.2, z: 10 },
  ]
  addBoxBatch(group, mats.exteriorDark, rooftop)

  // Keep the upper masses out of the playable collision set; the detailed
  // ground-floor envelope already supplies exact collision.
  group.userData.upperStoreys = true
  void context
}

function addBed(
  group: THREE.Group,
  context: StAgnesContext,
  mats: HospitalMaterials,
  x: number,
  z: number,
  rotationY: number,
  disturbed = false,
): void {
  const bed = new THREE.Group()
  bed.position.set(x, 0, z)
  bed.rotation.y = rotationY
  if (disturbed) bed.rotation.z = -0.035
  bed.add(box(2.2, 0.12, 0.94, mats.metal, 0, 0.55, 0))
  bed.add(box(1.96, 0.24, 0.82, mats.mattress, 0, 0.73, 0))
  bed.add(box(0.68, 0.12, 0.72, mats.linen, 0.45, 0.91, 0))
  bed.add(box(0.48, 0.13, 0.7, mats.pillow, -0.7, 0.93, 0))
  for (const endX of [-1.06, 1.06]) {
    bed.add(box(0.08, 0.72, 0.96, mats.metal, endX, 0.81, 0))
  }
  for (const railZ of [-0.48, 0.48]) {
    bed.add(box(1.34, 0.07, 0.07, mats.metal, 0.12, 1.02, railZ))
    for (const railX of [-0.5, 0.12, 0.72]) {
      bed.add(box(0.055, 0.38, 0.055, mats.metal, railX, 0.86, railZ))
    }
  }
  for (const wheelX of [-0.82, 0.82]) {
    for (const wheelZ of [-0.34, 0.34]) {
      const wheel = cylinder(0.105, 0.1, mats.rubber, wheelX, 0.18, wheelZ, 10)
      wheel.rotation.x = Math.PI / 2
      bed.add(wheel)
      bed.add(box(0.06, 0.38, 0.06, mats.metal, wheelX, 0.36, wheelZ))
    }
  }
  group.add(bed)
  const vertical = Math.abs(Math.sin(rotationY)) > 0.5
  context.addCollider(
    HOSPITAL_POSITION.x + x,
    HOSPITAL_POSITION.y + z,
    vertical ? 1.15 : 2.35,
    vertical ? 2.35 : 1.15,
    0.045,
  )
}

function addIVStand(group: THREE.Group, mats: HospitalMaterials, x: number, z: number): void {
  const stand = new THREE.Group()
  stand.position.set(x, 0, z)
  stand.add(cylinder(0.035, 1.65, mats.metal, 0, 0.86, 0, 8))
  stand.add(box(0.58, 0.045, 0.045, mats.metal, 0, 1.67, 0))
  for (const offset of [-0.25, 0.25]) {
    stand.add(box(0.035, 0.16, 0.035, mats.metal, offset, 1.58, 0))
  }
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const leg = box(0.48, 0.04, 0.05, mats.metal, 0, 0.08, 0)
    leg.rotation.y = angle
    stand.add(leg)
  }
  group.add(stand)
}

function addNurseStation(
  group: THREE.Group,
  context: StAgnesContext,
  mats: HospitalMaterials,
  x: number,
  z: number,
  label: string,
): void {
  const station = new THREE.Group()
  station.position.set(x, 0, z)
  station.add(box(5.6, 1.0, 1.25, mats.cabinet, 0, 0.5, 0))
  station.add(box(5.9, 0.12, 1.48, mats.cabinetLight, 0, 1.04, 0))
  station.add(box(1.2, 1.0, 3.2, mats.cabinet, -2.2, 0.5, 1.55))
  station.add(box(1.2, 1.0, 3.2, mats.cabinet, 2.2, 0.5, 1.55))
  for (const monitorX of [-1.65, 0, 1.65]) {
    station.add(box(0.78, 0.48, 0.1, mats.screen, monitorX, 1.49, -0.2))
    station.add(box(0.08, 0.28, 0.08, mats.blackMetal, monitorX, 1.26, -0.15))
  }
  station.add(box(4.3, 0.68, 0.1, makeSignMaterial(label), 0, 2.35, 0.68))
  group.add(station)
  context.addCollider(HOSPITAL_POSITION.x + x, HOSPITAL_POSITION.y + z, 6, 1.65, 0.06)
  context.addCollider(HOSPITAL_POSITION.x + x - 2.2, HOSPITAL_POSITION.y + z + 1.55, 1.4, 3.35, 0.06)
  context.addCollider(HOSPITAL_POSITION.x + x + 2.2, HOSPITAL_POSITION.y + z + 1.55, 1.4, 3.35, 0.06)
}

function addReception(
  group: THREE.Group,
  context: StAgnesContext,
  mats: HospitalMaterials,
): void {
  const desk = new THREE.Group()
  desk.position.set(0, 0, -13.6)
  desk.add(box(10.5, 1.02, 1.35, mats.cabinet, 0, 0.51, 0))
  desk.add(box(10.8, 0.14, 1.6, mats.cabinetLight, 0, 1.08, 0))
  desk.add(box(1.25, 1.02, 4.2, mats.cabinet, -4.65, 0.51, 1.55))
  desk.add(box(1.25, 1.02, 4.2, mats.cabinet, 4.65, 0.51, 1.55))
  for (const monitorX of [-3, 0, 3]) {
    desk.add(box(0.82, 0.5, 0.1, mats.screen, monitorX, 1.52, -0.2))
    desk.add(box(0.08, 0.3, 0.08, mats.blackMetal, monitorX, 1.27, -0.14))
  }
  desk.add(box(8.8, 0.48, 0.05, mats.frostedGlass, 0, 1.78, 0.22))
  desk.add(box(6.2, 0.7, 0.1, makeSignMaterial('ADMISSIONS'), 0, 2.42, 0.7))
  group.add(desk)
  context.addCollider(HOSPITAL_POSITION.x, HOSPITAL_POSITION.y - 13.6, 10.9, 1.7, 0.06)
  context.addCollider(HOSPITAL_POSITION.x - 4.65, HOSPITAL_POSITION.y - 12.05, 1.55, 4.35, 0.06)
  context.addCollider(HOSPITAL_POSITION.x + 4.65, HOSPITAL_POSITION.y - 12.05, 1.55, 4.35, 0.06)
}

function addWaitingArea(group: THREE.Group, mats: HospitalMaterials): void {
  const seats: BoxSpec[] = []
  const backs: BoxSpec[] = []
  const legs: BoxSpec[] = []
  const armrests: BoxSpec[] = []
  for (const side of [-1, 1]) {
    const centerX = side * 17.8
    for (const rowZ of [-19.5, -16.9, -14.3]) {
      for (const offsetX of [-2.1, -0.7, 0.7, 2.1]) {
        const x = centerX + offsetX
        seats.push({ width: 1.12, height: 0.14, depth: 0.72, x, y: 0.52, z: rowZ })
        backs.push({ width: 1.12, height: 0.72, depth: 0.12, x, y: 0.9, z: rowZ + 0.32 })
        legs.push(
          { width: 0.06, height: 0.5, depth: 0.06, x: x - 0.43, y: 0.25, z: rowZ },
          { width: 0.06, height: 0.5, depth: 0.06, x: x + 0.43, y: 0.25, z: rowZ },
        )
      }
      armrests.push(
        { width: 0.08, height: 0.52, depth: 0.75, x: centerX - 2.75, y: 0.6, z: rowZ },
        { width: 0.08, height: 0.52, depth: 0.75, x: centerX + 2.75, y: 0.6, z: rowZ },
      )
    }
  }
  addBoxBatch(group, mats.linen, seats)
  addBoxBatch(group, mats.linen, backs)
  addBoxBatch(group, mats.blackMetal, legs)
  addBoxBatch(group, mats.metal, armrests)
}

function addGurney(
  group: THREE.Group,
  mats: HospitalMaterials,
  x: number,
  z: number,
  rotationY: number,
  tipped = false,
): void {
  const gurney = new THREE.Group()
  gurney.position.set(x, tipped ? 0.28 : 0, z)
  gurney.rotation.y = rotationY
  if (tipped) gurney.rotation.z = 0.34
  gurney.add(box(2.15, 0.16, 0.82, mats.mattress, 0, 0.93, 0))
  gurney.add(box(2.25, 0.1, 0.94, mats.metal, 0, 0.72, 0))
  gurney.add(box(0.38, 0.12, 0.68, mats.pillow, -0.72, 1.08, 0))
  for (const wheelX of [-0.82, 0.82]) {
    for (const wheelZ of [-0.32, 0.32]) {
      const wheel = cylinder(0.1, 0.12, mats.rubber, wheelX, 0.18, wheelZ, 10)
      wheel.rotation.x = Math.PI / 2
      gurney.add(wheel)
      gurney.add(box(0.055, 0.45, 0.055, mats.metal, wheelX, 0.46, wheelZ))
    }
  }
  group.add(gurney)
}

function addFurniture(
  group: THREE.Group,
  context: StAgnesContext,
  mats: HospitalMaterials,
): void {
  addReception(group, context, mats)
  addWaitingArea(group, mats)
  addNurseStation(group, context, mats, -24, 6, 'WARD A')
  addNurseStation(group, context, mats, 24, 6, 'WARD B')

  const beds: Array<[number, number, number, boolean]> = [
    [-33.5, -2, 0, false], [-15.5, -2, Math.PI, false],
    [-33.5, 6, 0, false], [-15.5, 6, Math.PI, true],
    [-33.5, 14, 0, false], [-15.5, 14, Math.PI, false],
    [15.5, -2, 0, false], [33.5, -2, Math.PI, false],
    [15.5, 6, 0, true], [33.5, 6, Math.PI, false],
    [15.5, 14, 0, false], [33.5, 14, Math.PI, false],
  ]
  for (const [x, z, rotationY, disturbed] of beds) {
    addBed(group, context, mats, x, z, rotationY, disturbed)
    addIVStand(group, mats, x + (x < 0 ? 1.65 : -1.65), z + 0.7)
  }

  addGurney(group, mats, -24, -5, Math.PI / 2)
  addGurney(group, mats, 24, 18, Math.PI / 2, true)
  addGurney(group, mats, 0, -9, 0)

  const cabinets: BoxSpec[] = []
  const cabinetTops: BoxSpec[] = []
  const wallUnits: BoxSpec[] = []
  for (const [x, z] of [
    [-36, 0], [-12, 0], [-36, 8], [-12, 8], [-36, 16], [-12, 16],
    [12, 0], [36, 0], [12, 8], [36, 8], [12, 16], [36, 16],
  ] as Array<[number, number]>) {
    cabinets.push({ width: 0.82, height: 1.12, depth: 0.72, x, y: 0.56, z })
    cabinetTops.push({ width: 0.94, height: 0.1, depth: 0.84, x, y: 1.16, z })
    wallUnits.push({ width: 0.76, height: 0.42, depth: 0.12, x, y: 1.72, z: z + 0.38 })
  }
  addBoxBatch(group, mats.cabinet, cabinets, context.shotTargets)
  addBoxBatch(group, mats.cabinetLight, cabinetTops)
  addBoxBatch(group, mats.screen, wallUnits)

  const curtains: BoxSpec[] = []
  for (const [x, z] of [[-29, -2], [-29, 6], [-29, 14], [29, -2], [29, 6], [29, 14]] as Array<[number, number]>) {
    curtains.push({ width: 0.06, height: 2.1, depth: 3.15, x, y: 1.45, z })
  }
  addBoxBatch(group, mats.frostedGlass, curtains)

  // Clinical signage and room identity.
  const signs: Array<[string, number, number, number, number]> = [
    ['TRIAGE', -21, 2.48, -7.16, 0],
    ['PHARMACY', 21, 2.48, -7.16, 0],
    ['ISOLATION', 0, 2.48, 13.14, 0],
    ['WARD A', -26.12, 2.42, -3.8, Math.PI / 2],
    ['WARD B', 26.12, 2.42, -3.8, -Math.PI / 2],
  ]
  for (const [label, x, y, z, rotationY] of signs) {
    const sign = box(4.4, 0.62, 0.08, makeSignMaterial(label), x, y, z)
    sign.rotation.y = rotationY
    group.add(sign)
  }

  // Environmental storytelling: dropped panels, papers, cart, oxygen, and old blood.
  const debris: BoxSpec[] = [
    { width: 1.8, height: 0.035, depth: 1.8, x: -17, y: 0.12, z: -10.4, rotationX: 0.03, rotationY: 0.45, rotationZ: 0.02 },
    { width: 1.65, height: 0.035, depth: 1.65, x: 25, y: 0.17, z: 12.5, rotationX: -0.02, rotationY: -0.25, rotationZ: 0.12 },
    { width: 0.42, height: 0.018, depth: 0.3, x: -4.5, y: 0.07, z: -9.2, rotationY: 0.3 },
    { width: 0.34, height: 0.018, depth: 0.26, x: -4.0, y: 0.07, z: -8.8, rotationY: -0.5 },
    { width: 0.48, height: 0.018, depth: 0.32, x: -3.6, y: 0.07, z: -9.45, rotationY: 0.9 },
  ]
  addBoxBatch(group, mats.ceiling, debris)

  const oxygen: CylinderSpec[] = []
  for (const [x, z] of [[-19, 20], [-18.4, 20], [18.4, 20], [19, 20]] as Array<[number, number]>) {
    oxygen.push({ radius: 0.21, height: 1.35, x, y: 0.675, z })
  }
  addCylinderBatch(group, mats.door, oxygen)

  const cart = new THREE.Group()
  cart.position.set(3.4, 0, 5.3)
  cart.rotation.y = -0.18
  cart.add(box(1.25, 0.12, 0.72, mats.metal, 0, 0.48, 0))
  cart.add(box(1.25, 0.12, 0.72, mats.metal, 0, 0.95, 0))
  for (const x of [-0.52, 0.52]) {
    for (const z of [-0.25, 0.25]) {
      cart.add(box(0.05, 0.85, 0.05, mats.metal, x, 0.54, z))
      const wheel = cylinder(0.075, 0.08, mats.rubber, x, 0.08, z, 8)
      wheel.rotation.x = Math.PI / 2
      cart.add(wheel)
    }
  }
  cart.add(box(0.34, 0.22, 0.28, mats.warning, -0.33, 1.16, 0))
  cart.add(box(0.24, 0.34, 0.24, mats.cabinetLight, 0.12, 1.2, 0))
  group.add(cart)

  addDecal(group, mats.blood, 5.8, 2.4, 20.5, 15.8, -0.25)
  addDecal(group, mats.blood, 3.8, 1.7, -4.8, -8.7, 0.4)
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
      position: new THREE.Vector3(HOSPITAL_POSITION.x - 30, 8.6, HOSPITAL_POSITION.y - 34),
      target: new THREE.Vector3(HOSPITAL_POSITION.x, 4.4, HOSPITAL_POSITION.y - 16),
    },
    lobby: {
      position: new THREE.Vector3(HOSPITAL_POSITION.x - 8.5, 1.72, HOSPITAL_POSITION.y - 20.4),
      target: new THREE.Vector3(HOSPITAL_POSITION.x + 1.5, 1.45, HOSPITAL_POSITION.y - 11.5),
    },
    'west-ward': {
      position: new THREE.Vector3(HOSPITAL_POSITION.x - 24, 1.72, HOSPITAL_POSITION.y - 5.5),
      target: new THREE.Vector3(HOSPITAL_POSITION.x - 24, 1.52, HOSPITAL_POSITION.y + 18),
    },
    'east-ward': {
      position: new THREE.Vector3(HOSPITAL_POSITION.x + 24, 1.72, HOSPITAL_POSITION.y + 19),
      target: new THREE.Vector3(HOSPITAL_POSITION.x + 24, 1.52, HOSPITAL_POSITION.y - 5),
    },
  }
  camera.fov = 70
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
  updateView(initial && initial in views ? initial : 'lobby')
  ;(window as unknown as { setStAgnesPreview?: (view: PreviewView) => void }).setStAgnesPreview = updateView
}

export function addStAgnesHospital({ context, materials }: StAgnesOptions): THREE.Group {
  const ground = terrainHeightAt(HOSPITAL_POSITION.x, HOSPITAL_POSITION.y)
  const group = new THREE.Group()
  group.name = 'st-agnes-hospital-v2'
  group.position.set(HOSPITAL_POSITION.x, ground, HOSPITAL_POSITION.y)
  context.scene.add(group)

  const hospitalMaterials = makeHospitalMaterials(context, materials)
  addArchitecture(group, context, hospitalMaterials)
  addExterior(group, context, materials, hospitalMaterials)
  addFurniture(group, context, hospitalMaterials)
  installPreviewCamera(context.scene)

  group.userData.footprint = {
    width: HOSPITAL_FOOTPRINT.width,
    depth: HOSPITAL_FOOTPRINT.depth,
  }
  group.userData.visualRevision = 2
  ;(window as unknown as { __ST_AGNES_READY__?: boolean }).__ST_AGNES_READY__ = true
  return group
}
