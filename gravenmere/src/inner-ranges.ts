import * as THREE from 'three'

type Side = 'north' | 'south' | 'east' | 'west'

type Opening = {
  center: number
  width: number
}

type Openings = Partial<Record<Side, Opening[]>>

type Collider = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

type RangeLabel = {
  name: string
  kicker: string
  contains: (x: number, z: number) => boolean
}

type MaterialSet = ReturnType<typeof createMaterials>

const colliders: Collider[] = []
const geometryCache = new Map<string, THREE.BoxGeometry>()
let built = false
let lastSafeX = 0
let lastSafeZ = 0
let copyHookInstalled = false

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function makeMasonryTexture(base: string, mortar: string, seed: number): THREE.CanvasTexture {
  const random = seededRandom(seed)
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 192
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas textures are unavailable')
  context.fillStyle = mortar
  context.fillRect(0, 0, canvas.width, canvas.height)
  const width = 48
  const height = 32
  for (let row = 0; row < 6; row += 1) {
    for (let column = -1; column < 5; column += 1) {
      const offset = row % 2 ? width / 2 : 0
      const x = column * width + offset + 2
      const y = row * height + 2
      context.fillStyle = base
      context.fillRect(x, y, width - 4, height - 4)
      const value = random() - 0.5
      context.fillStyle = value > 0 ? `rgba(255,255,255,${value * 0.13})` : `rgba(0,0,0,${-value * 0.18})`
      context.fillRect(x, y, width - 4, height - 4)
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

function createMaterials() {
  return {
    slate: new THREE.MeshStandardMaterial({
      map: makeMasonryTexture('#465350', '#202825', 211),
      color: 0xc2cdc7,
      roughness: 0.96,
    }),
    blueStone: new THREE.MeshStandardMaterial({
      map: makeMasonryTexture('#3d4e5a', '#1b252c', 419),
      color: 0xc0ced7,
      roughness: 0.96,
    }),
    violetStone: new THREE.MeshStandardMaterial({
      map: makeMasonryTexture('#504253', '#272028', 611),
      color: 0xcbbccc,
      roughness: 0.98,
    }),
    warmStone: new THREE.MeshStandardMaterial({
      map: makeMasonryTexture('#5a5143', '#29251f', 733),
      color: 0xd5cbb7,
      roughness: 0.95,
    }),
    paleStone: new THREE.MeshStandardMaterial({ color: 0x87958e, roughness: 0.94 }),
    darkStone: new THREE.MeshStandardMaterial({ color: 0x29312f, roughness: 1 }),
    floor: new THREE.MeshStandardMaterial({
      map: makeMasonryTexture('#525d59', '#252d2a', 929),
      color: 0xc5cdc8,
      roughness: 0.91,
    }),
    warmFloor: new THREE.MeshStandardMaterial({ color: 0x716859, roughness: 0.92 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4e392c, roughness: 0.88 }),
    darkWood: new THREE.MeshStandardMaterial({ color: 0x27201c, roughness: 0.94 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xa78e58, metalness: 0.58, roughness: 0.42 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x45514f, metalness: 0.58, roughness: 0.52 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x294037, roughness: 1 }),
    paleGrass: new THREE.MeshStandardMaterial({ color: 0x385345, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x234e55,
      emissive: 0x0a2022,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.76,
      roughness: 0.24,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x84b8aa,
      emissive: 0x142f29,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.16,
    }),
    tealGlow: new THREE.MeshStandardMaterial({
      color: 0xb7ffe7,
      emissive: 0x4bd6b1,
      emissiveIntensity: 3.5,
      roughness: 0.2,
    }),
    goldGlow: new THREE.MeshStandardMaterial({
      color: 0xffdeb0,
      emissive: 0xf1a95c,
      emissiveIntensity: 3.2,
      roughness: 0.22,
    }),
    blueGlow: new THREE.MeshStandardMaterial({
      color: 0xc8d9ff,
      emissive: 0x6c91e8,
      emissiveIntensity: 3.2,
      roughness: 0.2,
    }),
    violetGlow: new THREE.MeshStandardMaterial({
      color: 0xf0c5ff,
      emissive: 0xa76dd0,
      emissiveIntensity: 3.1,
      roughness: 0.2,
    }),
  }
}

function boxGeometry(width: number, height: number, depth: number): THREE.BoxGeometry {
  const key = `${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}`
  const cached = geometryCache.get(key)
  if (cached) return cached
  const geometry = new THREE.BoxGeometry(width, height, depth)
  geometryCache.set(key, geometry)
  return geometry
}

function addCollider(x: number, z: number, width: number, depth: number): void {
  colliders.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  })
}

function addBox(
  scene: THREE.Object3D,
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  collide = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(boxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  scene.add(mesh)
  if (collide) addCollider(x, z, width, depth)
  return mesh
}

function segments(center: number, length: number, openings: Opening[]): Array<{ center: number; length: number }> {
  const start = center - length / 2
  const end = center + length / 2
  const cuts = openings
    .map((opening) => ({
      start: Math.max(start, opening.center - opening.width / 2),
      end: Math.min(end, opening.center + opening.width / 2),
    }))
    .filter((opening) => opening.end > opening.start)
    .sort((left, right) => left.start - right.start)
  const result: Array<{ center: number; length: number }> = []
  let cursor = start
  for (const opening of cuts) {
    if (opening.start > cursor) {
      result.push({ center: (cursor + opening.start) / 2, length: opening.start - cursor })
    }
    cursor = Math.max(cursor, opening.end)
  }
  if (cursor < end) result.push({ center: (cursor + end) / 2, length: end - cursor })
  return result
}

function addRoom(
  scene: THREE.Scene,
  materials: MaterialSet,
  options: {
    x: number
    z: number
    width: number
    depth: number
    height: number
    wall: THREE.Material
    floor?: THREE.Material
    ceiling?: boolean
    openings?: Openings
  },
): void {
  const thickness = 0.46
  addBox(scene, options.floor ?? materials.floor, options.width, 0.24, options.depth, options.x, -0.12, options.z)
  if (options.ceiling !== false) {
    addBox(scene, materials.darkStone, options.width, 0.22, options.depth, options.x, options.height, options.z)
  }
  for (const segment of segments(options.x, options.width, options.openings?.north ?? [])) {
    addBox(scene, options.wall, segment.length, options.height, thickness, segment.center, options.height / 2, options.z - options.depth / 2, true)
  }
  for (const segment of segments(options.x, options.width, options.openings?.south ?? [])) {
    addBox(scene, options.wall, segment.length, options.height, thickness, segment.center, options.height / 2, options.z + options.depth / 2, true)
  }
  for (const segment of segments(options.z, options.depth, options.openings?.west ?? [])) {
    addBox(scene, options.wall, thickness, options.height, segment.length, options.x - options.width / 2, options.height / 2, segment.center, true)
  }
  for (const segment of segments(options.z, options.depth, options.openings?.east ?? [])) {
    addBox(scene, options.wall, thickness, options.height, segment.length, options.x + options.width / 2, options.height / 2, segment.center, true)
  }
}

function addColumn(
  scene: THREE.Scene,
  material: THREE.Material,
  x: number,
  z: number,
  height = 6.2,
  radius = 0.48,
  collide = true,
): void {
  const column = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius, height, 9), material)
  shaft.position.y = height / 2
  column.add(shaft)
  addBox(column, material, radius * 2.45, 0.24, radius * 2.45, 0, 0.12, 0)
  addBox(column, material, radius * 2.25, 0.28, radius * 2.25, 0, height - 0.14, 0)
  column.position.set(x, 0, z)
  scene.add(column)
  if (collide) addCollider(x, z, radius * 1.75, radius * 1.75)
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
  const arch = new THREE.Mesh(new THREE.TorusGeometry(width / 2, 0.24, 7, 24, Math.PI), material)
  arch.position.set(x, y, z)
  arch.rotation.y = rotationY
  scene.add(arch)
}

