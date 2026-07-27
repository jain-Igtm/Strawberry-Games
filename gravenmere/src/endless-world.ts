import * as THREE from 'three'
import type { RectCollider } from './math'
import type { Region } from './world'
import { flatSurface, rampSurface, type FloorSurface } from './vertical'

export interface EndlessWorldData {
  colliders: RectCollider[]
  surfaces: FloorSurface[]
  containsPosition: (x: number, z: number) => boolean
  getRegion: (x: number, z: number) => Region | null
  update: (position: THREE.Vector3, elapsed: number) => void
}

type Theme = 'stone' | 'beige' | 'bridge' | 'fallout' | 'vast' | 'threshold'

type Atmosphere = {
  name: string
  sky: number
  fog: number
  hemiSky: number
  hemiGround: number
  sun: number
}

const REALM_X = 190
const SEGMENT_SPACING = 36
const SEGMENT_LENGTH = 28
const SEGMENTS = 8
const SCHOOL_PORTAL = new THREE.Vector3(31, 7.1, 78.4)

const atmospheres: readonly Atmosphere[] = [
  { name: 'ASHEN SUNSET', sky: 0x875443, fog: 0x5f433b, hemiSky: 0xf2b48a, hemiGround: 0x29221f, sun: 0xffc28c },
  { name: 'WINTER DAWN', sky: 0x92a5b1, fog: 0x66747d, hemiSky: 0xd9e7ed, hemiGround: 0x343b3f, sun: 0xffe0b0 },
  { name: 'BLUE HOUR', sky: 0x4e6175, fog: 0x354553, hemiSky: 0x9db9d7, hemiGround: 0x202832, sun: 0xe7cba7 },
  { name: 'FALLOUT NOON', sky: 0x9a9275, fog: 0x6a6654, hemiSky: 0xd8c994, hemiGround: 0x38362d, sun: 0xf1d27e },
  { name: 'STORM AFTERGLOW', sky: 0x6f625e, fog: 0x4a4544, hemiSky: 0xd1a990, hemiGround: 0x292629, sun: 0xf0ad7c },
] as const

function randomFactory(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function realmSeed(index: number) {
  return (index * 2654435761 + 73129) >>> 0
}

function box(
  parent: THREE.Object3D,
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function addCollider(
  target: RectCollider[],
  x: number,
  z: number,
  width: number,
  depth: number,
  minY: number,
  maxY: number,
) {
  target.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    minY,
    maxY,
    enabled: true,
  })
}

function materials() {
  return {
    stone: new THREE.MeshLambertMaterial({ color: 0x626a66 }),
    darkStone: new THREE.MeshLambertMaterial({ color: 0x303735 }),
    beige: new THREE.MeshLambertMaterial({ color: 0xb5a58b }),
    beigeDark: new THREE.MeshLambertMaterial({ color: 0x756d61 }),
    concrete: new THREE.MeshLambertMaterial({ color: 0x77786f }),
    concreteDark: new THREE.MeshLambertMaterial({ color: 0x41443f }),
    rust: new THREE.MeshLambertMaterial({ color: 0x704c39 }),
    bridge: new THREE.MeshLambertMaterial({ color: 0x515b59 }),
    metal: new THREE.MeshLambertMaterial({ color: 0x303b3b }),
    light: new THREE.MeshBasicMaterial({ color: 0xffe4b4 }),
    portal: new THREE.MeshBasicMaterial({ color: 0xbcd8ff, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false }),
    black: new THREE.MeshBasicMaterial({ color: 0x07090a }),
  }
}

type Mats = ReturnType<typeof materials>

function addPortal(parent: THREE.Object3D, m: Mats, x: number, y: number, z: number, warm = false) {
  const frame = warm ? m.beigeDark : m.darkStone
  box(parent, frame, 0.65, 5.8, 0.65, x - 2.3, y + 2.9, z)
  box(parent, frame, 0.65, 5.8, 0.65, x + 2.3, y + 2.9, z)
  box(parent, frame, 5.2, 0.65, 0.65, x, y + 5.65, z)
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 5.05), m.portal)
  veil.position.set(x, y + 2.65, z)
  parent.add(veil)
}

function addFlatDeck(
  group: THREE.Group,
  m: Mats,
  colliders: RectCollider[],
  surfaces: FloorSurface[],
  x: number,
  z: number,
  y: number,
  width: number,
  depth: number,
  material: THREE.Material,
) {
  box(group, material, width, 0.38, depth, x, y - 0.19, z)
  surfaces.push(flatSurface(x, z, width, depth, y, 2))
  return { x, z, y, width, depth }
}

