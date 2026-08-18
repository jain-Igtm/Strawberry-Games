import * as THREE from 'three'
import type { RectCollider } from './math'

export type InteractionKind = 'seal' | 'lore' | 'gate' | 'cache' | 'ending'

export interface Interaction {
  id: string
  kind: InteractionKind
  position: THREE.Vector3
  radius: number
  label: string
  title: string
  text: string
  object?: THREE.Object3D
  requiresReveal?: boolean
  complete: boolean
}

export interface AnimatedObject {
  object: THREE.Object3D
  kind: 'float' | 'spin' | 'pendulum' | 'pulse' | 'flicker'
  phase: number
  speed: number
  amount: number
  baseY: number
}

export interface Region {
  name: string
  kicker: string
  contains: (x: number, z: number) => boolean
}

export interface WorldData {
  colliders: RectCollider[]
  interactions: Interaction[]
  animated: AnimatedObject[]
  revealables: THREE.Object3D[]
  gate: {
    object: THREE.Group
    collider: RectCollider
    opened: boolean
    progress: number
  }
  getRegion: (x: number, z: number) => Region
  update: (elapsed: number, delta: number) => void
  setReveal: (visible: boolean) => void
  markSealCollected: (id: string) => void
  openGroundsCache: () => void
}

type MaterialSet = ReturnType<typeof createMaterials>

interface RoomOptions {
  x: number
  z: number
  width: number
  depth: number
  height: number
  openings?: {
    north?: Array<{ center: number; width: number }>
    south?: Array<{ center: number; width: number }>
    east?: Array<{ center: number; width: number }>
    west?: Array<{ center: number; width: number }>
  }
  floor?: THREE.Material
  wall?: THREE.Material
  ceiling?: boolean
}

interface GroundsCache {
  lid: THREE.Object3D
  prize: THREE.Object3D
  opened: boolean
}

function seededRandom(seed = 918273) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function makeStoneTexture(
  base: string,
  mortar: string,
  seed: number,
  tilesX = 4,
  tilesY = 4,
): THREE.CanvasTexture {
  const random = seededRandom(seed)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas textures are unavailable')

  context.fillStyle = mortar
  context.fillRect(0, 0, 256, 256)
  const tileWidth = 256 / tilesX
  const tileHeight = 256 / tilesY
  for (let row = 0; row < tilesY; row += 1) {
    for (let column = -1; column < tilesX + 1; column += 1) {
      const offset = row % 2 === 0 ? 0 : tileWidth / 2
      const x = column * tileWidth + offset + 2
      const y = row * tileHeight + 2
      const shade = Math.round((random() - 0.5) * 24)
      context.fillStyle = base
      context.fillRect(x, y, tileWidth - 4, tileHeight - 4)
      context.fillStyle = shade >= 0 ? `rgba(255,255,255,${shade / 230})` : `rgba(0,0,0,${-shade / 180})`
      context.fillRect(x, y, tileWidth - 4, tileHeight - 4)
      for (let fleck = 0; fleck < 5; fleck += 1) {
        const alpha = 0.03 + random() * 0.06
        context.fillStyle = `rgba(0,0,0,${alpha})`
        context.fillRect(
          x + random() * (tileWidth - 7),
          y + random() * (tileHeight - 7),
          1 + random() * 4,
          1 + random() * 2,
        )
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 2
  return texture
}

function makeWoodTexture(): THREE.CanvasTexture {
  const random = seededRandom(55211)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas textures are unavailable')
  context.fillStyle = '#241c16'
  context.fillRect(0, 0, 256, 256)
  for (let x = 0; x < 256; x += 32) {
    context.fillStyle = x % 64 === 0 ? '#392a20' : '#30241c'
    context.fillRect(x + 2, 0, 28, 256)
    context.fillStyle = 'rgba(0,0,0,.35)'
    context.fillRect(x + 29, 0, 3, 256)
    for (let line = 0; line < 12; line += 1) {
      context.fillStyle = `rgba(180,135,92,${0.02 + random() * 0.06})`
      context.fillRect(x + random() * 27, random() * 256, 8 + random() * 19, 1)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeRuneTexture(symbol: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas textures are unavailable')
  context.clearRect(0, 0, 256, 256)
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = 6
  context.shadowColor = color
  context.shadowBlur = 18
  context.font = '164px Georgia, serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(symbol, 128, 132)
  context.shadowBlur = 0
  context.strokeStyle = 'rgba(255,255,255,.35)'
  context.strokeRect(31, 31, 194, 194)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createMaterials() {
  const wallTexture = makeStoneTexture('#4a5350', '#242c29', 101)
  wallTexture.repeat.set(2.4, 1.5)
  const darkStoneTexture = makeStoneTexture('#3b423f', '#1e2522', 202)
  darkStoneTexture.repeat.set(2.1, 1.5)
  const floorTexture = makeStoneTexture('#414a46', '#202724', 303, 6, 6)
  floorTexture.repeat.set(4, 4)
  const greenStoneTexture = makeStoneTexture('#3a5148', '#1f3029', 404)
  greenStoneTexture.repeat.set(2, 2)
  const woodTexture = makeWoodTexture()
  woodTexture.repeat.set(2, 2)

  return {
    wall: new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.96, color: 0xd4d8d3 }),
    darkWall: new THREE.MeshStandardMaterial({
      map: darkStoneTexture,
      roughness: 1,
      color: 0xb8bdb5,
    }),
    greenWall: new THREE.MeshStandardMaterial({
      map: greenStoneTexture,
      roughness: 0.98,
      color: 0xc7d2cc,
    }),
    floor: new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.91, color: 0xbcc4bf }),
    wood: new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.92, color: 0xd0bca6 }),
    blackWood: new THREE.MeshStandardMaterial({ color: 0x28221d, roughness: 0.92 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x505b57, roughness: 0.56, metalness: 0.72 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x9f8859, roughness: 0.45, metalness: 0.62 }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xaaa89c, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x183c3d,
      emissive: 0x071515,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.72,
      roughness: 0.24,
      metalness: 0.12,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: 0xa8f2dc,
      emissive: 0x49d9b4,
      emissiveIntensity: 3.3,
      roughness: 0.22,
    }),
    blueGlow: new THREE.MeshStandardMaterial({
      color: 0xbfd2ff,
      emissive: 0x6487ff,
      emissiveIntensity: 3.1,
      roughness: 0.2,
    }),
    redGlow: new THREE.MeshStandardMaterial({
      color: 0xffc1a7,
      emissive: 0xd94e2e,
      emissiveIntensity: 2.9,
      roughness: 0.25,
    }),
    deadLeaf: new THREE.MeshStandardMaterial({ color: 0x202e27, roughness: 1 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x4c3455, roughness: 0.92, side: THREE.DoubleSide }),
    paper: new THREE.MeshStandardMaterial({ color: 0xc9bb96, roughness: 0.9 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x263a2f, roughness: 1 }),
    path: new THREE.MeshStandardMaterial({ color: 0x687069, roughness: 0.98 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x3d3228, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x234131, roughness: 1 }),
    paleLeaf: new THREE.MeshStandardMaterial({ color: 0x385448, roughness: 1 }),
  }
}

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function addCollider(
  colliders: RectCollider[],
  x: number,
  z: number,
  width: number,
  depth: number,
): RectCollider {
  const collider = {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    enabled: true,
  }
  colliders.push(collider)
  return collider
}