function addLantern(
  scene: THREE.Scene,
  materials: MaterialSet,
  x: number,
  y: number,
  z: number,
  color: number,
  glow: THREE.Material,
): void {
  addBox(scene, materials.iron, 0.08, 0.62, 0.08, x, y, z)
  const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), glow)
  cage.position.set(x, y - 0.38, z)
  scene.add(cage)
  const light = new THREE.PointLight(color, 10, 22, 1.68)
  light.position.set(x, y - 0.38, z)
  scene.add(light)
}

function addBench(scene: THREE.Scene, materials: MaterialSet, x: number, z: number, rotationY = 0): void {
  const bench = new THREE.Group()
  addBox(bench, materials.wood, 3.2, 0.2, 0.72, 0, 0.75, 0)
  addBox(bench, materials.darkWood, 3.2, 1.25, 0.15, 0, 1.25, 0.32)
  for (const legX of [-1.2, 1.2]) addBox(bench, materials.darkWood, 0.18, 0.75, 0.18, legX, 0.37, 0)
  bench.position.set(x, 0, z)
  bench.rotation.y = rotationY
  scene.add(bench)
  addCollider(x, z, rotationY ? 1 : 3.4, rotationY ? 3.4 : 1)
}

function addTable(scene: THREE.Scene, materials: MaterialSet, x: number, z: number, width: number, depth: number): void {
  addBox(scene, materials.wood, width, 0.2, depth, x, 1.05, z)
  for (const dx of [-width / 2 + 0.3, width / 2 - 0.3]) {
    for (const dz of [-depth / 2 + 0.3, depth / 2 - 0.3]) {
      addBox(scene, materials.darkWood, 0.18, 1.05, 0.18, x + dx, 0.52, z + dz)
    }
  }
  addCollider(x, z, width + 0.25, depth + 0.25)
}

