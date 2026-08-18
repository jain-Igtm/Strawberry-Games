import * as THREE from 'three'
import type { RectCollider } from './math'
import { schoolPlan, type SchoolConnection, type SchoolSpace, type Side } from './school-plan'
import type { AnimatedObject, Interaction, Region } from './world'

type Opening = { center: number; width: number }
type Mats = ReturnType<typeof makeMaterials>

export interface InnerRangesData {
  colliders: RectCollider[]
  interactions: Interaction[]
  animated: AnimatedObject[]
  revealables: THREE.Object3D[]
  containsPosition: (x: number, z: number) => boolean
  getRegion: (x: number, z: number) => Region | null
  openCache: () => void
}

const MIN_Z = 16.25
const MAX_Z = 122.5
const HALF_WIDTH = 66
const boxCache = new Map<string, THREE.BoxGeometry>()

function containsPosition(x: number, z: number): boolean {
  return Math.abs(x) <= HALF_WIDTH && z >= MIN_Z && z <= MAX_Z
}

function randomFactory(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function stoneTexture(base: string, mortar: string, seed: number) {
  const random = randomFactory(seed)
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 192
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas textures are unavailable')
  context.fillStyle = mortar
  context.fillRect(0, 0, 192, 192)
  for (let row = 0; row < 6; row += 1) {
    for (let column = -1; column < 5; column += 1) {
      const x = column * 48 + (row % 2 ? 24 : 0) + 2
      const y = row * 32 + 2
      context.fillStyle = base
      context.fillRect(x, y, 44, 28)
      const value = random() - 0.5
      context.fillStyle = value > 0 ? `rgba(255,255,255,${value * 0.13})` : `rgba(0,0,0,${-value * 0.18})`
      context.fillRect(x, y, 44, 28)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2.4, 1.8)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 2
  return texture
}

function makeMaterials() {
  const masonry = (base: string, mortar: string, seed: number, color: number) =>
    new THREE.MeshStandardMaterial({ map: stoneTexture(base, mortar, seed), color, roughness: 0.96 })
  return {
    slate: masonry('#465350', '#202825', 211, 0xc2cdc7),
    blue: masonry('#3d4e5a', '#1b252c', 419, 0xc0ced7),
    violet: masonry('#504253', '#272028', 611, 0xcbbccc),
    warm: masonry('#5a5143', '#29251f', 733, 0xd5cbb7),
    dark: new THREE.MeshStandardMaterial({ color: 0x29312f, roughness: 1 }),
    floor: masonry('#525d59', '#252d2a', 929, 0xc5cdc8),
    warmFloor: new THREE.MeshStandardMaterial({ color: 0x716859, roughness: 0.92 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4e392c, roughness: 0.88 }),
    darkWood: new THREE.MeshStandardMaterial({ color: 0x27201c, roughness: 0.94 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xa78e58, metalness: 0.58, roughness: 0.42 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x45514f, metalness: 0.58, roughness: 0.52 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x294037, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x234e55, emissive: 0x0a2022, emissiveIntensity: 0.8, transparent: true, opacity: 0.76, roughness: 0.24 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x84b8aa, emissive: 0x142f29, emissiveIntensity: 0.45, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, roughness: 0.16 }),
    tealGlow: new THREE.MeshStandardMaterial({ color: 0xb7ffe7, emissive: 0x4bd6b1, emissiveIntensity: 3.5, roughness: 0.2 }),
    goldGlow: new THREE.MeshStandardMaterial({ color: 0xffdeb0, emissive: 0xf1a95c, emissiveIntensity: 3.2, roughness: 0.22 }),
    blueGlow: new THREE.MeshStandardMaterial({ color: 0xc8d9ff, emissive: 0x6c91e8, emissiveIntensity: 3.2, roughness: 0.2 }),
    violetGlow: new THREE.MeshStandardMaterial({ color: 0xf0c5ff, emissive: 0xa76dd0, emissiveIntensity: 3.1, roughness: 0.2 }),
  }
}

function materialFor(m: Mats, space: SchoolSpace): THREE.Material {
  if (space.colorFamily === 'blue') return m.blue
  if (space.colorFamily === 'warm') return m.warm
  if (space.colorFamily === 'violet') return m.violet
  if (space.colorFamily === 'green') return m.slate
  return m.slate
}

function geometry(width: number, height: number, depth: number) {
  const key = `${width}:${height}:${depth}`
  const found = boxCache.get(key)
  if (found) return found
  const value = new THREE.BoxGeometry(width, height, depth)
  boxCache.set(key, value)
  return value
}

function box(parent: THREE.Object3D, material: THREE.Material, width: number, height: number, depth: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function collider(list: RectCollider[], x: number, z: number, width: number, depth: number) {
  const value = { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, enabled: true }
  list.push(value)
  return value
}

function solid(scene: THREE.Scene, list: RectCollider[], material: THREE.Material, width: number, height: number, depth: number, x: number, y: number, z: number) {
  const mesh = box(scene, material, width, height, depth, x, y, z)
  collider(list, x, z, width, depth)
  return mesh
}

function segments(center: number, length: number, openings: readonly Opening[]) {
  const start = center - length / 2
  const end = center + length / 2
  const cuts = openings
    .map((opening) => ({ start: Math.max(start, opening.center - opening.width / 2), end: Math.min(end, opening.center + opening.width / 2) }))
    .filter((opening) => opening.end > opening.start)
    .sort((a, b) => a.start - b.start)
  const result: Opening[] = []
  let cursor = start
  for (const opening of cuts) {
    if (opening.start > cursor) result.push({ center: (cursor + opening.start) / 2, width: opening.start - cursor })
    cursor = Math.max(cursor, opening.end)
  }
  if (cursor < end) result.push({ center: (cursor + end) / 2, width: end - cursor })
  return result
}

function openings(space: SchoolSpace, side: Side): Opening[] {
  return schoolPlan.connections.flatMap((connection) => {
    const match = (connection.a === space.id && connection.sideA === side) || (connection.b === space.id && connection.sideB === side)
    return match ? [{ center: side === 'north' || side === 'south' ? space.x : space.z, width: connection.width }] : []
  })
}

function wall(scene: THREE.Scene, list: RectCollider[], material: THREE.Material, side: Side, x: number, z: number, length: number, height: number, doors: readonly Opening[]) {
  if (side === 'north' || side === 'south') {
    for (const part of segments(x, length, doors)) solid(scene, list, material, part.width, height, 0.46, part.center, height / 2, z)
  } else {
    for (const part of segments(z, length, doors)) solid(scene, list, material, 0.46, height, part.width, x, height / 2, part.center)
  }
}

function shell(scene: THREE.Scene, list: RectCollider[], m: Mats, space: SchoolSpace, ceiling = true, floor: THREE.Material = m.floor) {
  const height = space.height || 5.8
  const material = materialFor(m, space)
  box(scene, floor, space.width, 0.24, space.depth, space.x, -0.12, space.z)
  if (ceiling && !space.openSky) box(scene, m.dark, space.width, 0.22, space.depth, space.x, height, space.z)
  wall(scene, list, material, 'north', space.x, space.z - space.depth / 2, space.width, height, openings(space, 'north'))
  wall(scene, list, material, 'south', space.x, space.z + space.depth / 2, space.width, height, openings(space, 'south'))
  wall(scene, list, material, 'west', space.x - space.width / 2, space.z, space.depth, height, openings(space, 'west'))
  wall(scene, list, material, 'east', space.x + space.width / 2, space.z, space.depth, height, openings(space, 'east'))
}

function column(scene: THREE.Scene, list: RectCollider[], material: THREE.Material, x: number, z: number, height = 6.2, radius = 0.44) {
  const group = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius, height, 9), material)
  shaft.position.y = height / 2
  group.add(shaft)
  box(group, material, radius * 2.35, 0.22, radius * 2.35, 0, 0.11, 0)
  box(group, material, radius * 2.2, 0.26, radius * 2.2, 0, height - 0.13, 0)
  group.position.set(x, 0, z)
  scene.add(group)
  collider(list, x, z, radius * 1.75, radius * 1.75)
}

function arch(scene: THREE.Scene, material: THREE.Material, x: number, y: number, z: number, width: number, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(width / 2, 0.22, 7, 24, Math.PI), material)
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotationY
  scene.add(mesh)
}