function wallSegments(
  center: number,
  length: number,
  openings: Array<{ center: number; width: number }>,
): Array<{ center: number; length: number }> {
  const start = center - length / 2
  const end = center + length / 2
  const clipped = openings
    .map((opening) => ({
      start: Math.max(start, opening.center - opening.width / 2),
      end: Math.min(end, opening.center + opening.width / 2),
    }))
    .filter((opening) => opening.end > opening.start)
    .sort((left, right) => left.start - right.start)
  const segments: Array<{ center: number; length: number }> = []
  let cursor = start
  for (const opening of clipped) {
    if (opening.start > cursor) {
      segments.push({
        center: (cursor + opening.start) / 2,
        length: opening.start - cursor,
      })
    }
    cursor = Math.max(cursor, opening.end)
  }
  if (cursor < end) segments.push({ center: (cursor + end) / 2, length: end - cursor })
  return segments
}

function addRoom(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  options: RoomOptions,
): THREE.Group {
  const room = new THREE.Group()
  room.position.set(options.x, 0, options.z)
  scene.add(room)
  const floorMaterial = options.floor ?? materials.floor
  const wallMaterial = options.wall ?? materials.wall
  addBox(room, floorMaterial, options.width, 0.22, options.depth, 0, -0.11, 0)
  if (options.ceiling !== false) {
    addBox(room, materials.darkWall, options.width, 0.2, options.depth, 0, options.height, 0)
  }

  const wallThickness = 0.42
  const northOpenings = options.openings?.north ?? []
  const southOpenings = options.openings?.south ?? []
  const eastOpenings = options.openings?.east ?? []
  const westOpenings = options.openings?.west ?? []

  for (const segment of wallSegments(0, options.width, northOpenings)) {
    addBox(
      room,
      wallMaterial,
      segment.length,
      options.height,
      wallThickness,
      segment.center,
      options.height / 2,
      -options.depth / 2,
    )
    addCollider(
      colliders,
      options.x + segment.center,
      options.z - options.depth / 2,
      segment.length,
      wallThickness,
    )
  }
  for (const segment of wallSegments(0, options.width, southOpenings)) {
    addBox(
      room,
      wallMaterial,
      segment.length,
      options.height,
      wallThickness,
      segment.center,
      options.height / 2,
      options.depth / 2,
    )
    addCollider(
      colliders,
      options.x + segment.center,
      options.z + options.depth / 2,
      segment.length,
      wallThickness,
    )
  }
  for (const segment of wallSegments(0, options.depth, westOpenings)) {
    addBox(
      room,
      wallMaterial,
      wallThickness,
      options.height,
      segment.length,
      -options.width / 2,
      options.height / 2,
      segment.center,
    )
    addCollider(
      colliders,
      options.x - options.width / 2,
      options.z + segment.center,
      wallThickness,
      segment.length,
    )
  }
  for (const segment of wallSegments(0, options.depth, eastOpenings)) {
    addBox(
      room,
      wallMaterial,
      wallThickness,
      options.height,
      segment.length,
      options.width / 2,
      options.height / 2,
      segment.center,
    )
    addCollider(
      colliders,
      options.x + options.width / 2,
      options.z + segment.center,
      wallThickness,
      segment.length,
    )
  }
  return room
}

function addArch(
  scene: THREE.Scene,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  width: number,
  rotationY = 0,
): void {
  const arch = new THREE.Mesh(new THREE.TorusGeometry(width / 2, 0.28, 7, 28, Math.PI), material)
  arch.position.set(x, y, z)
  arch.rotation.set(0, rotationY, 0)
  scene.add(arch)
}

function addColumn(
  scene: THREE.Scene,
  colliders: RectCollider[],
  material: THREE.Material,
  x: number,
  z: number,
  height = 5.8,
  radius = 0.48,
): void {
  const column = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, height, 10), material)
  shaft.position.y = height / 2
  column.add(shaft)
  addBox(column, material, radius * 2.5, 0.28, radius * 2.5, 0, 0.14, 0)
  addBox(column, material, radius * 2.3, 0.3, radius * 2.3, 0, height - 0.15, 0)
  column.position.set(x, 0, z)
  scene.add(column)
  addCollider(colliders, x, z, radius * 1.7, radius * 1.7)
}

function addWallLantern(
  scene: THREE.Scene,
  materials: MaterialSet,
  animated: AnimatedObject[],
  x: number,
  y: number,
  z: number,
  color: number,
  phase: number,
): void {
  const bracket = new THREE.Group()
  addBox(bracket, materials.iron, 0.08, 0.58, 0.08, 0, 0, 0)
  const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 0), materials.glow)
  cage.position.y = -0.35
  bracket.add(cage)
  const light = new THREE.PointLight(color, 8, 17, 1.7)
  light.position.y = -0.35
  bracket.add(light)
  bracket.position.set(x, y, z)
  scene.add(bracket)
  animated.push({
    object: light,
    kind: 'flicker',
    phase,
    speed: 5.2,
    amount: 0.2,
    baseY: 8,
  })
}

function createPedestal(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  x: number,
  z: number,
): THREE.Group {
  const pedestal = new THREE.Group()
  addBox(pedestal, materials.darkWall, 1.5, 0.28, 1.5, 0, 0.14, 0)
  addBox(pedestal, materials.wall, 0.9, 1.15, 0.9, 0, 0.85, 0)
  addBox(pedestal, materials.brass, 1.2, 0.18, 1.2, 0, 1.5, 0)
  pedestal.position.set(x, 0, z)
  scene.add(pedestal)
  addCollider(colliders, x, z, 1.25, 1.25)
  return pedestal
}

function createSeal(
  scene: THREE.Scene,
  animated: AnimatedObject[],
  id: string,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
): THREE.Group {
  const seal = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.09, 8, 24), material)
  ring.rotation.x = Math.PI / 2
  const bars = new THREE.Group()
  addBox(bars, material, 0.1, 0.72, 0.1, 0, 0, 0)
  addBox(bars, material, 0.66, 0.09, 0.1, 0, 0.04, 0)
  bars.rotation.z = id === 'seal-memory' ? Math.PI / 4 : id === 'seal-root' ? 0 : -Math.PI / 4
  seal.add(ring, bars)
  seal.position.set(x, y, z)
  scene.add(seal)
  animated.push({
    object: seal,
    kind: 'float',
    phase: id.length * 0.71,
    speed: 1.35,
    amount: 0.13,
    baseY: y,
  })
  animated.push({
    object: ring,
    kind: 'spin',
    phase: 0,
    speed: 0.5,
    amount: 1,
    baseY: 0,
  })
  return seal
}