function addTree(scene: THREE.Scene, materials: MaterialSet, x: number, z: number, height: number): void {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, height * 0.58, 7), materials.darkWood)
  trunk.position.set(x, height * 0.29, z)
  scene.add(trunk)
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.65, height * 0.62, 8), materials.paleGrass)
  crown.position.set(x, height * 0.69, z)
  scene.add(crown)
  addCollider(x, z, 1.15, 1.15)
}

function addGlassRoof(scene: THREE.Scene, materials: MaterialSet, x: number, z: number, width: number, depth: number, y: number): void {
  const roof = new THREE.Group()
  const left = addBox(roof, materials.glass, width / 2, 0.08, depth, -width / 4, 0, 0)
  const right = addBox(roof, materials.glass, width / 2, 0.08, depth, width / 4, 0, 0)
  left.rotation.z = 0.12
  right.rotation.z = -0.12
  for (let offset = -depth / 2; offset <= depth / 2; offset += 4.5) {
    addBox(roof, materials.brass, width, 0.08, 0.08, 0, 0.04, offset)
  }
  addBox(roof, materials.brass, 0.1, 0.18, depth, 0, 0.22, 0)
  roof.position.set(x, y, z)
  scene.add(roof)
}

function addFixedCrossedStair(scene: THREE.Scene, materials: MaterialSet): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Group)) return
    if (Math.abs(object.position.z + 47) > 8 || Math.abs(object.position.x) > 7) return
    const steps = object.children.filter((child) => {
      if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.BoxGeometry)) return false
      const parameters = child.geometry.parameters
      return Math.abs(parameters.width - 2.6) < 0.01 && Math.abs(parameters.height - 0.34) < 0.01
    })
    if (steps.length === 11) object.visible = false
  })

  const addFlight = (x: number, startZ: number, direction: number) => {
    for (let step = 0; step < 12; step += 1) {
      addBox(
        scene,
        materials.paleStone,
        4.1,
        0.34,
        0.78,
        x,
        0.17 + step * 0.34,
        startZ + direction * step * 0.61,
      )
    }
  }

  addFlight(-6.4, -54.1, 1)
  addFlight(6.4, -39.9, -1)
  addBox(scene, materials.slate, 18.2, 0.42, 3.4, 0, 4.25, -47)
  addBox(scene, materials.darkStone, 18.2, 0.45, 3.4, 0, 3.8, -47)
  addCollider(-6.4, -50.7, 4.5, 7.8)
  addCollider(6.4, -43.3, 4.5, 7.8)

  for (const x of [-8.25, -3.9, 3.9, 8.25]) addColumn(scene, materials.darkStone, x, -47, 4.05, 0.42, false)
  for (const x of [-8.7, 8.7]) {
    addBox(scene, materials.brass, 0.1, 1.1, 3.4, x, 4.9, -47)
  }
  for (let x = -7.8; x <= 7.8; x += 1.3) {
    addBox(scene, materials.iron, 0.08, 0.95, 0.08, x, 4.78, -45.42)
    addBox(scene, materials.iron, 0.08, 0.95, 0.08, x, 4.78, -48.58)
  }
  addBox(scene, materials.brass, 16.2, 0.09, 0.09, 0, 5.2, -45.42)
  addBox(scene, materials.brass, 16.2, 0.09, 0.09, 0, 5.2, -48.58)
  addArch(scene, materials.warmStone, 0, 7.2, -55.7, 6.2)
  addArch(scene, materials.blueStone, 0, 7.2, -38.3, 6.2, Math.PI)
  addLantern(scene, materials, -9.5, 6.3, -47, 0xffb16d, materials.goldGlow)
  addLantern(scene, materials, 9.5, 6.3, -47, 0x8fd8ff, materials.blueGlow)
}