function lantern(scene: THREE.Scene, m: Mats, x: number, y: number, z: number, glow: THREE.Material) {
  box(scene, m.iron, 0.08, 0.62, 0.08, x, y, z)
  const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), glow)
  cage.position.set(x, y - 0.38, z)
  scene.add(cage)
}

function roomLight(scene: THREE.Scene, color: number, intensity: number, distance: number, x: number, y: number, z: number) {
  const light = new THREE.PointLight(color, intensity, distance, 1.55)
  light.position.set(x, y, z)
  scene.add(light)
}

function table(scene: THREE.Scene, list: RectCollider[], m: Mats, x: number, z: number, width: number, depth: number) {
  box(scene, m.wood, width, 0.2, depth, x, 1.05, z)
  for (const dx of [-width / 2 + 0.3, width / 2 - 0.3]) for (const dz of [-depth / 2 + 0.3, depth / 2 - 0.3]) box(scene, m.darkWood, 0.18, 1.05, 0.18, x + dx, 0.52, z + dz)
  collider(list, x, z, width + 0.25, depth + 0.25)
}

function bench(scene: THREE.Scene, list: RectCollider[], m: Mats, x: number, z: number, rotationY = 0) {
  const group = new THREE.Group()
  box(group, m.wood, 3.2, 0.2, 0.72, 0, 0.75, 0)
  box(group, m.darkWood, 3.2, 1.25, 0.15, 0, 1.25, 0.32)
  for (const legX of [-1.2, 1.2]) box(group, m.darkWood, 0.18, 0.75, 0.18, legX, 0.37, 0)
  group.position.set(x, 0, z)
  group.rotation.y = rotationY
  scene.add(group)
  collider(list, x, z, rotationY ? 1 : 3.4, rotationY ? 3.4 : 1)
}