function createHiddenRune(
  scene: THREE.Scene,
  revealables: THREE.Object3D[],
  symbol: string,
  x: number,
  y: number,
  z: number,
  rotationY: number,
  scale = 1,
): void {
  const material = new THREE.MeshBasicMaterial({
    map: makeRuneTexture(symbol, '#9effdd'),
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(1.5 * scale, 1.5 * scale), material)
  rune.position.set(x, y, z)
  rune.rotation.y = rotationY
  rune.visible = false
  scene.add(rune)
  revealables.push(rune)
}

function addGreatHall(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  animated: AnimatedObject[],
  revealables: THREE.Object3D[],
  interactions: Interaction[],
): void {
  addRoom(scene, colliders, materials, {
    x: 0,
    z: 2,
    width: 24,
    depth: 30,
    height: 7.4,
    openings: {
      north: [{ center: 0, width: 6 }],
      south: [{ center: 0, width: 6 }],
      east: [{ center: 0, width: 5.5 }],
      west: [{ center: 0, width: 5.5 }],
    },
  })

  for (const x of [-8.2, 8.2]) {
    for (const z of [-8, 0, 8]) addColumn(scene, colliders, materials.wall, x, z, 6.9, 0.53)
  }
  addArch(scene, materials.wall, 0, 4.7, -13, 6)
  addArch(scene, materials.wall, 11.8, 4.5, 2, 5.5, Math.PI / 2)
  addArch(scene, materials.wall, -11.8, 4.5, 2, 5.5, Math.PI / 2)

  for (const x of [-5.2, 0, 5.2]) {
    const chain = addBox(scene, materials.iron, 0.05, 2.7, 0.05, x, 6.1, 2)
    const chandelier = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 6, 20), materials.iron)
    chandelier.position.set(x, 4.8, 2)
    chandelier.rotation.x = Math.PI / 2
    scene.add(chandelier)
    chain.rotation.z = x * 0.001
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 6), materials.glow)
      flame.position.set(x + Math.cos(angle) * 0.92, 4.86, 2 + Math.sin(angle) * 0.92)
      scene.add(flame)
    }
    animated.push({
      object: chandelier,
      kind: 'pendulum',
      phase: x,
      speed: 0.24,
      amount: 0.025,
      baseY: 4.8,
    })
  }

  const ledgerDesk = new THREE.Group()
  addBox(ledgerDesk, materials.wood, 3.2, 0.22, 1.25, 0, 1.05, 0)
  for (const x of [-1.3, 1.3]) {
    addBox(ledgerDesk, materials.blackWood, 0.18, 1.05, 0.18, x, 0.52, -0.42)
    addBox(ledgerDesk, materials.blackWood, 0.18, 1.05, 0.18, x, 0.52, 0.42)
  }
  const book = addBox(ledgerDesk, materials.paper, 1.45, 0.12, 0.88, 0, 1.23, 0)
  book.rotation.y = 0.08
  ledgerDesk.position.set(0, 0, 10.6)
  scene.add(ledgerDesk)
  addCollider(colliders, 0, 10.6, 3.5, 1.5)
  interactions.push({
    id: 'ledger',
    kind: 'lore',
    position: new THREE.Vector3(0, 1.1, 10.3),
    radius: 2.35,
    label: 'Read the survey ledger',
    title: 'The Last Survey',
    text:
      'The final page lists four expeditions into the northern tower. Three routes are crossed out in brown ink. The fourth line is empty except for today’s date.',
    object: book,
    complete: false,
  })

  const banners = [-7.2, 0, 7.2]
  for (let index = 0; index < banners.length; index += 1) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.2), materials.cloth)
    banner.position.set(banners[index], 4.15, -12.76)
    banner.rotation.y = Math.PI
    scene.add(banner)
    const sigil = createSeal(
      scene,
      animated,
      `banner-${index}`,
      banners[index],
      4.2,
      -12.48,
      index === 0 ? materials.blueGlow : index === 1 ? materials.glow : materials.redGlow,
    )
    sigil.scale.setScalar(0.55)
  }
  createHiddenRune(scene, revealables, 'IV', 0, 2.7, 16.75, Math.PI, 1.2)
}

function addCorridors(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  animated: AnimatedObject[],
): void {
  addRoom(scene, colliders, materials, {
    x: 0,
    z: -25,
    width: 6,
    depth: 24,
    height: 5.2,
    openings: {
      north: [{ center: 0, width: 5.2 }],
      south: [{ center: 0, width: 5.2 }],
    },
    wall: materials.darkWall,
  })
  addRoom(scene, colliders, materials, {
    x: 22,
    z: 2,
    width: 20,
    depth: 5.5,
    height: 5.2,
    openings: {
      east: [{ center: 0, width: 4.8 }],
      west: [{ center: 0, width: 4.8 }],
    },
    wall: materials.greenWall,
  })
  addRoom(scene, colliders, materials, {
    x: -22,
    z: 2,
    width: 20,
    depth: 5.5,
    height: 5.2,
    openings: {
      east: [{ center: 0, width: 4.8 }],
      west: [{ center: 0, width: 4.8 }],
    },
    wall: materials.darkWall,
  })
  addRoom(scene, colliders, materials, {
    x: 0,
    z: -67,
    width: 6,
    depth: 20,
    height: 5.5,
    openings: {
      north: [{ center: 0, width: 5.1 }],
      south: [{ center: 0, width: 5.1 }],
    },
    wall: materials.darkWall,
  })

  for (const z of [-19, -25, -31, -62, -69, -75]) {
    addWallLantern(scene, materials, animated, -2.55, 3.7, z, 0x84ffd9, z * 0.2)
  }
  for (const x of [-18, -25, 18, 25]) {
    addWallLantern(scene, materials, animated, x, 3.55, -0.35, 0x84ffd9, x * 0.2)
  }
}