function addFoundersCourt(scene: THREE.Scene, materials: MaterialSet): void {
  addRoom(scene, materials, {
    x: 0,
    z: 36,
    width: 52,
    depth: 32,
    height: 7.2,
    wall: materials.slate,
    floor: materials.warmFloor,
    ceiling: false,
    openings: {
      north: [{ center: 0, width: 7 }],
      south: [{ center: 0, width: 8 }],
      east: [{ center: 36, width: 7 }],
      west: [{ center: 36, width: 7 }],
    },
  })
  addBox(scene, materials.floor, 7, 0.12, 35, 0, 0.04, 36)
  for (const x of [-19.5, -13, 13, 19.5]) {
    for (const z of [23.5, 48.5]) addColumn(scene, materials.paleStone, x, z, 6.7, 0.48)
  }
  for (const x of [-16.25, 16.25]) {
    addArch(scene, materials.paleStone, x, 4.4, 23.5, 6.5)
    addArch(scene, materials.paleStone, x, 4.4, 48.5, 6.5, Math.PI)
  }
  for (const z of [28, 36, 44]) {
    addColumn(scene, materials.paleStone, -22.5, z, 6.7, 0.45)
    addColumn(scene, materials.paleStone, 22.5, z, 6.7, 0.45)
    addArch(scene, materials.paleStone, -22.5, 4.3, z, 6.4, Math.PI / 2)
    addArch(scene, materials.paleStone, 22.5, 4.3, z, 6.4, -Math.PI / 2)
  }
  addBench(scene, materials, -10, 39, 0)
  addBench(scene, materials, 10, 33, Math.PI)
  addLantern(scene, materials, -5, 5.2, 26, 0x91ffe0, materials.tealGlow)
  addLantern(scene, materials, 5, 5.2, 46, 0xffc27c, materials.goldGlow)
  const light = new THREE.PointLight(0xb7d9cb, 20, 48, 1.45)
  light.position.set(0, 11, 36)
  scene.add(light)
}

function addLongGallery(scene: THREE.Scene, materials: MaterialSet): void {
  addRoom(scene, materials, {
    x: 0,
    z: 75,
    width: 18,
    depth: 46,
    height: 7.1,
    wall: materials.blueStone,
    openings: {
      north: [{ center: 0, width: 8 }],
      south: [{ center: 0, width: 8 }],
      east: [{ center: 69, width: 8 }],
      west: [{ center: 70, width: 8 }],
    },
  })
  for (const z of [57, 65, 75, 85, 93]) {
    addColumn(scene, materials.paleStone, -7.25, z, 6.6, 0.38)
    addColumn(scene, materials.paleStone, 7.25, z, 6.6, 0.38)
    addArch(scene, z % 20 === 5 ? materials.warmStone : materials.blueStone, 0, 4.55, z, 14.5)
  }
  for (const z of [60, 72, 84, 94]) {
    const warm = Math.floor(z / 10) % 2 === 0
    addLantern(scene, materials, -7.6, 4.8, z, warm ? 0xffb86f : 0x78e8dc, warm ? materials.goldGlow : materials.tealGlow)
    addLantern(scene, materials, 7.6, 4.8, z + 3, warm ? 0x78e8dc : 0xffb86f, warm ? materials.tealGlow : materials.goldGlow)
  }
  for (const z of [63, 79, 91]) {
    const frame = addBox(scene, materials.brass, 2.7, 3.3, 0.12, -8.73, 2.7, z)
    frame.rotation.y = Math.PI / 2
    addBox(scene, materials.violetStone, 2.2, 2.8, 0.08, -8.63, 2.7, z)
  }
}