function sidePoint(space: SchoolSpace, side: Side) {
  if (side === 'north') return new THREE.Vector2(space.x, space.z - space.depth / 2)
  if (side === 'south') return new THREE.Vector2(space.x, space.z + space.depth / 2)
  if (side === 'west') return new THREE.Vector2(space.x - space.width / 2, space.z)
  return new THREE.Vector2(space.x + space.width / 2, space.z)
}

function overlaps(a: SchoolSpace, b: SchoolSpace) {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 0.05 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - 0.05
}

function connector(scene: THREE.Scene, list: RectCollider[], m: Mats, connection: SchoolConnection, spaces: ReadonlyMap<string, SchoolSpace>) {
  const a = spaces.get(connection.a)
  const b = spaces.get(connection.b)
  if (!a || !b || overlaps(a, b)) return
  const pa = sidePoint(a, connection.sideA)
  const pb = sidePoint(b, connection.sideB)
  const height = Math.max(5.4, Math.min(a.height || 6, b.height || 6))
  if (Math.abs(pa.x - pb.x) < 0.2) {
    const depth = Math.abs(pa.y - pb.y)
    if (depth < 0.15) return
    const x = pa.x
    const z = (pa.y + pb.y) / 2
    box(scene, m.floor, connection.width, 0.18, depth, x, -0.08, z)
    box(scene, m.dark, connection.width, 0.18, depth, x, height, z)
    solid(scene, list, m.slate, 0.42, height, depth, x - connection.width / 2, height / 2, z)
    solid(scene, list, m.slate, 0.42, height, depth, x + connection.width / 2, height / 2, z)
  } else if (Math.abs(pa.y - pb.y) < 0.2) {
    const width = Math.abs(pa.x - pb.x)
    if (width < 0.15) return
    const x = (pa.x + pb.x) / 2
    const z = pa.y
    box(scene, m.floor, width, 0.18, connection.width, x, -0.08, z)
    box(scene, m.dark, width, 0.18, connection.width, x, height, z)
    solid(scene, list, m.slate, width, height, 0.42, x, height / 2, z - connection.width / 2)
    solid(scene, list, m.slate, width, height, 0.42, x, height / 2, z + connection.width / 2)
  }
}