function addArchive(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  animated: AnimatedObject[],
  revealables: THREE.Object3D[],
  interactions: Interaction[],
): void {
  addRoom(scene, colliders, materials, {
    x: 43,
    z: 2,
    width: 22,
    depth: 28,
    height: 6.3,
    openings: { west: [{ center: 0, width: 5.2 }] },
    wall: materials.greenWall,
  })
  const water = new THREE.Mesh(new THREE.PlaneGeometry(20.8, 26.8), materials.water)
  water.rotation.x = -Math.PI / 2
  water.position.set(43, 0.045, 2)
  scene.add(water)
  animated.push({
    object: water,
    kind: 'pulse',
    phase: 0.2,
    speed: 0.45,
    amount: 0.035,
    baseY: 0.045,
  })

  for (const x of [36.5, 41, 45.5, 50]) {
    const shelf = new THREE.Group()
    addBox(shelf, materials.wood, 3.25, 5, 0.45, 0, 2.5, 0)
    for (const y of [0.55, 1.5, 2.45, 3.4, 4.35]) {
      addBox(shelf, materials.blackWood, 3.45, 0.12, 0.76, 0, y, 0)
    }
    for (let row = 0; row < 4; row += 1) {
      for (let bookIndex = 0; bookIndex < 7; bookIndex += 1) {
        const tone = (row + bookIndex) % 3
        const bookMaterial =
          tone === 0 ? materials.cloth : tone === 1 ? materials.paper : materials.blackWood
        addBox(
          shelf,
          bookMaterial,
          0.25 + (bookIndex % 2) * 0.06,
          0.62 + (bookIndex % 3) * 0.08,
          0.42,
          -1.25 + bookIndex * 0.4,
          0.92 + row * 0.95,
          0,
        )
      }
    }
    shelf.position.set(x, 0, -5.6)
    scene.add(shelf)
    addCollider(colliders, x, -5.6, 3.7, 1)
  }

  for (let index = 0; index < 9; index += 1) {
    const book = addBox(
      scene,
      index % 2 ? materials.paper : materials.cloth,
      0.58,
      0.1,
      0.82,
      36 + (index % 3) * 4.8,
      1.65 + (index % 4) * 0.52,
      6 + Math.floor(index / 3) * 2.2,
    )
    book.rotation.set((index % 3) * 0.13, index * 0.71, (index % 2) * 0.2)
    animated.push({
      object: book,
      kind: 'float',
      phase: index * 0.8,
      speed: 0.55 + (index % 3) * 0.12,
      amount: 0.24,
      baseY: book.position.y,
    })
  }

  const pedestal = createPedestal(scene, colliders, materials, 49, 10.1)
  const seal = createSeal(scene, animated, 'seal-memory', 49, 2.35, 10.1, materials.blueGlow)
  interactions.push({
    id: 'seal-memory',
    kind: 'seal',
    position: new THREE.Vector3(49, 1.6, 10.1),
    radius: 2.2,
    label: 'Take the Seal of Memory',
    title: 'Seal of Memory',
    text:
      'The metal is dry despite the water. A hundred half-remembered voices inhale at once, then settle behind your eyes.',
    object: seal,
    complete: false,
  })
  pedestal.rotation.y = 0.06

  const drownedDesk = addBox(scene, materials.wood, 3.4, 1.1, 1.7, 35.5, 0.55, 10.5)
  drownedDesk.rotation.y = -0.15
  addCollider(colliders, 35.5, 10.5, 3.6, 1.9)
  interactions.push({
    id: 'archive-note',
    kind: 'lore',
    position: new THREE.Vector3(35.5, 1, 10.5),
    radius: 2.4,
    label: 'Inspect the waterlogged desk',
    title: 'An Archivist’s Complaint',
    text:
      '“The rain has begun falling upward from the lower stacks again. Until the roof remembers where it belongs, all recovered volumes remain in the dry vault.”',
    object: drownedDesk,
    complete: false,
  })

  createHiddenRune(scene, revealables, 'REMEMBER', 53.72, 2.65, 5, -Math.PI / 2, 1.35)
  createHiddenRune(scene, revealables, 'DO NOT', 43, 4.2, 15.75, 0, 1.1)
}

function addCloister(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  animated: AnimatedObject[],
  revealables: THREE.Object3D[],
  interactions: Interaction[],
): void {
  addRoom(scene, colliders, materials, {
    x: -43,
    z: 2,
    width: 22,
    depth: 28,
    height: 6.3,
    openings: { east: [{ center: 0, width: 5.2 }] },
    wall: materials.darkWall,
    ceiling: false,
  })

  const courtyard = new THREE.Mesh(
    new THREE.CircleGeometry(7.2, 28),
    new THREE.MeshStandardMaterial({ color: 0x111a15, roughness: 1 }),
  )
  courtyard.rotation.x = -Math.PI / 2
  courtyard.position.set(-43, 0.035, 2)
  scene.add(courtyard)

  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.82, 5.8, 9),
    materials.blackWood,
  )
  trunk.position.y = 2.9
  trunk.rotation.z = 0.05
  tree.add(trunk)
  for (let index = 0; index < 9; index += 1) {
    const branch = addBox(
      tree,
      materials.blackWood,
      0.2,
      2.2 + (index % 3) * 0.7,
      0.2,
      0,
      5.4,
      0,
    )
    branch.rotation.z = -0.95 + index * 0.24
    branch.rotation.y = index * 1.71
    branch.position.y = 4.9 + (index % 2) * 0.5
  }
  tree.position.set(-43, 0, 2)
  scene.add(tree)
  addCollider(colliders, -43, 2, 2.2, 2.2)

  const stoneGeometry = new THREE.DodecahedronGeometry(0.55, 0)
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2
    const stone = new THREE.Mesh(stoneGeometry, materials.darkWall)
    stone.position.set(
      -43 + Math.cos(angle) * (4.5 + (index % 2) * 0.6),
      1.25 + (index % 3) * 0.38,
      2 + Math.sin(angle) * (4.5 + (index % 2) * 0.6),
    )
    stone.rotation.set(index * 0.4, index * 0.7, index * 0.21)
    scene.add(stone)
    animated.push({
      object: stone,
      kind: 'float',
      phase: index * 0.63,
      speed: 0.5,
      amount: 0.2,
      baseY: stone.position.y,
    })
    animated.push({
      object: stone,
      kind: 'spin',
      phase: index,
      speed: index % 2 ? 0.08 : -0.07,
      amount: 1,
      baseY: 0,
    })
  }

  const pedestal = createPedestal(scene, colliders, materials, -49.4, -7.2)
  pedestal.rotation.y = -0.1
  const seal = createSeal(scene, animated, 'seal-root', -49.4, 2.35, -7.2, materials.glow)
  interactions.push({
    id: 'seal-root',
    kind: 'seal',
    position: new THREE.Vector3(-49.4, 1.6, -7.2),
    radius: 2.2,
    label: 'Take the Seal of Roots',
    title: 'Seal of Roots',
    text:
      'Something beneath the courtyard loosens its grip. For one moment you feel the entire ruin hanging from the tree like fruit.',
    object: seal,
    complete: false,
  })

  interactions.push({
    id: 'cloister-tree',
    kind: 'lore',
    position: new THREE.Vector3(-43, 1.2, 2),
    radius: 2.7,
    label: 'Touch the dead tree',
    title: 'The Buried Bell',
    text:
      'The bark trembles under your hand. Far below the roots, a bell rings once. Dust falls from a ceiling that is no longer there.',
    object: tree,
    complete: false,
  })

  createHiddenRune(scene, revealables, 'BELOW', -43, 0.08, 7.5, Math.PI, 1.2)
  createHiddenRune(scene, revealables, 'LISTEN', -53.72, 2.9, -4, Math.PI / 2, 1.2)
}