function addStoneRange(
  group: THREE.Group,
  m: Mats,
  colliders: RectCollider[],
  surfaces: FloorSurface[],
  x: number,
  y: number,
  width: number,
) {
  const depth = 18
  addFlatDeck(group, m, colliders, surfaces, x, 0, y, width, depth, m.stone)
  box(group, m.darkStone, width, 0.35, depth, x, y + 8.4, 0)
  for (const z of [-depth / 2, depth / 2]) {
    box(group, m.stone, width, 8.4, 0.55, x, y + 4.2, z)
    addCollider(colliders, x, z, width, 0.55, y, y + 8.4)
  }
  for (let offset = -width / 2 + 3.5; offset < width / 2; offset += 7) {
    for (const z of [-7.2, 7.2]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 7.7, 8), m.darkStone)
      column.position.set(x + offset, y + 3.85, z)
      group.add(column)
      addCollider(colliders, x + offset, z, 1.1, 1.1, y, y + 7.7)
    }
  }
}

function addBeigeHall(
  group: THREE.Group,
  m: Mats,
  colliders: RectCollider[],
  surfaces: FloorSurface[],
  x: number,
  y: number,
  width: number,
) {
  const depth = 12
  addFlatDeck(group, m, colliders, surfaces, x, 0, y, width, depth, m.beige)
  box(group, m.beigeDark, width, 0.3, depth, x, y + 4.8, 0)
  for (const z of [-depth / 2, depth / 2]) {
    box(group, m.beige, width, 4.8, 0.35, x, y + 2.4, z)
    addCollider(colliders, x, z, width, 0.35, y, y + 4.8)
  }
  for (let offset = -width / 2 + 3; offset < width / 2 - 1; offset += 6) {
    box(group, m.light, 2.8, 0.05, 0.8, x + offset, y + 4.61, 0)
    if (Math.round(offset) % 2 === 0) {
      box(group, m.beigeDark, 0.28, 2.2, 2.8, x + offset, y + 1.1, -4.45)
    }
  }
}

function addBridgeVoid(
  group: THREE.Group,
  m: Mats,
  colliders: RectCollider[],
  surfaces: FloorSurface[],
  x: number,
  y: number,
  width: number,
  random: () => number,
) {
  const bridgeDepth = random() > 0.45 ? 2.3 : 3.6
  addFlatDeck(group, m, colliders, surfaces, x, 0, y, width, bridgeDepth, m.bridge)
  for (let index = 0; index < 9; index += 1) {
    const z = (random() > 0.5 ? 1 : -1) * (9 + random() * 28)
    const px = x - width / 2 + random() * width
    const py = y - 14 + random() * 23
    box(group, m.darkStone, 5 + random() * 12, 0.5, 3 + random() * 7, px, py, z)
    box(group, m.darkStone, 0.7, 24 + random() * 35, 0.7, px, py - 12, z)
  }
  if (bridgeDepth > 3) {
    for (const z of [-bridgeDepth / 2 - 0.18, bridgeDepth / 2 + 0.18]) {
      box(group, m.metal, width, 0.13, 0.13, x, y + 1.05, z)
    }
  }
}

function addFalloutGallery(
  group: THREE.Group,
  m: Mats,
  colliders: RectCollider[],
  surfaces: FloorSurface[],
  x: number,
  y: number,
  width: number,
  random: () => number,
) {
  const depth = 17
  addFlatDeck(group, m, colliders, surfaces, x, 0, y, width, depth, m.concrete)
  for (const z of [-depth / 2, depth / 2]) {
    for (let section = 0; section < 4; section += 1) {
      if (random() < 0.28) continue
      const sectionWidth = width / 4 - 0.6
      const sx = x - width / 2 + sectionWidth / 2 + section * (width / 4)
      box(group, section % 2 ? m.concrete : m.rust, sectionWidth, 5.8, 0.5, sx, y + 2.9, z)
      addCollider(colliders, sx, z, sectionWidth, 0.5, y, y + 5.8)
    }
  }
  for (let section = 0; section < 6; section += 1) {
    if (section % 3 === 1) continue
    box(group, m.concreteDark, width / 6 - 0.5, 0.32, depth, x - width / 2 + width / 12 + section * (width / 6), y + 6.2, 0)
  }
}

function addVastRoom(
  group: THREE.Group,
  m: Mats,
  colliders: RectCollider[],
  surfaces: FloorSurface[],
  x: number,
  y: number,
  width: number,
  random: () => number,
) {
  const depth = 34
  const centralDepth = 5.2
  addFlatDeck(group, m, colliders, surfaces, x, 0, y, width, centralDepth, m.stone)
  for (const z of [-depth / 2, depth / 2]) {
    box(group, m.darkStone, width, 18, 0.65, x, y + 2, z)
    addCollider(colliders, x, z, width, 0.65, y - 8, y + 11)
  }
  for (let index = 0; index < 5; index += 1) {
    const z = index % 2 ? -10 - random() * 5 : 10 + random() * 5
    const py = y + (index - 2) * 4.2
    box(group, m.bridge, width * (0.35 + random() * 0.35), 0.35, 2.1, x + (random() - 0.5) * 8, py, z)
  }
  for (const offset of [-width / 2 + 2, width / 2 - 2]) {
    box(group, m.darkStone, 1.2, 28, 1.2, x + offset, y - 4, 0)
  }
}