function cloister(scene: THREE.Scene, list: RectCollider[], m: Mats, spaces: ReadonlyMap<string, SchoolSpace>) {
  const south = spaces.get('south-cloister')!
  const north = spaces.get('north-cloister')!
  const west = spaces.get('west-cloister')!
  const east = spaces.get('east-cloister')!
  const court = spaces.get('founders-court')!
  for (const range of [south, north, west, east]) {
    box(scene, m.floor, range.width, 0.24, range.depth, range.x, -0.12, range.z)
    box(scene, m.dark, range.width, 0.2, range.depth, range.x, south.height, range.z)
  }
  wall(scene, list, m.slate, 'south', south.x, south.z + south.depth / 2, south.width, south.height, openings(south, 'south'))
  wall(scene, list, m.blue, 'north', north.x, north.z - north.depth / 2, north.width, north.height, openings(north, 'north'))
  wall(scene, list, m.violet, 'west', west.x - west.width / 2, west.z, west.depth, west.height, openings(west, 'west'))
  wall(scene, list, m.warm, 'east', east.x + east.width / 2, east.z, east.depth, east.height, openings(east, 'east'))
  const xs = [-18, -12, -6, 0, 6, 12, 18]
  const zs = [34, 41, 48, 55, 62]
  for (const x of xs) {
    column(scene, list, m.slate, x, 65, 6.25, 0.42)
    column(scene, list, m.blue, x, 31, 6.25, 0.42)
  }
  for (const z of zs) {
    column(scene, list, m.violet, -20, z, 6.25, 0.42)
    column(scene, list, m.warm, 20, z, 6.25, 0.42)
  }
  for (let i = 0; i < xs.length - 1; i += 1) {
    arch(scene, m.slate, (xs[i] + xs[i + 1]) / 2, 4.15, 65, 5.8)
    arch(scene, m.blue, (xs[i] + xs[i + 1]) / 2, 4.15, 31, 5.8, Math.PI)
  }
  for (let i = 0; i < zs.length - 1; i += 1) {
    arch(scene, m.violet, -20, 4.15, (zs[i] + zs[i + 1]) / 2, 6.8, Math.PI / 2)
    arch(scene, m.warm, 20, 4.15, (zs[i] + zs[i + 1]) / 2, 6.8, -Math.PI / 2)
  }
  box(scene, m.grass, court.width, 0.12, court.depth, court.x, -0.03, court.z)
  box(scene, m.floor, 4.2, 0.14, court.depth, 0, 0.02, 48)
  box(scene, m.floor, court.width, 0.14, 4.2, 0, 0.02, 48)
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.62, 28), m.dark)
  basin.position.set(0, 0.31, 48)
  scene.add(basin)
  collider(list, 0, 48, 8.6, 8.6)
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.85, 28), m.water)
  water.rotation.x = -Math.PI / 2
  water.position.set(0, 0.64, 48)
  scene.add(water)
  bench(scene, list, m, -12, 48, Math.PI / 2)
  bench(scene, list, m, 12, 48, -Math.PI / 2)
  lantern(scene, m, -18.8, 5.25, 32.2, m.violetGlow)
  lantern(scene, m, 18.8, 5.25, 63.8, m.goldGlow)
  roomLight(scene, 0xb8d9cb, 22, 52, 0, 10, 48)
}