function addCrossedStair(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  animated: AnimatedObject[],
  revealables: THREE.Object3D[],
  interactions: Interaction[],
): void {
  addRoom(scene, colliders, materials, {
    x: 0,
    z: -47,
    width: 22,
    depth: 20,
    height: 10,
    openings: {
      north: [{ center: 0, width: 5.5 }],
      south: [{ center: 0, width: 5.5 }],
    },
    wall: materials.darkWall,
  })
  for (const x of [-8.1, 8.1]) {
    for (const z of [-53.2, -40.8]) addColumn(scene, colliders, materials.darkWall, x, z, 9.4, 0.55)
  }

  const stairGroups: THREE.Group[] = []
  for (let staircase = 0; staircase < 4; staircase += 1) {
    const group = new THREE.Group()
    for (let step = 0; step < 11; step += 1) {
      addBox(
        group,
        materials.wall,
        2.6,
        0.34,
        0.7,
        0,
        step * 0.45,
        step * 0.66,
      )
    }
    const angle = staircase * (Math.PI / 2)
    group.position.set(
      Math.cos(angle) * 5.2,
      2.2 + (staircase % 2) * 1.2,
      -47 + Math.sin(angle) * 4.4,
    )
    group.rotation.y = -angle + Math.PI / 2
    group.rotation.z = staircase % 2 ? 0.14 : -0.1
    scene.add(group)
    stairGroups.push(group)
    animated.push({
      object: group,
      kind: 'float',
      phase: staircase * 1.3,
      speed: 0.22,
      amount: 0.28,
      baseY: group.position.y,
    })
    animated.push({
      object: group,
      kind: 'pendulum',
      phase: staircase * 0.7,
      speed: 0.12,
      amount: 0.02,
      baseY: group.position.y,
    })
  }

  const pedestal = createPedestal(scene, colliders, materials, 6.5, -48.8)
  pedestal.rotation.y = 0.16
  const seal = createSeal(scene, animated, 'seal-course', 6.5, 2.35, -48.8, materials.redGlow)
  interactions.push({
    id: 'seal-course',
    kind: 'seal',
    position: new THREE.Vector3(6.5, 1.6, -48.8),
    radius: 2.2,
    label: 'Take the Seal of Paths',
    title: 'Seal of Paths',
    text:
      'The staircases stop moving. Somewhere overhead, feet resume climbing toward a destination that no longer appears on any map.',
    object: seal,
    complete: false,
  })

  const timetable = addBox(scene, materials.wood, 3.3, 2.2, 0.2, -7.9, 2.2, -51.8)
  timetable.rotation.y = Math.PI / 2
  interactions.push({
    id: 'stair-timetable',
    kind: 'lore',
    position: new THREE.Vector3(-7.7, 1.6, -51.8),
    radius: 2.3,
    label: 'Read the shifting route slate',
    title: 'Routes Through the Tower',
    text:
      'The chalk rearranges itself as you watch: Root Passage, Silent Gallery, Interior Sky. Every route is marked “open.”',
    object: timetable,
    complete: false,
  })
  createHiddenRune(scene, revealables, 'UP IS A HABIT', -10.72, 4.1, -47, Math.PI / 2, 1.3)
  createHiddenRune(scene, revealables, 'NOON', 0, 7.6, -56.72, 0, 1.1)
}

function addGate(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  revealables: THREE.Object3D[],
  interactions: Interaction[],
): WorldData['gate'] {
  const gateGroup = new THREE.Group()
  for (let index = -3; index <= 3; index += 1) {
    addBox(gateGroup, materials.iron, 0.16, 5, 0.16, index * 0.68, 2.5, 0)
  }
  addBox(gateGroup, materials.iron, 4.7, 0.18, 0.18, 0, 1.1, 0)
  addBox(gateGroup, materials.iron, 4.7, 0.18, 0.18, 0, 3.8, 0)
  const lock = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), materials.brass)
  lock.position.y = 2.5
  gateGroup.add(lock)
  for (const x of [-1.2, 0, 1.2]) {
    const hollow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 18), materials.brass)
    hollow.position.set(x, 2.5, 0.13)
    gateGroup.add(hollow)
  }
  gateGroup.position.set(0, 0, -58.05)
  scene.add(gateGroup)
  const collider = addCollider(colliders, 0, -58.05, 5.4, 0.5)
  interactions.push({
    id: 'observatory-gate',
    kind: 'gate',
    position: new THREE.Vector3(0, 1.5, -57.2),
    radius: 2.35,
    label: 'Touch the observatory gate',
    title: 'The Observatory Gate',
    text: 'Three ward impressions surround the lock.',
    object: gateGroup,
    complete: false,
  })
  createHiddenRune(scene, revealables, 'A BEARER MAY ENTER', 0, 4.45, -57.78, 0, 1.2)
  return { object: gateGroup, collider, opened: false, progress: 0 }
}

function addObservatory(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  animated: AnimatedObject[],
  revealables: THREE.Object3D[],
  interactions: Interaction[],
): void {
  addRoom(scene, colliders, materials, {
    x: 0,
    z: -90,
    width: 26,
    depth: 26,
    height: 9.5,
    openings: { south: [{ center: 0, width: 5.5 }] },
    wall: materials.darkWall,
    ceiling: false,
  })
  const domeRing = new THREE.Mesh(new THREE.TorusGeometry(10.8, 0.25, 8, 48), materials.brass)
  domeRing.position.set(0, 7.5, -90)
  domeRing.rotation.x = Math.PI / 2
  scene.add(domeRing)
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(10.4, 0.11, 6, 40, Math.PI),
      materials.iron,
    )
    rib.position.set(0, 0.5, -90)
    rib.rotation.set(0, angle, Math.PI / 2)
    scene.add(rib)
  }

  const orrery = new THREE.Group()
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 12), materials.blueGlow)
  orrery.add(core)
  for (let index = 0; index < 4; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.75 + index * 0.72, 0.045, 6, 40),
      index % 2 ? materials.brass : materials.iron,
    )
    ring.rotation.set(index * 0.54, index * 0.75, index * 0.33)
    orrery.add(ring)
    animated.push({
      object: ring,
      kind: 'spin',
      phase: index,
      speed: (index % 2 ? -1 : 1) * (0.12 + index * 0.035),
      amount: 1,
      baseY: 0,
    })
  }
  orrery.position.set(0, 3.8, -90)
  scene.add(orrery)
  animated.push({
    object: orrery,
    kind: 'float',
    phase: 0.5,
    speed: 0.34,
    amount: 0.22,
    baseY: 3.8,
  })

  const table = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, 1.05, 18), materials.darkWall)
  table.position.set(0, 0.52, -90)
  scene.add(table)
  addCollider(colliders, 0, -90, 6.9, 6.9)

  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2 + Math.PI / 4
    const chair = new THREE.Group()
    addBox(chair, materials.wood, 1.6, 0.18, 1.4, 0, 1.1, 0)
    addBox(chair, materials.wood, 1.6, 2.4, 0.18, 0, 2.15, -0.58)
    for (const x of [-0.62, 0.62]) {
      addBox(chair, materials.blackWood, 0.16, 1.05, 0.16, x, 0.52, -0.48)
      addBox(chair, materials.blackWood, 0.16, 1.05, 0.16, x, 0.52, 0.48)
    }
    chair.position.set(
      Math.cos(angle) * 6.1,
      0,
      -90 + Math.sin(angle) * 6.1,
    )
    chair.rotation.y = -angle + Math.PI / 2
    scene.add(chair)
  }

  interactions.push({
    id: 'orrery',
    kind: 'ending',
    position: new THREE.Vector3(0, 1.3, -85.6),
    radius: 2.5,
    label: 'Touch the silent side of the orrery',
    title: 'The Missing Path',
    text:
      'A fourth ring appears around the orrery and turns south. Its line passes through the outer wall, toward country the old surveys left blank.',
    object: orrery,
    complete: false,
  })
  createHiddenRune(scene, revealables, 'CONTINUE', 0, 0.08, -81.8, Math.PI, 1.4)
}