function addMoonCloister(scene: THREE.Scene, materials: MaterialSet): void {
  addRoom(scene, materials, {
    x: -33,
    z: 70,
    width: 46,
    depth: 36,
    height: 6.7,
    wall: materials.violetStone,
    floor: materials.grass,
    ceiling: false,
    openings: {
      north: [{ center: -33, width: 8 }],
      south: [{ center: -33, width: 8 }],
      east: [{ center: 70, width: 8 }],
    },
  })
  const innerWidth = 29
  const innerDepth = 21
  for (const x of [-46, -39.5, -26.5, -20]) {
    addColumn(scene, materials.paleStone, x, 60.5, 6.2, 0.42)
    addColumn(scene, materials.paleStone, x, 79.5, 6.2, 0.42)
  }
  for (const z of [63, 70, 77]) {
    addColumn(scene, materials.paleStone, -47.5, z, 6.2, 0.42)
    addColumn(scene, materials.paleStone, -18.5, z, 6.2, 0.42)
  }
  addBox(scene, materials.floor, innerWidth, 0.1, 2.5, -33, 0.03, 59.7)
  addBox(scene, materials.floor, innerWidth, 0.1, 2.5, -33, 0.03, 80.3)
  addBox(scene, materials.floor, 2.5, 0.1, innerDepth, -48.3, 0.03, 70)
  addBox(scene, materials.floor, 2.5, 0.1, innerDepth, -17.7, 0.03, 70)
  addBench(scene, materials, -42, 76.5, -Math.PI / 2)
  addBench(scene, materials, -24, 63.5, Math.PI / 2)
  addLantern(scene, materials, -47.5, 5.1, 60.5, 0xb590ff, materials.violetGlow)
  addLantern(scene, materials, -18.5, 5.1, 79.5, 0x87dfff, materials.blueGlow)
  const moonLight = new THREE.PointLight(0xa8baff, 24, 46, 1.48)
  moonLight.position.set(-33, 10, 70)
  scene.add(moonLight)
}

function addSurveyHall(scene: THREE.Scene, materials: MaterialSet): void {
  addRoom(scene, materials, {
    x: 31,
    z: 69,
    width: 44,
    depth: 34,
    height: 7.3,
    wall: materials.warmStone,
    floor: materials.warmFloor,
    openings: {
      north: [{ center: 42, width: 8 }],
      south: [{ center: 31, width: 8 }],
      west: [{ center: 69, width: 8 }],
    },
  })
  for (const x of [18, 27, 36, 45]) {
    addTable(scene, materials, x, 73, 5.6, 2.2)
  }
  for (const x of [17, 25, 33, 41, 49]) {
    const cabinet = addBox(scene, materials.darkWood, 4.6, 4.8, 0.7, x, 2.4, 53.9, true)
    cabinet.rotation.y = 0
    for (let y = 0.8; y < 4.5; y += 0.9) addBox(scene, materials.brass, 4.1, 0.06, 0.76, x, y, 54.25)
  }
  const map = new THREE.Mesh(new THREE.CircleGeometry(6.8, 28), materials.blueStone)
  map.rotation.x = -Math.PI / 2
  map.position.set(31, 0.08, 63.5)
  scene.add(map)
  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.75, 6), index % 2 ? materials.tealGlow : materials.goldGlow)
    marker.position.set(31 + Math.cos(angle) * (2.5 + index * 0.35), 0.48, 63.5 + Math.sin(angle) * (2.5 + index * 0.35))
    scene.add(marker)
  }
  addLantern(scene, materials, 12.2, 5.4, 61, 0xffc06f, materials.goldGlow)
  addLantern(scene, materials, 49.8, 5.4, 78, 0xff9f71, materials.goldGlow)
  const light = new THREE.PointLight(0xffc07d, 26, 52, 1.5)
  light.position.set(31, 8, 69)
  scene.add(light)
}