function switchback(scene: THREE.Scene, list: RectCollider[], m: Mats, x: number, z: number, mirror: number) {
  const firstX = x - mirror * 2.05
  const secondX = x + mirror * 2.05
  for (let step = 0; step < 11; step += 1) {
    box(scene, m.slate, 3.1, 0.32, 0.62, firstX, 0.16 + step * 0.32, z + 3.2 - step * 0.56)
    box(scene, m.slate, 3.1, 0.32, 0.62, secondX, 3.68 + step * 0.32, z - 2.4 + step * 0.56)
  }
  box(scene, m.dark, 8.1, 0.4, 2.1, x, 3.55, z - 2.85)
  box(scene, m.slate, 8.1, 0.32, 2.1, x, 3.88, z - 2.85)
  for (const supportX of [x - 4.1, x, x + 4.1]) column(scene, list, m.dark, supportX, z - 2.85, 3.5, 0.34)
  collider(list, firstX, z + 0.25, 3.5, 6.8)
  collider(list, secondX, z + 0.25, 3.5, 6.8)
}

function stairTower(scene: THREE.Scene, list: RectCollider[], m: Mats, space: SchoolSpace, west: boolean) {
  shell(scene, list, m, space)
  switchback(scene, list, m, space.x, space.z, west ? 1 : -1)
  lantern(scene, m, space.x, 8.2, space.z, west ? m.violetGlow : m.goldGlow)
  roomLight(scene, west ? 0xb79cff : 0xffbd7c, 22, 32, space.x, 8, space.z)
}

function garden(scene: THREE.Scene, list: RectCollider[], m: Mats, space: SchoolSpace, west: boolean) {
  shell(scene, list, m, space, false, m.grass)
  box(scene, m.floor, 4, 0.12, space.depth - 2, space.x, 0.02, space.z)
  box(scene, m.floor, space.width - 2, 0.12, 4, space.x, 0.02, space.z)
  if (west) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), m.water)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(space.x, 0.08, space.z)
    scene.add(pool)
    collider(list, space.x, space.z, 8.8, 8.8)
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 5.2, 8), m.darkWood)
    trunk.position.set(space.x, 2.6, space.z)
    scene.add(trunk)
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.8, 9), m.slate)
    crown.position.set(space.x, 6.6, space.z)
    scene.add(crown)
    collider(list, space.x, space.z, 1.4, 1.4)
  }
  bench(scene, list, m, space.x - 9, space.z + 6, Math.PI / 2)
  bench(scene, list, m, space.x + 9, space.z - 6, -Math.PI / 2)
  roomLight(scene, west ? 0x9bbcff : 0xf0bb7c, 20, 42, space.x, 9, space.z)
}

function roomDetails(scene: THREE.Scene, list: RectCollider[], m: Mats) {
  table(scene, list, m, -4.8, 110.5, 3.8, 1.6)
  bench(scene, list, m, 5.8, 108.5, Math.PI / 2)
  for (const x of [-7.5, 7.5]) column(scene, list, m.slate, x, 106.5, 7.7, 0.5)
  arch(scene, m.warm, 0, 5.4, 103.3, 7.2)
  roomLight(scene, 0xffc487, 24, 38, 0, 6, 112)

  for (const z of [82.5, 88, 93.5, 99]) {
    column(scene, list, m.blue, -7.2, z, 6.8, 0.36)
    column(scene, list, m.blue, 7.2, z, 6.8, 0.36)
    arch(scene, m.blue, 0, 4.55, z, 14.1)
  }
  roomLight(scene, 0xa9d8d4, 20, 42, 0, 6.5, 91)

  for (const z of [31, 38, 45, 52, 59, 66]) {
    solid(scene, list, m.darkWood, 0.82, 5.6, 5.2, -61.5, 2.8, z)
    solid(scene, list, m.darkWood, 0.82, 5.6, 5.2, -34.5, 2.8, z)
  }
  for (const z of [36, 48, 60]) table(scene, list, m, -48, z, 8.2, 2.4)
  roomLight(scene, 0xb79cff, 25, 52, -48, 7, 48)

  for (const z of [37, 47, 57]) {
    table(scene, list, m, 43.2, z, 6.8, 2.2)
    table(scene, list, m, 52.8, z, 6.8, 2.2)
  }
  solid(scene, list, m.warmFloor, 18, 0.55, 5.4, 48, 0.27, 29.3)
  box(scene, m.wood, 9, 1.4, 1.9, 48, 0.7, 28.5)
  roomLight(scene, 0xffbd7c, 28, 58, 48, 8, 48)

  for (const z of [-1, 5, 11, 17]) {
    column(scene, list, m.blue, -7.1, z, 7.1, 0.36)
    column(scene, list, m.blue, 7.1, z, 7.1, 0.36)
    arch(scene, m.blue, 0, 4.7, z, 13.9)
  }
  roomLight(scene, 0x9fc7df, 20, 42, 0, 7, 8)
}