function addOutdoorTrees(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
): void {
  const random = seededRandom(41971)
  const positions: Array<{ x: number; z: number; height: number; width: number }> = []
  let attempts = 0
  while (positions.length < 58 && attempts < 800) {
    attempts += 1
    const x = -55 + random() * 110
    const z = 23 + random() * 91
    const nearPath = Math.abs(x) < 8.5
    const nearPond = Math.hypot(x + 29, z - 68) < 13
    const nearGatehouse = x > 18 && x < 44 && z > 49 && z < 80
    const nearCache = Math.hypot(x, z - 92) < 12
    const nearWaystone =
      Math.hypot(x + 23, z - 87) < 5 ||
      Math.hypot(x - 23, z - 84) < 5 ||
      Math.hypot(x, z - 108) < 5
    if (nearPath || nearPond || nearGatehouse || nearCache || nearWaystone) continue
    if (
      positions.some((position) => Math.hypot(position.x - x, position.z - z) < 3.1)
    ) {
      continue
    }
    positions.push({
      x,
      z,
      height: 4.6 + random() * 3.2,
      width: 1.55 + random() * 0.75,
    })
  }

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.42, 0.62, 1, 7),
    materials.bark,
    positions.length,
  )
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 7),
    materials.leaf,
    positions.length * 2,
  )
  const dummy = new THREE.Object3D()
  positions.forEach((position, index) => {
    dummy.position.set(position.x, position.height * 0.43, position.z)
    dummy.rotation.set(0, index * 1.37, 0)
    dummy.scale.set(1, position.height * 0.86, 1)
    dummy.updateMatrix()
    trunks.setMatrixAt(index, dummy.matrix)

    dummy.position.set(position.x, position.height * 0.72, position.z)
    dummy.rotation.set(0, index * 0.83, 0)
    dummy.scale.set(position.width, position.height * 0.62, position.width)
    dummy.updateMatrix()
    crowns.setMatrixAt(index * 2, dummy.matrix)

    dummy.position.set(position.x, position.height * 1.02, position.z)
    dummy.rotation.set(0, index * 1.11 + 0.4, 0)
    dummy.scale.set(position.width * 0.72, position.height * 0.48, position.width * 0.72)
    dummy.updateMatrix()
    crowns.setMatrixAt(index * 2 + 1, dummy.matrix)
    addCollider(colliders, position.x, position.z, 1.15, 1.15)
  })
  trunks.instanceMatrix.needsUpdate = true
  crowns.instanceMatrix.needsUpdate = true
  scene.add(trunks, crowns)
}