function addThresholdRoom(
  group: THREE.Group,
  m: Mats,
  colliders: RectCollider[],
  surfaces: FloorSurface[],
  x: number,
  y: number,
  width: number,
) {
  addFlatDeck(group, m, colliders, surfaces, x, 0, y, width, 16, m.black)
  for (const z of [-8, 8]) {
    box(group, m.darkStone, width, 7, 0.5, x, y + 3.5, z)
    addCollider(colliders, x, z, width, 0.5, y, y + 7)
  }
  addPortal(group, m, x + width / 2 - 3.2, y, 0)
  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(42, 20), m.portal)
  horizon.position.set(x + width / 2 + 4, y + 6, -0.4)
  horizon.rotation.y = -Math.PI / 2
  group.add(horizon)
}

function addConnection(
  group: THREE.Group,
  m: Mats,
  surfaces: FloorSurface[],
  fromX: number,
  toX: number,
  fromY: number,
  toY: number,
  depth: number,
) {
  const width = toX - fromX
  const centerX = (fromX + toX) / 2
  const centerY = (fromY + toY) / 2 - 0.17
  const deck = box(group, m.bridge, Math.hypot(width, toY - fromY), 0.34, depth, centerX, centerY, 0)
  deck.rotation.z = Math.atan2(toY - fromY, width)
  surfaces.push(rampSurface(centerX, 0, width, depth, fromY, toY, 'x', 1, 20))
}

function themeName(theme: Theme) {
  if (theme === 'stone') return 'THE OLD STONE RANGE'
  if (theme === 'beige') return 'THE BEIGE PASSAGE'
  if (theme === 'bridge') return 'THE NARROW SKY BRIDGE'
  if (theme === 'fallout') return 'THE ASH GALLERY'
  if (theme === 'vast') return 'THE UNMEASURED CHAMBER'
  return 'THE OTHER HORIZON'
}