function addSouthVestibule(scene: THREE.Scene, materials: MaterialSet): void {
  addRoom(scene, materials, {
    x: 0,
    z: 109,
    width: 24,
    depth: 22,
    height: 8.2,
    wall: materials.slate,
    floor: materials.floor,
    openings: {
      north: [{ center: 0, width: 8 }],
      south: [{ center: 0, width: 8 }],
      east: [{ center: 109, width: 7 }],
      west: [{ center: 109, width: 7 }],
    },
  })
  for (const x of [-8.8, 8.8]) {
    for (const z of [101.5, 116.5]) addColumn(scene, materials.paleStone, x, z, 7.7, 0.54)
  }
  addArch(scene, materials.paleStone, 0, 5.5, 99.2, 8)
  addArch(scene, materials.paleStone, 0, 5.5, 118.8, 8, Math.PI)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.14, 8, 36), materials.brass)
  ring.position.set(0, 5.8, 109)
  ring.rotation.x = Math.PI / 2
  scene.add(ring)
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), materials.goldGlow)
    lamp.position.set(Math.cos(angle) * 3.7, 5.8, 109 + Math.sin(angle) * 3.7)
    scene.add(lamp)
  }
  const light = new THREE.PointLight(0xffca87, 25, 40, 1.55)
  light.position.set(0, 6, 109)
  scene.add(light)
}

function addWinterGarden(scene: THREE.Scene, materials: MaterialSet): void {
  addRoom(scene, materials, {
    x: -33,
    z: 103,
    width: 46,
    depth: 30,
    height: 7.4,
    wall: materials.blueStone,
    floor: materials.grass,
    ceiling: false,
    openings: {
      north: [{ center: -33, width: 8 }],
      east: [{ center: 109, width: 7 }],
    },
  })
  addGlassRoof(scene, materials, -33, 103, 42, 27, 7.3)
  for (const position of [
    [-44, 95, 6.5],
    [-38, 110, 5.8],
    [-27, 97, 6.2],
    [-20, 111, 5.5],
  ] as const) {
    addTree(scene, materials, position[0], position[1], position[2])
  }
  const pool = new THREE.Mesh(new THREE.CircleGeometry(4.4, 24), materials.water)
  pool.rotation.x = -Math.PI / 2
  pool.position.set(-33, 0.08, 103)
  scene.add(pool)
  addBench(scene, materials, -45, 104, Math.PI / 2)
  addBench(scene, materials, -21, 102, -Math.PI / 2)
  const light = new THREE.PointLight(0x9ddbc9, 26, 48, 1.45)
  light.position.set(-33, 8.5, 103)
  scene.add(light)
}

function addLanternConservatory(scene: THREE.Scene, materials: MaterialSet): void {
  addRoom(scene, materials, {
    x: 31,
    z: 103,
    width: 44,
    depth: 30,
    height: 7.4,
    wall: materials.warmStone,
    floor: materials.paleGrass,
    ceiling: false,
    openings: {
      north: [{ center: 31, width: 8 }],
      west: [{ center: 109, width: 7 }],
    },
  })
  addGlassRoof(scene, materials, 31, 103, 40, 27, 7.3)
  for (const x of [18, 25, 37, 44]) {
    const planter = addBox(scene, materials.warmStone, 4.7, 0.75, 2.2, x, 0.37, x % 2 ? 96 : 110, true)
    planter.rotation.y = x % 2 ? 0.12 : -0.12
    for (let index = 0; index < 5; index += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.5 + (index % 2) * 0.4, 6), materials.paleGrass)
      leaf.position.set(x - 1.5 + index * 0.75, 1.35, x % 2 ? 96 : 110)
      leaf.rotation.z = -0.22 + index * 0.1
      scene.add(leaf)
    }
  }
  for (const z of [94.5, 101.5, 108.5, 115.5]) {
    addLantern(scene, materials, 10.3, 5.2, z, 0xffbe71, materials.goldGlow)
    addLantern(scene, materials, 51.7, 5.2, z, 0x9ee5c8, materials.tealGlow)
  }
  const light = new THREE.PointLight(0xf0bb7c, 28, 50, 1.45)
  light.position.set(31, 8.5, 103)
  scene.add(light)
}