function addOuterGrounds(
  scene: THREE.Scene,
  colliders: RectCollider[],
  materials: MaterialSet,
  animated: AnimatedObject[],
  revealables: THREE.Object3D[],
  interactions: Interaction[],
): GroundsCache {
  addBox(scene, materials.grass, 120, 0.32, 103, 0, -0.18, 68.5)
  addBox(scene, materials.path, 7.2, 0.08, 94, 0, 0.025, 67)

  const outerCourt = new THREE.Mesh(new THREE.CircleGeometry(12.5, 32), materials.path)
  outerCourt.rotation.x = -Math.PI / 2
  outerCourt.position.set(0, 0.075, 38)
  scene.add(outerCourt)

  for (let step = 0; step < 4; step += 1) {
    addBox(
      scene,
      materials.wall,
      7.5 + step * 0.65,
      0.18,
      1.15,
      0,
      0.08 + step * 0.04,
      17.5 + step * 1.05,
    )
  }

  const boundarySegments = [
    { x: -60, z: 68.5, width: 0.7, depth: 103 },
    { x: 60, z: 68.5, width: 0.7, depth: 103 },
    { x: -36, z: 17, width: 48, depth: 0.7 },
    { x: 36, z: 17, width: 48, depth: 0.7 },
    { x: -32, z: 120, width: 56, depth: 0.7 },
    { x: 32, z: 120, width: 56, depth: 0.7 },
  ]
  for (const segment of boundarySegments) {
    addBox(
      scene,
      materials.darkWall,
      segment.width,
      2.1,
      segment.depth,
      segment.x,
      1.05,
      segment.z,
    )
    addCollider(colliders, segment.x, segment.z, segment.width, segment.depth)
  }

  const outerGate = new THREE.Group()
  for (let index = -5; index <= 5; index += 1) {
    addBox(outerGate, materials.iron, 0.13, 3.8, 0.13, index * 0.64, 1.9, 0)
  }
  addBox(outerGate, materials.iron, 7, 0.15, 0.15, 0, 0.8, 0)
  addBox(outerGate, materials.iron, 7, 0.15, 0.15, 0, 3.05, 0)
  outerGate.position.set(0, 0, 119.7)
  scene.add(outerGate)
  addCollider(colliders, 0, 119.7, 7.5, 0.6)
  addColumn(scene, colliders, materials.wall, -4.5, 119.5, 4.8, 0.72)
  addColumn(scene, colliders, materials.wall, 4.5, 119.5, 4.8, 0.72)
  addArch(scene, materials.wall, 0, 4.55, 119.5, 8.5, Math.PI)

  const pond = new THREE.Mesh(new THREE.CircleGeometry(8.5, 32), materials.water)
  pond.rotation.x = -Math.PI / 2
  pond.position.set(-29, 0.06, 68)
  scene.add(pond)
  addCollider(colliders, -29, 68, 15.5, 12.5)
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.45 + (index % 3) * 0.12, 0),
      materials.darkWall,
    )
    rock.position.set(
      -29 + Math.cos(angle) * (8.35 + (index % 2) * 0.45),
      0.28,
      68 + Math.sin(angle) * (7.3 + (index % 2) * 0.4),
    )
    rock.scale.y = 0.55
    rock.rotation.set(index * 0.31, index * 0.77, index * 0.18)
    scene.add(rock)
  }
  interactions.push({
    id: 'moon-pond',
    kind: 'lore',
    position: new THREE.Vector3(-20.5, 1, 68),
    radius: 2.8,
    label: 'Look into the moon pond',
    title: 'The Moon Below',
    text:
      'The water reflects a clear night sky even beneath cloud. One star moves against the others, following the observatory dome.',
    object: pond,
    complete: false,
  })

  const gatehouse = new THREE.Group()
  addBox(gatehouse, materials.darkWall, 15, 0.35, 12, 0, 0.17, 0)
  addBox(gatehouse, materials.wall, 15, 3.4, 0.55, 0, 1.7, -6)
  addBox(gatehouse, materials.wall, 0.55, 3.4, 12, -7.25, 1.7, 0)
  addBox(gatehouse, materials.wall, 0.55, 3.4, 5, 7.25, 1.7, -3.5)
  addBox(gatehouse, materials.wall, 0.55, 1.1, 3.3, 7.25, 0.55, 4.35)
  gatehouse.position.set(31, 0, 65)
  scene.add(gatehouse)
  addCollider(colliders, 31, 59, 15, 0.55)
  addCollider(colliders, 23.75, 65, 0.55, 12)
  addCollider(colliders, 38.25, 61.5, 0.55, 5)
  addCollider(colliders, 38.25, 69.35, 0.55, 3.3)
  const gatehouseDesk = addBox(scene, materials.wood, 3.2, 1.05, 1.5, 29, 0.53, 62.5)
  gatehouseDesk.rotation.y = 0.2
  addCollider(colliders, 29, 62.5, 3.5, 1.8)
  interactions.push({
    id: 'gatehouse-log',
    kind: 'lore',
    position: new THREE.Vector3(29, 1, 62.5),
    radius: 2.4,
    label: 'Read the gatehouse log',
    title: 'Road Warden’s Log',
    text:
      'The last entries record arrivals from roads that do not reach Gravenmere. Beside each name, the warden wrote only: “allowed to continue.”',
    object: gatehouseDesk,
    complete: false,
  })

  const addWaystone = (
    id: string,
    title: string,
    text: string,
    rune: string,
    x: number,
    z: number,
    rotationY: number,
  ) => {
    const stone = new THREE.Group()
    addBox(stone, materials.darkWall, 1.9, 0.35, 1.9, 0, 0.17, 0)
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.78, 3.8, 6), materials.wall)
    pillar.position.y = 2.15
    pillar.rotation.y = rotationY
    stone.add(pillar)
    stone.position.set(x, 0, z)
    scene.add(stone)
    addCollider(colliders, x, z, 1.55, 1.55)
    createHiddenRune(
      scene,
      revealables,
      rune,
      x + Math.sin(rotationY) * 0.7,
      2.2,
      z + Math.cos(rotationY) * 0.7,
      rotationY,
      0.82,
    )
    interactions.push({
      id,
      kind: 'lore',
      position: new THREE.Vector3(x, 1.5, z),
      radius: 2.5,
      label: 'Read the revealed waystone',
      title,
      text,
      object: stone,
      requiresReveal: true,
      complete: false,
    })
  }

  addWaystone(
    'grounds-stone-water',
    'Water Waystone',
    'The first mark faces water that remembers a different sky.',
    'I · WATER',
    -23,
    87,
    -0.35,
  )
  addWaystone(
    'grounds-stone-gate',
    'Gate Waystone',
    'The second mark faces the broken house where every road was admitted.',
    'II · GATE',
    23,
    84,
    0.42,
  )
  addWaystone(
    'grounds-stone-yew',
    'Yew Waystone',
    'The third mark faces south, then points beneath the oldest yew.',
    'III · YEW',
    0,
    108,
    0,
  )

  const cache = new THREE.Group()
  addBox(cache, materials.darkWall, 3.4, 0.7, 3.4, 0, 0.35, 0)
  addBox(cache, materials.brass, 2.65, 0.12, 2.65, 0, 0.77, 0)
  const lid = addBox(cache, materials.wall, 2.85, 0.34, 2.85, 0, 0.98, 0)
  const prize = new THREE.Group()
  const compassRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.08, 8, 24), materials.glow)
  compassRing.rotation.x = Math.PI / 2
  prize.add(compassRing)
  const needle = addBox(prize, materials.redGlow, 0.12, 0.08, 0.78, 0, 0, 0)
  needle.rotation.y = 0.4
  prize.position.y = 1.35
  prize.visible = false
  cache.add(prize)
  cache.position.set(0, 0, 92)
  scene.add(cache)
  addCollider(colliders, 0, 92, 3.8, 3.8)
  interactions.push({
    id: 'grounds-cache',
    kind: 'cache',
    position: new THREE.Vector3(0, 1.1, 92),
    radius: 2.9,
    label: 'Inspect the sealed ground-cache',
    title: 'The Waystone Cache',
    text: 'Three shallow hollows wait around the brass rim.',
    object: cache,
    complete: false,
  })

  const camp = new THREE.Group()
  addBox(camp, materials.cloth, 4.8, 0.12, 3.2, 0, 0.08, 0)
  addBox(camp, materials.wood, 2.3, 0.24, 1.25, 2.6, 0.3, 0)
  addBox(camp, materials.wood, 1.25, 0.8, 1.25, -2.4, 0.4, 0.4)
  camp.position.set(30, 0, 96)
  camp.rotation.y = -0.2
  scene.add(camp)
  addCollider(colliders, 32.6, 95.5, 2.6, 1.6)
  interactions.push({
    id: 'abandoned-camp',
    kind: 'lore',
    position: new THREE.Vector3(30, 1, 96),
    radius: 3.2,
    label: 'Search the abandoned camp',
    title: 'A Recent Camp',
    text:
      'The bedroll is dry and the kettle is cold. A map of the grounds has been cut away from its paper, leaving only the roads beyond the walls.',
    object: camp,
    complete: false,
  })
  const campLight = new THREE.PointLight(0xffb66e, 24, 25, 1.65)
  campLight.position.set(29.5, 1.2, 96)
  scene.add(campLight)

  for (const z of [31, 57, 82]) {
    const post = new THREE.Group()
    addBox(post, materials.iron, 0.12, 2.8, 0.12, 0, 1.4, 0)
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), materials.glow)
    lamp.position.y = 2.65
    post.add(lamp)
    const light = new THREE.PointLight(0xb8ffe8, 10, 21, 1.65)
    light.position.y = 2.65
    post.add(light)
    post.position.set(4.8, 0, z)
    scene.add(post)
    animated.push({
      object: light,
      kind: 'flicker',
      phase: z * 0.27,
      speed: 4.1,
      amount: 0.14,
      baseY: 10,
    })
  }

  addOutdoorTrees(scene, colliders, materials)

  const groundsLight = new THREE.PointLight(0xb9d8ca, 44, 118, 1.28)
  groundsLight.position.set(-12, 24, 67)
  scene.add(groundsLight)

  return { lid, prize, opened: false }
}

function addDust(scene: THREE.Scene): void {
  const random = seededRandom(7733)
  const count = 720
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    const branch = index % 6
    let x = 0
    let z = 0
    if (branch === 0) {
      x = (random() - 0.5) * 22
      z = 2 + (random() - 0.5) * 28
    } else if (branch === 1) {
      x = 43 + (random() - 0.5) * 21
      z = 2 + (random() - 0.5) * 27
    } else if (branch === 2) {
      x = -43 + (random() - 0.5) * 21
      z = 2 + (random() - 0.5) * 27
    } else if (branch === 3) {
      x = (random() - 0.5) * 21
      z = -47 + (random() - 0.5) * 19
    } else if (branch === 4) {
      x = (random() - 0.5) * 25
      z = -90 + (random() - 0.5) * 25
    } else {
      x = (random() - 0.5) * 112
      z = 20 + random() * 96
    }
    positions[index * 3] = x
    positions[index * 3 + 1] = 0.5 + random() * 6
    positions[index * 3 + 2] = z
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: 0xb6cfbd,
    size: 0.028,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  })
  scene.add(new THREE.Points(geometry, material))
}