function waystone(scene: THREE.Scene, list: RectCollider[], m: Mats, revealables: THREE.Object3D[], interactions: Interaction[], id: string, title: string, text: string, x: number, z: number, glow: THREE.Material) {
  const group = new THREE.Group()
  box(group, m.dark, 1.9, 0.35, 1.9, 0, 0.17, 0)
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.78, 3.8, 6), m.slate)
  pillar.position.y = 2.15
  group.add(pillar)
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), glow)
  rune.position.set(0, 2.2, 0.72)
  rune.visible = false
  group.add(rune)
  group.position.set(x, 0, z)
  scene.add(group)
  revealables.push(rune)
  collider(list, x, z, 1.55, 1.55)
  interactions.push({ id, kind: 'lore', position: new THREE.Vector3(x, 1.5, z), radius: 2.5, label: 'Read the revealed waystone', title, text, object: group, requiresReveal: true, complete: false })
}

function puzzle(scene: THREE.Scene, list: RectCollider[], m: Mats, revealables: THREE.Object3D[], interactions: Interaction[]) {
  waystone(scene, list, m, revealables, interactions, 'grounds-stone-water', 'Water Court Mark', 'The first mark faces water held inside the western court.', -48, 94, m.blueGlow)
  waystone(scene, list, m, revealables, interactions, 'grounds-stone-gate', 'Gatehouse Mark', 'The second mark watches every arrival pass beneath the southern arch.', -6.5, 114, m.goldGlow)
  waystone(scene, list, m, revealables, interactions, 'grounds-stone-yew', 'Lantern Court Mark', 'The third mark stands beneath the tree whose branches avoid the lanterns.', 48, 94, m.tealGlow)
  const cache = new THREE.Group()
  box(cache, m.dark, 4.6, 1.1, 3.4, 0, 0.55, 0)
  const lid = box(cache, m.brass, 4.8, 0.26, 3.6, 0, 1.2, 0)
  const prize = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.12, 7, 24), m.goldGlow)
  prize.rotation.x = Math.PI / 2
  prize.position.y = 1.25
  prize.visible = false
  cache.add(prize)
  cache.position.set(0, 0, 57.5)
  scene.add(cache)
  collider(list, 0, 57.5, 5, 3.8)
  interactions.push({ id: 'grounds-cache', kind: 'cache', position: new THREE.Vector3(0, 1.1, 57.5), radius: 2.8, label: 'Open the cloister cache', title: 'The Cloister Cache', text: 'Three empty marks circle the brass lock.', object: cache, complete: false })
  let opened = false
  return () => {
    if (opened) return
    opened = true
    lid.position.y = 2.3
    lid.rotation.x = -0.45
    prize.visible = true
  }
}

function lore(scene: THREE.Scene, m: Mats, interactions: Interaction[]) {
  const items = [
    ['school-gate-ledger', 'The Admissions Ledger', 'The entries are arranged by door rather than date. Several students arrived through doors that no longer exist.', 'Read the admissions ledger', -4.8, 110.5, m.wood],
    ['school-library-index', 'Index of Borrowed Rooms', 'The catalogue records rooms as if they were books. The west tower has been overdue for eighty-seven years.', 'Read the open index', -48, 48, m.violet],
    ['school-hall-slate', 'Hall Order', 'Meals, lectures, and judgments share the same timetable. The final bell is reserved for a class whose name has been scraped away.', 'Read the hall order', 48, 28.2, m.darkWood],
    ['school-court-plaque', "Founders' Court", 'The inscription names no founder. It says only that the school was built around a place that was already waiting.', 'Read the court inscription', 0, 63.2, m.brass],
  ] as const
  for (const [id, title, text, label, x, z, material] of items) {
    const object = box(scene, material, 1.2, 0.14, 0.9, x, 1.2, z)
    interactions.push({ id, kind: 'lore', position: new THREE.Vector3(x, 1.2, z), radius: 2.5, label, title, text, object, complete: false })
  }
}