function addSideRanges(scene: THREE.Scene, materials: MaterialSet): void {
  addRoom(scene, materials, {
    x: -42,
    z: 36,
    width: 30,
    depth: 28,
    height: 6.4,
    wall: materials.darkStone,
    openings: {
      east: [{ center: 36, width: 7 }],
      south: [{ center: -42, width: 6 }],
    },
  })
  for (const x of [-51, -45, -39, -33]) {
    addColumn(scene, materials.violetStone, x, 27, 5.9, 0.4)
    addArch(scene, materials.violetStone, x + 3, 4.05, 27, 6)
  }
  for (const z of [33, 40, 46]) addBench(scene, materials, -49, z, Math.PI / 2)
  addLantern(scene, materials, -55.5, 4.8, 30, 0xb695ff, materials.violetGlow)
  addLantern(scene, materials, -55.5, 4.8, 44, 0x88d8ff, materials.blueGlow)

  addRoom(scene, materials, {
    x: 42,
    z: 36,
    width: 30,
    depth: 28,
    height: 6.8,
    wall: materials.blueStone,
    floor: materials.floor,
    openings: {
      west: [{ center: 36, width: 7 }],
      south: [{ center: 42, width: 6 }],
    },
  })
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.8, 0.6, 28), materials.darkStone)
  basin.position.set(42, 0.3, 36)
  scene.add(basin)
  addCollider(42, 36, 14.6, 14.6)
  const water = new THREE.Mesh(new THREE.CircleGeometry(6.8, 28), materials.water)
  water.rotation.x = -Math.PI / 2
  water.position.set(42, 0.63, 36)
  scene.add(water)
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.28 + index * 0.035, 9, 7), index % 2 ? materials.blueGlow : materials.tealGlow)
    sphere.position.set(42 + Math.cos(angle) * 4.6, 1.5 + (index % 3) * 0.55, 36 + Math.sin(angle) * 4.6)
    scene.add(sphere)
  }
  const tideLight = new THREE.PointLight(0x77cfe2, 27, 45, 1.55)
  tideLight.position.set(42, 6, 36)
  scene.add(tideLight)
}

function addConnections(scene: THREE.Scene, materials: MaterialSet): void {
  addRoom(scene, materials, {
    x: 0,
    z: 18.5,
    width: 7,
    depth: 3,
    height: 6.7,
    wall: materials.slate,
    openings: {
      north: [{ center: 0, width: 6 }],
      south: [{ center: 0, width: 6 }],
    },
  })
  addArch(scene, materials.paleStone, 0, 4.5, 19.7, 6.2, Math.PI)
  addBox(scene, materials.floor, 2.2, 0.12, 8, -9.8, 0.03, 70)
  addBox(scene, materials.floor, 2.2, 0.12, 8, 9.8, 0.03, 69)
  addBox(scene, materials.floor, 8, 0.12, 2.2, -33, 0.03, 51)
  addBox(scene, materials.floor, 8, 0.12, 2.2, 42, 0.03, 51)
  addBox(scene, materials.floor, 3.2, 0.12, 7, -11, 0.03, 109)
  addBox(scene, materials.floor, 3.2, 0.12, 7, 10.5, 0.03, 109)
  addArch(scene, materials.violetStone, -10.1, 4.2, 70, 6.5, Math.PI / 2)
  addArch(scene, materials.warmStone, 9.9, 4.2, 69, 6.5, -Math.PI / 2)
  addArch(scene, materials.blueStone, -11, 4.35, 109, 6.2, Math.PI / 2)
  addArch(scene, materials.warmStone, 10.5, 4.35, 109, 6.2, -Math.PI / 2)
}