function setupLighting(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0x8299a3, 0x25342e, 1.45))
  const moon = new THREE.DirectionalLight(0xa9c1df, 1.35)
  moon.position.set(-20, 34, 12)
  scene.add(moon)
  const hall = new THREE.PointLight(0x8affdc, 18, 38, 1.7)
  hall.position.set(0, 5, 1)
  scene.add(hall)
  const archive = new THREE.PointLight(0x78e4e8, 15, 34, 1.7)
  archive.position.set(43, 4, 1)
  scene.add(archive)
  const cloister = new THREE.PointLight(0xb6e9ad, 15, 34, 1.7)
  cloister.position.set(-43, 5.5, 1)
  scene.add(cloister)
  const stair = new THREE.PointLight(0xe77f68, 16, 36, 1.7)
  stair.position.set(0, 7, -47)
  scene.add(stair)
  const observatory = new THREE.PointLight(0x90adff, 20, 40, 1.7)
  observatory.position.set(0, 7, -90)
  scene.add(observatory)
}

export function createWorld(scene: THREE.Scene): WorldData {
  const materials = createMaterials()
  const colliders: RectCollider[] = []
  const interactions: Interaction[] = []
  const animated: AnimatedObject[] = []
  const revealables: THREE.Object3D[] = []

  addGreatHall(scene, colliders, materials, animated, revealables, interactions)
  addCorridors(scene, colliders, materials, animated)
  addArchive(scene, colliders, materials, animated, revealables, interactions)
  addCloister(scene, colliders, materials, animated, revealables, interactions)
  addCrossedStair(scene, colliders, materials, animated, revealables, interactions)
  const gate = addGate(scene, colliders, materials, revealables, interactions)
  addObservatory(scene, colliders, materials, animated, revealables, interactions)
  const groundsCache = addOuterGrounds(
    scene,
    colliders,
    materials,
    animated,
    revealables,
    interactions,
  )
  addDust(scene)
  setupLighting(scene)

  const regions: Region[] = [
    {
      name: 'THE YEW WALK',
      kicker: 'OUTER GROUNDS · SOUTH WALL',
      contains: (x, z) => z > 90 && x > -16 && x < 16,
    },
    {
      name: 'THE MOON POND',
      kicker: 'OUTER GROUNDS · WEST GARDEN',
      contains: (x, z) => x < -16 && z > 50 && z < 88,
    },
    {
      name: 'THE BROKEN GATEHOUSE',
      kicker: 'OUTER GROUNDS · EAST ROAD',
      contains: (x, z) => x > 18 && z > 49 && z < 80,
    },
    {
      name: 'THE OUTER COURT',
      kicker: 'GRAVENMERE · SOUTH APPROACH',
      contains: (_x, z) => z > 17,
    },
    {
      name: 'THE DROWNED ARCHIVE',
      kicker: 'EAST VAULT · LOWER STACKS',
      contains: (x, z) => x > 31.5 && z > -13 && z < 16,
    },
    {
      name: 'THE ROOT CLOISTER',
      kicker: 'WEST WING · OPEN COURT',
      contains: (x, z) => x < -31.5 && z > -13 && z < 16,
    },
    {
      name: 'THE CROSSED STAIR',
      kicker: 'INNER KEEP · ALL FLOORS',
      contains: (x, z) => x > -11.5 && x < 11.5 && z < -36.8 && z > -57.3,
    },
    {
      name: 'THE OLD OBSERVATORY',
      kicker: 'NORTHERN TOWER · SEALED 1913',
      contains: (x, z) => x > -13.5 && x < 13.5 && z < -76.7,
    },
    {
      name: 'THE LANTERN PASSAGE',
      kicker: 'NORTH CORRIDOR',
      contains: (x, z) => x > -3.2 && x < 3.2 && z < -12.5,
    },
    {
      name: 'THE EAST PASSAGE',
      kicker: 'ARCHIVE CORRIDOR',
      contains: (x, z) => x > 11.5 && z > -1.5 && z < 5.5,
    },
    {
      name: 'THE WEST PASSAGE',
      kicker: 'CLOISTER CORRIDOR',
      contains: (x, z) => x < -11.5 && z > -1.5 && z < 5.5,
    },
    {
      name: 'THE GATE HALL',
      kicker: 'GRAVENMERE RUINS',
      contains: () => true,
    },
  ]

  function update(elapsed: number, delta: number) {
    for (const item of animated) {
      if (item.kind === 'float') {
        item.object.position.y = item.baseY + Math.sin(elapsed * item.speed + item.phase) * item.amount
      } else if (item.kind === 'spin') {
        item.object.rotation.y += item.speed * delta
      } else if (item.kind === 'pendulum') {
        item.object.rotation.z = Math.sin(elapsed * item.speed + item.phase) * item.amount
      } else if (item.kind === 'pulse') {
        item.object.position.y = item.baseY + Math.sin(elapsed * item.speed + item.phase) * item.amount
      } else if (item.kind === 'flicker' && item.object instanceof THREE.Light) {
        item.object.intensity =
          item.baseY * (0.93 + Math.sin(elapsed * item.speed + item.phase) * item.amount * 0.24)
      }
    }
    if (gate.opened && gate.progress < 1) {
      gate.progress = Math.min(1, gate.progress + delta * 0.42)
      const eased = 1 - (1 - gate.progress) ** 3
      gate.object.position.y = eased * 6.3
      if (gate.progress > 0.22) gate.collider.enabled = false
    }
  }

  function setReveal(visible: boolean) {
    for (const revealable of revealables) revealable.visible = visible
  }

  function markSealCollected(id: string) {
    const interaction = interactions.find((candidate) => candidate.id === id)
    if (!interaction) return
    interaction.complete = true
    if (interaction.object) interaction.object.visible = false
  }

  function openGroundsCache() {
    groundsCache.opened = true
    groundsCache.lid.position.y = 1.85
    groundsCache.lid.rotation.z = -0.38
    groundsCache.prize.visible = true
    const interaction = interactions.find((candidate) => candidate.id === 'grounds-cache')
    if (interaction) {
      interaction.complete = true
      interaction.text =
        'The three waystone marks released the lid. Inside lay a brass instrument whose needle points beyond the southern wall.'
    }
  }

  return {
    colliders,
    interactions,
    animated,
    revealables,
    gate,
    getRegion: (x, z) => regions.find((region) => region.contains(x, z)) ?? regions.at(-1)!,
    update,
    setReveal,
    markSealCollected,
    openGroundsCache,
  }
}