export function createEndlessWorld(scene: THREE.Scene): EndlessWorldData {
  const m = materials()
  const permanent = new THREE.Group()
  scene.add(permanent)
  addPortal(permanent, m, SCHOOL_PORTAL.x, SCHOOL_PORTAL.y, SCHOOL_PORTAL.z, true)
  box(permanent, m.beigeDark, 8.4, 0.34, 3.4, SCHOOL_PORTAL.x, SCHOOL_PORTAL.y - 0.17, SCHOOL_PORTAL.z - 0.5)

  const permanentSurfaces = [flatSurface(SCHOOL_PORTAL.x, SCHOOL_PORTAL.z - 0.5, 8.4, 3.4, SCHOOL_PORTAL.y, 30)]
  const colliders: RectCollider[] = []
  const surfaces: FloorSurface[] = [...permanentSurfaces]
  const regions: Region[] = []
  let realmGroup: THREE.Group | null = null
  let realmIndex = 0
  let inRealm = false
  let cooldownUntil = 0
  let startY = 12
  let endPortal = new THREE.Vector3()
  let returnPortal = new THREE.Vector3()
  const baseBackground = scene.background instanceof THREE.Color ? scene.background.clone() : new THREE.Color(0x121918)
  const baseFog = scene.fog instanceof THREE.FogExp2 ? scene.fog.clone() : new THREE.FogExp2(0x18211f, 0.0095)

  const clearRealm = () => {
    if (!realmGroup) return
    scene.remove(realmGroup)
    realmGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose()
    })
    realmGroup = null
  }

  const restoreSchool = () => {
    scene.background = baseBackground.clone()
    scene.fog = baseFog.clone()
  }

  const buildRealm = (index: number) => {
    clearRealm()
    colliders.length = 0
    surfaces.splice(0, surfaces.length, ...permanentSurfaces)
    regions.length = 0
    realmIndex = index
    const random = randomFactory(realmSeed(index))
    const atmosphere = atmospheres[index % atmospheres.length]
    scene.background = new THREE.Color(atmosphere.sky)
    scene.fog = new THREE.FogExp2(atmosphere.fog, 0.0045)

    const group = new THREE.Group()
    realmGroup = group
    scene.add(group)
    const hemi = new THREE.HemisphereLight(atmosphere.hemiSky, atmosphere.hemiGround, 2.4)
    group.add(hemi)
    const sun = new THREE.DirectionalLight(atmosphere.sun, 1.35)
    sun.position.set(-20, 45, 18)
    group.add(sun)

    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: atmosphere.sun }))
    sunDisc.position.set(REALM_X + 120, 48, -90)
    sunDisc.rotation.y = Math.PI
    group.add(sunDisc)

    startY = 10 + Math.floor(random() * 3) * 2
    const heights: number[] = [startY]
    for (let i = 1; i < SEGMENTS; i += 1) {
      const move = random() < 0.34 ? -4 : random() < 0.68 ? 0 : 4
      heights.push(Math.max(6, Math.min(26, heights[i - 1] + move)))
    }

    const themes: Theme[] = []
    const choices: Theme[] = ['stone', 'beige', 'bridge', 'fallout', 'vast']
    for (let i = 0; i < SEGMENTS; i += 1) {
      themes.push(i === SEGMENTS - 1 ? 'threshold' : choices[Math.floor(random() * choices.length)])
    }

    for (let i = 0; i < SEGMENTS; i += 1) {
      const x = REALM_X + i * SEGMENT_SPACING
      const y = heights[i]
      const width = SEGMENT_LENGTH + (random() > 0.74 ? 6 : 0)
      const theme = themes[i]
      if (theme === 'stone') addStoneRange(group, m, colliders, surfaces, x, y, width)
      else if (theme === 'beige') addBeigeHall(group, m, colliders, surfaces, x, y, width)
      else if (theme === 'bridge') addBridgeVoid(group, m, colliders, surfaces, x, y, width, random)
      else if (theme === 'fallout') addFalloutGallery(group, m, colliders, surfaces, x, y, width, random)
      else if (theme === 'vast') addVastRoom(group, m, colliders, surfaces, x, y, width, random)
      else addThresholdRoom(group, m, colliders, surfaces, x, y, width)

      regions.push({
        name: themeName(theme),
        kicker: `THE ENDLESS RANGES · ${atmosphere.name}`,
        contains: (px, pz) => Math.abs(px - x) <= width / 2 && Math.abs(pz) <= 24,
      })

      if (i < SEGMENTS - 1) {
        const fromX = x + width / 2 - 0.5
        const nextWidth = SEGMENT_LENGTH
        const toX = REALM_X + (i + 1) * SEGMENT_SPACING - nextWidth / 2 + 0.5
        addConnection(group, m, surfaces, fromX, toX, y, heights[i + 1], themes[i] === 'bridge' ? 2.3 : 3.8)
      }
    }

    returnPortal.set(REALM_X - SEGMENT_LENGTH / 2 + 2.2, startY, 0)
    addPortal(group, m, returnPortal.x, returnPortal.y, returnPortal.z, true)
    const endX = REALM_X + (SEGMENTS - 1) * SEGMENT_SPACING + SEGMENT_LENGTH / 2 - 3.2
    endPortal.set(endX, heights[SEGMENTS - 1], 0)
  }

  const teleportToRealm = (position: THREE.Vector3) => {
    if (realmIndex === 0) buildRealm(1)
    inRealm = true
    position.set(REALM_X - SEGMENT_LENGTH / 2 + 5.2, startY, 0)
  }

  return {
    colliders,
    surfaces,
    containsPosition: (x, z) => x > 145 && Math.abs(z) < 80,
    getRegion: (x, z) => regions.find((region) => region.contains(x, z)) ?? null,
    update: (position, elapsed) => {
      if (elapsed < cooldownUntil) return
      if (!inRealm) {
        if (position.y > 5.8 && Math.hypot(position.x - SCHOOL_PORTAL.x, position.z - SCHOOL_PORTAL.z) < 1.35) {
          teleportToRealm(position)
          cooldownUntil = elapsed + 1.5
        }
        return
      }

      if (position.y < -28) {
        position.set(REALM_X - SEGMENT_LENGTH / 2 + 5.2, startY, 0)
        cooldownUntil = elapsed + 1.2
        return
      }

      if (realmIndex === 1 && Math.hypot(position.x - returnPortal.x, position.z - returnPortal.z) < 1.2) {
        inRealm = false
        restoreSchool()
        position.set(SCHOOL_PORTAL.x, SCHOOL_PORTAL.y, SCHOOL_PORTAL.z - 2.2)
        cooldownUntil = elapsed + 1.5
        return
      }

      if (Math.hypot(position.x - endPortal.x, position.z - endPortal.z) < 1.45) {
        buildRealm(realmIndex + 1)
        inRealm = true
        position.set(REALM_X - SEGMENT_LENGTH / 2 + 5.2, startY, 0)
        cooldownUntil = elapsed + 1.5
      }
    },
  }
}