const labels: RangeLabel[] = [
  {
    name: 'THE SOUTH VESTIBULE',
    kicker: 'LOWER RANGE · LANTERN DOORS',
    contains: (x, z) => Math.abs(x) < 13 && z >= 98,
  },
  {
    name: 'THE WINTER GARDEN',
    kicker: 'WEST HOUSE · GLASS VAULTS',
    contains: (x, z) => x <= -10 && z >= 88,
  },
  {
    name: 'THE LANTERN CONSERVATORY',
    kicker: 'EAST HOUSE · GLASS VAULTS',
    contains: (x, z) => x >= 9 && z >= 88,
  },
  {
    name: 'THE LONG GALLERY',
    kicker: 'SOUTH RANGE · PORTRAIT WALK',
    contains: (x, z) => Math.abs(x) < 10 && z >= 52 && z < 98,
  },
  {
    name: 'THE MOON CLOISTER',
    kicker: 'WEST RANGE · GARDEN COURT',
    contains: (x, z) => x <= -10 && z >= 52 && z < 88,
  },
  {
    name: 'THE SURVEY HALL',
    kicker: 'EAST RANGE · LOWER TABLES',
    contains: (x, z) => x >= 9 && z >= 52 && z < 88,
  },
  {
    name: "THE FOUNDERS' COURT",
    kicker: 'SOUTH RANGE · VAULTED WALK',
    contains: (x, z) => Math.abs(x) < 27 && z >= 20 && z < 52,
  },
  {
    name: 'THE QUIET UNDERCROFT',
    kicker: 'WEST RANGE · BELOW THE BELLS',
    contains: (x, z) => x <= -27 && z >= 20 && z < 52,
  },
  {
    name: 'THE CHAMBER OF TIDES',
    kicker: 'EAST RANGE · WATER TABLE',
    contains: (x, z) => x >= 27 && z >= 20 && z < 52,
  },
  {
    name: 'THE CROSSED STAIR',
    kicker: 'INNER KEEP · GRAND LANDING',
    contains: (x, z) => Math.abs(x) < 12 && z > -58 && z < -36,
  },
]

function intersects(x: number, z: number, radius = 0.42): boolean {
  for (const collider of colliders) {
    const closestX = Math.max(collider.minX, Math.min(x, collider.maxX))
    const closestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ))
    const dx = x - closestX
    const dz = z - closestZ
    if (dx * dx + dz * dz < radius * radius) return true
  }
  return false
}

function installPositionHook(camera: THREE.PerspectiveCamera): void {
  if (copyHookInstalled) return
  copyHookInstalled = true
  lastSafeX = camera.position.x
  lastSafeZ = camera.position.z
  const position = camera.position
  const originalCopy = position.copy.bind(position)
  position.copy = ((source: THREE.Vector3Like) => {
    const nextX = source.x
    const nextZ = source.z
    if (!intersects(nextX, nextZ)) {
      lastSafeX = nextX
      lastSafeZ = nextZ
    } else if (!intersects(nextX, lastSafeZ)) {
      source.z = lastSafeZ
      lastSafeX = nextX
    } else if (!intersects(lastSafeX, nextZ)) {
      source.x = lastSafeX
      lastSafeZ = nextZ
    } else {
      source.x = lastSafeX
      source.z = lastSafeZ
    }
    return originalCopy(source)
  }) as typeof position.copy
}

function updateRangeLabel(camera: THREE.PerspectiveCamera): void {
  const label = labels.find((candidate) => candidate.contains(camera.position.x, camera.position.z))
  if (!label) return
  const name = document.getElementById('place-name')
  const kicker = document.getElementById('place-kicker')
  if (name && name.textContent !== label.name) name.textContent = label.name
  if (kicker && kicker.textContent !== label.kicker) kicker.textContent = label.kicker
}

function build(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
  const materials = createMaterials()
  addFixedCrossedStair(scene, materials)
  addFoundersCourt(scene, materials)
  addLongGallery(scene, materials)
  addMoonCloister(scene, materials)
  addSurveyHall(scene, materials)
  addSouthVestibule(scene, materials)
  addWinterGarden(scene, materials)
  addLanternConservatory(scene, materials)
  addSideRanges(scene, materials)
  addConnections(scene, materials)
  installPositionHook(camera)
}

type RenderFunction = (
  this: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
) => void

const prototype = THREE.WebGLRenderer.prototype as unknown as { render: RenderFunction }
const originalRender = prototype.render
prototype.render = function render(scene, camera): void {
  if (!built && scene instanceof THREE.Scene && camera instanceof THREE.PerspectiveCamera) {
    build(scene, camera)
    built = true
  }
  if (built && camera instanceof THREE.PerspectiveCamera) updateRangeLabel(camera)
  originalRender.call(this, scene, camera)
}