function grandStair(scene: THREE.Scene, list: RectCollider[], m: Mats) {
  const flight = (x: number, startZ: number, direction: number) => {
    for (let step = 0; step < 12; step += 1) box(scene, m.slate, 4.1, 0.34, 0.78, x, 0.17 + step * 0.34, startZ + direction * step * 0.61)
  }
  flight(-6.1, -54.1, 1)
  flight(6.1, -39.9, -1)
  box(scene, m.dark, 18.2, 0.45, 3.4, 0, 3.8, -47)
  box(scene, m.slate, 18.2, 0.42, 3.4, 0, 4.25, -47)
  collider(list, -6.1, -50.7, 4.5, 7.8)
  collider(list, 6.1, -43.3, 4.5, 7.8)
  for (const x of [-8.25, -3.9, 3.9, 8.25]) column(scene, list, m.dark, x, -47, 4.05, 0.42)
  roomLight(scene, 0xb4cde0, 20, 36, 0, 7, -47)
}

function clearGrounds(scene: THREE.Scene) {
  scene.updateMatrixWorld(true)
  const bounds = new THREE.Box3()
  const center = new THREE.Vector3()
  for (const child of [...scene.children]) {
    if (child instanceof THREE.Camera || child instanceof THREE.Light) continue
    bounds.setFromObject(child)
    if (bounds.isEmpty()) continue
    bounds.getCenter(center)
    if (containsPosition(center.x, center.z)) scene.remove(child)
  }
}

function region(space: SchoolSpace): Region {
  return {
    name: space.name.toUpperCase(),
    kicker: `GRAVENMERE · ${space.kind === 'cloister' ? 'CLOISTER RANGE' : space.kind.toUpperCase().replace('-', ' ')}`,
    contains: (x, z) => Math.abs(x - space.x) <= space.width / 2 && Math.abs(z - space.z) <= space.depth / 2,
  }
}

export function buildInnerRanges(scene: THREE.Scene): InnerRangesData {
  clearGrounds(scene)
  const m = makeMaterials()
  const colliders: RectCollider[] = []
  const interactions: Interaction[] = []
  const animated: AnimatedObject[] = []
  const revealables: THREE.Object3D[] = []
  const spaces = new Map<string, SchoolSpace>(schoolPlan.spaces.map((space) => [space.id, space] as const))

  cloister(scene, colliders, m, spaces)
  for (const space of schoolPlan.spaces) {
    if (space.kind === 'cloister' || space.kind === 'court') continue
    if (space.kind === 'garden') garden(scene, colliders, m, space, space.id === 'winter-court')
    else if (space.kind === 'stair') stairTower(scene, colliders, m, space, space.id === 'west-stair-tower')
    else shell(scene, colliders, m, space, true, space.kind === 'hall' || space.kind === 'gatehouse' ? m.warmFloor : m.floor)
  }
  for (const connection of schoolPlan.connections) connector(scene, colliders, m, connection, spaces)
  roomDetails(scene, colliders, m)
  lore(scene, m, interactions)
  const openCache = puzzle(scene, colliders, m, revealables, interactions)
  grandStair(scene, colliders, m)

  const regions = schoolPlan.spaces.map(region)
  regions.push({ name: 'THE GRAND STAIR HALL', kicker: 'GRAVENMERE · INNER KEEP', contains: (x, z) => Math.abs(x) < 12 && z > -58 && z < -36 })
  return { colliders, interactions, animated, revealables, containsPosition, getRegion: (x, z) => regions.find((value) => value.contains(x, z)) ?? null, openCache }
}
