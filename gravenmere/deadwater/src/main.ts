import * as THREE from 'three'
import { App } from '@capacitor/app'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { StatusBar } from '@capacitor/status-bar'
import {
  pointsForHit,
  reserveAmmoAfterWave,
  spawnIntervalForWave,
  tuningForWave,
  zombiesForWave,
} from './game-rules'
import './styles.css'

type Collider = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

type Zombie = {
  group: THREE.Group
  parts: THREE.Mesh[]
  head: THREE.Mesh
  health: number
  maxHealth: number
  speed: number
  damage: number
  attackDelay: number
  attackTimer: number
  phase: number
  flashTimer: number
  dead: boolean
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing #${id}`)
  return element as T
}

const ui = {
  canvas: requireElement<HTMLCanvasElement>('world'),
  startScreen: requireElement<HTMLElement>('start-screen'),
  startButton: requireElement<HTMLButtonElement>('start-button'),
  gameOverScreen: requireElement<HTMLElement>('game-over-screen'),
  restartButton: requireElement<HTMLButtonElement>('restart-button'),
  finalScore: requireElement<HTMLElement>('final-score'),
  hud: requireElement<HTMLElement>('hud'),
  district: requireElement<HTMLElement>('district-name'),
  wave: requireElement<HTMLElement>('wave-number'),
  waveBanner: requireElement<HTMLElement>('wave-banner'),
  waveBannerKicker: requireElement<HTMLElement>('wave-banner-kicker'),
  waveBannerCopy: requireElement<HTMLElement>('wave-banner-copy'),
  healthFill: requireElement<HTMLElement>('health-fill'),
  healthValue: requireElement<HTMLElement>('health-value'),
  killCount: requireElement<HTMLElement>('kill-count'),
  scoreCount: requireElement<HTMLElement>('score-count'),
  ammoCount: requireElement<HTMLElement>('ammo-count'),
  reserveCount: requireElement<HTMLElement>('reserve-count'),
  ammoPanel: document.querySelector<HTMLElement>('.ammo-panel')!,
  hitMarker: requireElement<HTMLElement>('hit-marker'),
  damageVignette: requireElement<HTMLElement>('damage-vignette'),
  toast: requireElement<HTMLElement>('toast'),
  joystick: requireElement<HTMLElement>('joystick'),
  joystickKnob: requireElement<HTMLElement>('joystick-knob'),
  lookPad: requireElement<HTMLElement>('look-pad'),
  sprintButton: requireElement<HTMLButtonElement>('sprint-button'),
  reloadButton: requireElement<HTMLButtonElement>('reload-button'),
  fireButton: requireElement<HTMLButtonElement>('fire-button'),
}

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x170c09)
scene.fog = new THREE.FogExp2(0x2a130d, 0.0125)

const camera = new THREE.PerspectiveCamera(69, innerWidth / innerHeight, 0.06, 190)
camera.rotation.order = 'YXZ'
scene.add(camera)

const renderer = new THREE.WebGLRenderer({
  canvas: ui.canvas,
  antialias: !isTouch,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.15 : 1.55))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.92

const clock = new THREE.Clock()
const raycaster = new THREE.Raycaster()
raycaster.far = 80
const colliders: Collider[] = []
const shotTargets: THREE.Object3D[] = []
const zombies: Zombie[] = []
const animatedFires: Array<{ flame: THREE.Mesh; glow: THREE.PointLight; phase: number }> = []
const spawnPoints: THREE.Vector3[] = []
const keys = new Set<string>()

const player = {
  position: new THREE.Vector3(0, 1.7, 15),
  yaw: Math.PI,
  pitch: -0.03,
  radius: 0.5,
  walkSpeed: 5.35,
  sprintSpeed: 8.15,
  bob: 0,
  moving: false,
}

const state = {
  started: false,
  paused: false,
  gameOver: false,
  wave: 1,
  waveActive: false,
  intermission: 0,
  pendingSpawns: 0,
  spawnTimer: 0,
  health: 100,
  ammo: 30,
  reserve: 180,
  reloading: false,
  reloadTimer: 0,
  fireHeld: false,
  fireCooldown: 0,
  muzzleTimer: 0,
  recoil: 0,
  kills: 0,
  score: 0,
  bannerTimer: 0,
  hitTimer: 0,
  damageTimer: 0,
  toastTimer: 0,
}

const mats = {
  island: new THREE.MeshStandardMaterial({ color: 0x32241c, roughness: 1 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x45413b, roughness: 0.96 }),
  cracked: new THREE.MeshStandardMaterial({ color: 0x292823, roughness: 1 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x6f2f20, roughness: 0.9, metalness: 0.42 }),
  darkRust: new THREE.MeshStandardMaterial({ color: 0x351b17, roughness: 0.92, metalness: 0.55 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x3d4140, roughness: 0.63, metalness: 0.72 }),
  blackMetal: new THREE.MeshStandardMaterial({ color: 0x171818, roughness: 0.68, metalness: 0.75 }),
  warning: new THREE.MeshStandardMaterial({ color: 0x9a5a22, roughness: 0.85, metalness: 0.2 }),
  water: new THREE.MeshStandardMaterial({ color: 0x101a1c, roughness: 0.3, metalness: 0.18, transparent: true, opacity: 0.92 }),
  ember: new THREE.MeshBasicMaterial({ color: 0xff6b28, transparent: true, opacity: 0.88 }),
  zombieSkin: new THREE.MeshStandardMaterial({ color: 0x70695a, roughness: 1 }),
  zombieCloth: new THREE.MeshStandardMaterial({ color: 0x292c29, roughness: 1 }),
  zombieClothAlt: new THREE.MeshStandardMaterial({ color: 0x4a2720, roughness: 1 }),
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
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
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  )
  mesh.position.set(x, y, z)
  return mesh
}

function addCollider(x: number, z: number, width: number, depth: number, padding = 0.25): void {
  colliders.push({
    minX: x - width / 2 - padding,
    maxX: x + width / 2 + padding,
    minZ: z - depth / 2 - padding,
    maxZ: z + depth / 2 + padding,
  })
}

function addBlocker(mesh: THREE.Mesh, collider?: { x: number; z: number; width: number; depth: number }): void {
  scene.add(mesh)
  mesh.userData.blocksShot = true
  shotTargets.push(mesh)
  if (collider) addCollider(collider.x, collider.z, collider.width, collider.depth)
}

function makeSign(text: string): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')!
  context.fillStyle = '#25120e'
  context.fillRect(0, 0, 512, 128)
  context.strokeStyle = '#9f4829'
  context.lineWidth = 10
  context.strokeRect(7, 7, 498, 114)
  context.fillStyle = '#e3c6a4'
  context.font = '900 48px ui-monospace, monospace'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 256, 66)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 })
}

function addWarehouse(x: number, z: number): void {
  const shell = box(15, 6.5, 20, mats.darkRust, x, 3.25, z)
  addBlocker(shell, { x, z, width: 15, depth: 20 })
  const roof = box(16, 0.45, 21, mats.blackMetal, x, 6.65, z)
  scene.add(roof)
  for (const offset of [-5, 0, 5]) {
    const rib = box(0.32, 6.7, 20.4, mats.metal, x + offset, 3.35, z)
    scene.add(rib)
  }
  const sign = box(8.5, 1.7, 0.18, makeSign('WAREHOUSE 04'), x, 4.4, z - 10.15)
  scene.add(sign)
}

function addTank(x: number, z: number, radius = 4.2, height = 8): void {
  const tank = cylinder(radius, radius, height, 18, mats.metal, x, height / 2, z)
  tank.userData.blocksShot = true
  scene.add(tank)
  shotTargets.push(tank)
  addCollider(x, z, radius * 1.75, radius * 1.75)
  const cap = cylinder(radius + 0.08, radius + 0.08, 0.35, 18, mats.rust, x, height + 0.1, z)
  scene.add(cap)
  for (let y = 1.3; y < height; y += 1.7) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.08, 0.12, 6, 24), mats.darkRust)
    band.rotation.x = Math.PI / 2
    band.position.set(x, y, z)
    scene.add(band)
  }
}

function addContainer(x: number, z: number, rotation = 0, color = mats.rust): void {
  const container = box(6.4, 2.7, 2.7, color, x, 1.35, z)
  container.rotation.y = rotation
  scene.add(container)
  container.userData.blocksShot = true
  shotTargets.push(container)
  const axisSwap = Math.abs(Math.sin(rotation)) > 0.5
  addCollider(x, z, axisSwap ? 2.7 : 6.4, axisSwap ? 6.4 : 2.7, 0.12)
  for (let i = -2.5; i <= 2.5; i += 1) {
    const rib = box(0.08, 2.45, 2.76, mats.darkRust, 0, 0, 0)
    rib.position.set(x + Math.cos(rotation) * i, 1.35, z - Math.sin(rotation) * i)
    rib.rotation.y = rotation
    scene.add(rib)
  }
}

function addPipeRun(x: number, z: number, length: number, rotation = 0): void {
  const pipe = cylinder(0.34, 0.34, length, 10, mats.rust, x, 4.8, z)
  pipe.rotation.z = Math.PI / 2
  pipe.rotation.y = rotation
  scene.add(pipe)
  const span = length / 2 - 1
  for (const side of [-span, span]) {
    const support = box(0.32, 4.6, 0.32, mats.blackMetal, x + Math.cos(rotation) * side, 2.3, z - Math.sin(rotation) * side)
    scene.add(support)
  }
}

function addFire(x: number, z: number, large = false): void {
  const barrel = cylinder(0.55, 0.55, 1.25, 12, mats.darkRust, x, 0.62, z)
  scene.add(barrel)
  const flameMaterial = mats.ember.clone()
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(large ? 0.8 : 0.46, large ? 2.1 : 1.25, 9),
    flameMaterial,
  )
  flame.position.set(x, large ? 1.85 : 1.28, z)
  scene.add(flame)
  const glow = new THREE.PointLight(0xff5e25, large ? 10 : 5, large ? 16 : 9, 2)
  glow.position.set(x, large ? 2.3 : 1.7, z)
  scene.add(glow)
  animatedFires.push({ flame, glow, phase: Math.random() * Math.PI * 2 })
}

function buildIsland(): void {
  const hemi = new THREE.HemisphereLight(0x713d2d, 0x120b09, 1.65)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xff7950, 2.25)
  sun.position.set(-24, 42, 18)
  scene.add(sun)
  const horizon = new THREE.DirectionalLight(0x6c8192, 0.5)
  horizon.position.set(40, 15, -50)
  scene.add(horizon)

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(160, 24, 12),
    new THREE.MeshBasicMaterial({ color: 0x2b120d, side: THREE.BackSide }),
  )
  scene.add(sky)

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(330, 330), mats.water)
  ocean.rotation.x = -Math.PI / 2
  ocean.position.y = -0.9
  scene.add(ocean)

  const island = cylinder(58, 64, 2.2, 28, mats.island, 0, -1.05, 0)
  scene.add(island)

  const central = cylinder(21, 21, 0.18, 24, mats.concrete, 0, 0.04, 0)
  scene.add(central)
  const roadNorth = box(12, 0.16, 72, mats.cracked, 0, 0.05, -3)
  const roadEast = box(74, 0.16, 12, mats.cracked, 3, 0.06, 0)
  scene.add(roadNorth, roadEast)

  const diagonalA = box(10, 0.15, 58, mats.concrete, -1, 0.055, 0)
  diagonalA.rotation.y = Math.PI / 4
  scene.add(diagonalA)
  const diagonalB = box(10, 0.15, 58, mats.concrete, 1, 0.055, 0)
  diagonalB.rotation.y = -Math.PI / 4
  scene.add(diagonalB)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(39, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x34302b, roughness: 1, side: THREE.DoubleSide }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.065
  scene.add(ring)

  addWarehouse(26, -8)
  addBlocker(box(11, 5.3, 12, mats.rust, -22, 2.65, 24), { x: -22, z: 24, width: 11, depth: 12 })
  scene.add(box(12, 0.4, 13, mats.blackMetal, -22, 5.45, 24))
  const turbineSign = box(7.8, 1.5, 0.18, makeSign('TURBINE HALL'), -22, 3.6, 17.9)
  scene.add(turbineSign)

  addTank(-26, -20, 4.4, 8.6)
  addTank(-39, -10, 3.7, 7.2)
  addTank(-34, -29, 3.2, 6.3)
  addPipeRun(-27, -6, 18, 0)
  addPipeRun(-16, -22, 15, Math.PI / 2)

  addContainer(27, 24, 0)
  addContainer(34, 19, Math.PI / 2, mats.warning)
  addContainer(38, 29, 0, mats.darkRust)
  addContainer(17, 33, Math.PI / 2, mats.metal)
  addContainer(31, 35, 0, mats.warning)

  const craneBase = box(3, 3, 3, mats.blackMetal, 44, 1.5, 5)
  addBlocker(craneBase, { x: 44, z: 5, width: 3, depth: 3 })
  const craneMast = box(1.2, 18, 1.2, mats.rust, 44, 10.5, 5)
  const craneArm = box(22, 0.8, 0.8, mats.rust, 35, 18.8, 5)
  scene.add(craneMast, craneArm)

  const pumpHouse = box(10, 4.5, 8, mats.darkRust, 0, 2.25, -44)
  addBlocker(pumpHouse, { x: 0, z: -44, width: 10, depth: 8 })
  const pumpSign = box(7, 1.4, 0.16, makeSign('INTAKE'), 0, 3.1, -39.9)
  scene.add(pumpSign)
  const pier = box(8, 0.45, 17, mats.metal, 0, -0.05, -56)
  scene.add(pier)

  for (const [x, z, rotation] of [
    [-8, 8, 0], [9, -7, Math.PI / 2], [-5, -30, 0], [13, 39, Math.PI / 2],
    [-42, 18, 0], [43, -20, Math.PI / 2],
  ] as Array<[number, number, number]>) {
    const barrier = box(5.4, 1.15, 0.65, mats.concrete, x, 0.58, z)
    barrier.rotation.y = rotation
    scene.add(barrier)
    barrier.userData.blocksShot = true
    shotTargets.push(barrier)
    const swap = Math.abs(Math.sin(rotation)) > 0.5
    addCollider(x, z, swap ? 0.65 : 5.4, swap ? 5.4 : 0.65, 0.08)
  }

  addFire(-7, 3)
  addFire(15, -25, true)
  addFire(-35, 12)
  addFire(38, -31, true)
  addFire(8, 42)

  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2
    const radius = i % 2 === 0 ? 51 : 54
    spawnPoints.push(new THREE.Vector3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius))
  }
}

buildIsland()

const emberCount = isTouch ? 130 : 220
const emberPositions = new Float32Array(emberCount * 3)
for (let i = 0; i < emberCount; i += 1) {
  emberPositions[i * 3] = (Math.random() - 0.5) * 120
  emberPositions[i * 3 + 1] = Math.random() * 18
  emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 120
}
const emberGeometry = new THREE.BufferGeometry()
emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3))
const emberCloud = new THREE.Points(
  emberGeometry,
  new THREE.PointsMaterial({ color: 0xff6b32, size: 0.09, transparent: true, opacity: 0.78 }),
)
scene.add(emberCloud)

const ashCount = isTouch ? 100 : 170
const ashPositions = new Float32Array(ashCount * 3)
for (let i = 0; i < ashCount; i += 1) {
  ashPositions[i * 3] = (Math.random() - 0.5) * 125
  ashPositions[i * 3 + 1] = Math.random() * 22
  ashPositions[i * 3 + 2] = (Math.random() - 0.5) * 125
}
const ashGeometry = new THREE.BufferGeometry()
ashGeometry.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3))
const ashCloud = new THREE.Points(
  ashGeometry,
  new THREE.PointsMaterial({ color: 0x9b8b7d, size: 0.065, transparent: true, opacity: 0.5 }),
)
scene.add(ashCloud)

const gun = new THREE.Group()
const gunBody = box(0.18, 0.18, 0.78, mats.blackMetal, 0, 0, 0)
const gunTop = box(0.11, 0.08, 0.5, mats.rust, 0, 0.12, -0.08)
const gunGrip = box(0.13, 0.32, 0.16, mats.darkRust, 0, -0.22, 0.15)
gunGrip.rotation.x = -0.22
const gunBarrel = cylinder(0.035, 0.035, 0.48, 8, mats.metal, 0, 0.01, -0.6)
gunBarrel.rotation.x = Math.PI / 2
const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mats.ember)
muzzle.position.set(0, 0.01, -0.86)
muzzle.visible = false
const muzzleLight = new THREE.PointLight(0xff8b45, 0, 3, 2)
muzzleLight.position.copy(muzzle.position)
gun.add(gunBody, gunTop, gunGrip, gunBarrel, muzzle, muzzleLight)
gun.position.set(0.34, -0.29, -0.62)
camera.add(gun)

function circleHitsCollider(x: number, z: number, radius: number): boolean {
  for (const collider of colliders) {
    const closestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX)
    const closestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ)
    const dx = x - closestX
    const dz = z - closestZ
    if (dx * dx + dz * dz < radius * radius) return true
  }
  return false
}

function insideIsland(x: number, z: number, margin = 0): boolean {
  return x * x + z * z <= (57 - margin) * (57 - margin)
}

function movePlayer(dx: number, dz: number): void {
  const nextX = player.position.x + dx
  if (insideIsland(nextX, player.position.z, player.radius) && !circleHitsCollider(nextX, player.position.z, player.radius)) {
    player.position.x = nextX
  }
  const nextZ = player.position.z + dz
  if (insideIsland(player.position.x, nextZ, player.radius) && !circleHitsCollider(player.position.x, nextZ, player.radius)) {
    player.position.z = nextZ
  }
}

function moveZombie(zombie: Zombie, dx: number, dz: number): void {
  const radius = 0.44
  const nextX = zombie.group.position.x + dx
  if (insideIsland(nextX, zombie.group.position.z, radius) && !circleHitsCollider(nextX, zombie.group.position.z, radius)) {
    zombie.group.position.x = nextX
  }
  const nextZ = zombie.group.position.z + dz
  if (insideIsland(zombie.group.position.x, nextZ, radius) && !circleHitsCollider(zombie.group.position.x, nextZ, radius)) {
    zombie.group.position.z = nextZ
  }
}

function createZombie(position: THREE.Vector3): Zombie {
  const tuning = tuningForWave(state.wave)
  const group = new THREE.Group()
  const scale = 0.9 + Math.random() * 0.22
  group.position.copy(position)
  group.scale.setScalar(scale)

  const skin = mats.zombieSkin.clone()
  skin.color.offsetHSL((Math.random() - 0.5) * 0.04, -0.05, (Math.random() - 0.5) * 0.08)
  const cloth = (Math.random() > 0.45 ? mats.zombieCloth : mats.zombieClothAlt).clone()
  const parts: THREE.Mesh[] = []

  const body = box(0.68, 1.0, 0.4, cloth, 0, 1.18, 0)
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.31, 1), skin)
  head.position.set(0, 1.93, -0.02)
  const jaw = box(0.28, 0.16, 0.25, skin, 0, 1.72, -0.08)
  const leftArm = box(0.22, 0.92, 0.22, skin, -0.49, 1.15, -0.05)
  const rightArm = box(0.22, 0.92, 0.22, skin, 0.49, 1.15, -0.05)
  leftArm.rotation.x = -0.85
  rightArm.rotation.x = -0.85
  const leftLeg = box(0.26, 0.95, 0.28, cloth, -0.2, 0.45, 0)
  const rightLeg = box(0.26, 0.95, 0.28, cloth, 0.2, 0.45, 0)
  group.add(body, head, jaw, leftArm, rightArm, leftLeg, rightLeg)
  parts.push(body, head, jaw, leftArm, rightArm, leftLeg, rightLeg)

  const zombie: Zombie = {
    group,
    parts,
    head,
    health: tuning.health,
    maxHealth: tuning.health,
    speed: tuning.speed * (0.9 + Math.random() * 0.18),
    damage: tuning.damage,
    attackDelay: tuning.attackDelay,
    attackTimer: Math.random() * 0.4,
    phase: Math.random() * Math.PI * 2,
    flashTimer: 0,
    dead: false,
  }

  for (const part of parts) {
    part.userData.zombie = zombie
    part.userData.headshot = part === head
    shotTargets.push(part)
  }
  scene.add(group)
  zombies.push(zombie)
  return zombie
}

function removeZombie(zombie: Zombie): void {
  scene.remove(zombie.group)
  for (const part of zombie.parts) {
    const targetIndex = shotTargets.indexOf(part)
    if (targetIndex >= 0) shotTargets.splice(targetIndex, 1)
    part.geometry.dispose()
    const material = part.material
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
    else material.dispose()
  }
  const zombieIndex = zombies.indexOf(zombie)
  if (zombieIndex >= 0) zombies.splice(zombieIndex, 1)
}

function clearZombies(): void {
  for (const zombie of [...zombies]) removeZombie(zombie)
}

let audioContext: AudioContext | null = null
function ensureAudio(): AudioContext {
  if (!audioContext) audioContext = new AudioContext()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

function noiseBurst(duration: number, volume: number, frequency: number): void {
  const context = ensureAudio()
  const frames = Math.max(1, Math.floor(context.sampleRate * duration))
  const buffer = context.createBuffer(1, frames, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  filter.type = 'lowpass'
  filter.frequency.value = frequency
  gain.gain.setValueAtTime(volume, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)
  source.buffer = buffer
  source.connect(filter).connect(gain).connect(context.destination)
  source.start()
}

function playGunshot(): void {
  const context = ensureAudio()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(105, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(42, context.currentTime + 0.075)
  gain.gain.setValueAtTime(0.14, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.085)
  noiseBurst(0.09, 0.19, 1450)
}

function playEmptyClick(): void {
  const context = ensureAudio()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = 520
  gain.gain.setValueAtTime(0.03, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.025)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.03)
}

function playZombieMoan(distance: number): void {
  if (!audioContext || Math.random() > 0.025) return
  const context = ensureAudio()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sawtooth'
  oscillator.frequency.setValueAtTime(55 + Math.random() * 20, context.currentTime)
  oscillator.frequency.linearRampToValueAtTime(38, context.currentTime + 0.45)
  const volume = THREE.MathUtils.clamp(0.045 * (1 - distance / 34), 0.004, 0.04)
  gain.gain.setValueAtTime(volume, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.52)
}

function showBanner(kicker: string, copy: string, duration = 2.8): void {
  ui.waveBannerKicker.textContent = kicker
  ui.waveBannerCopy.textContent = copy
  ui.waveBanner.classList.add('visible')
  state.bannerTimer = duration
}

function showToast(message: string, duration = 1.2): void {
  ui.toast.textContent = message
  ui.toast.classList.add('visible')
  state.toastTimer = duration
}

function showHit(killed: boolean): void {
  ui.hitMarker.classList.toggle('kill', killed)
  ui.hitMarker.classList.add('visible')
  state.hitTimer = killed ? 0.14 : 0.08
}

function updateHud(): void {
  ui.wave.textContent = String(state.wave)
  ui.healthValue.textContent = String(Math.max(0, Math.ceil(state.health)))
  ui.healthFill.style.width = `${THREE.MathUtils.clamp(state.health, 0, 100)}%`
  ui.killCount.textContent = String(state.kills)
  ui.scoreCount.textContent = String(state.score)
  ui.ammoCount.textContent = String(state.ammo)
  ui.reserveCount.textContent = String(state.reserve)
  ui.ammoPanel.classList.toggle('reloading', state.reloading)
}

function nearestSpawnPoint(): THREE.Vector3 {
  const choices = spawnPoints.filter((point) => point.distanceToSquared(player.position) > 30 * 30)
  const pool = choices.length > 0 ? choices : spawnPoints
  const base = pool[Math.floor(Math.random() * pool.length)]
  const tangent = new THREE.Vector3(-base.z, 0, base.x).normalize().multiplyScalar((Math.random() - 0.5) * 7)
  return base.clone().add(tangent)
}

function startWave(): void {
  state.waveActive = true
  state.pendingSpawns = zombiesForWave(state.wave)
  state.spawnTimer = 0.9
  showBanner(`WAVE ${state.wave}`, state.wave === 1 ? 'THE SHORELINE IS MOVING' : 'THE SIRENS START AGAIN', 3)
  updateHud()
}

function finishWave(): void {
  state.waveActive = false
  state.wave += 1
  state.intermission = 7
  state.health = Math.min(100, state.health + 22)
  state.reserve = reserveAmmoAfterWave(state.reserve, state.wave)
  if (state.ammo < 30) {
    const needed = 30 - state.ammo
    const loaded = Math.min(needed, state.reserve)
    state.ammo += loaded
    state.reserve -= loaded
  }
  showBanner('WAVE CLEARED', `WAVE ${state.wave} IN 7 SECONDS`, 6.8)
  showToast('AMMO AND HEALTH RECOVERED', 2.4)
  updateHud()
}

function beginReload(): void {
  if (state.reloading || state.ammo >= 30 || state.reserve <= 0 || state.gameOver) return
  state.reloading = true
  state.reloadTimer = 1.65
  showToast('RELOADING', 1.2)
  updateHud()
}

function finishReload(): void {
  const needed = 30 - state.ammo
  const amount = Math.min(needed, state.reserve)
  state.ammo += amount
  state.reserve -= amount
  state.reloading = false
  updateHud()
}

function damagePlayer(amount: number): void {
  if (state.gameOver) return
  state.health -= amount
  state.damageTimer = 0.26
  ui.damageVignette.classList.add('visible')
  void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined)
  updateHud()
  if (state.health <= 0) endRun()
}

function fireWeapon(): void {
  if (!state.started || state.gameOver || state.reloading || state.fireCooldown > 0) return
  state.fireCooldown = 0.105
  if (state.ammo <= 0) {
    playEmptyClick()
    beginReload()
    return
  }
  state.ammo -= 1
  state.recoil = Math.min(1, state.recoil + 0.62)
  state.muzzleTimer = 0.045
  muzzle.visible = true
  muzzleLight.intensity = 4.5
  playGunshot()
  if (state.ammo % 4 === 0) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
  const hits = raycaster.intersectObjects(shotTargets, false)
  const hit = hits[0]
  if (hit) {
    const zombie = hit.object.userData.zombie as Zombie | undefined
    if (zombie && !zombie.dead) {
      const headshot = Boolean(hit.object.userData.headshot)
      const baseDamage = 42 + Math.floor((state.wave - 1) / 5) * 4
      const damage = headshot ? baseDamage * 2.05 : baseDamage
      zombie.health -= damage
      zombie.flashTimer = 0.075
      const killed = zombie.health <= 0
      const points = pointsForHit(headshot, killed)
      state.score += points
      showHit(killed)
      if (killed) {
        zombie.dead = true
        state.kills += 1
        zombie.group.rotation.z = (Math.random() - 0.5) * 0.45
        setTimeout(() => {
          if (zombies.includes(zombie)) removeZombie(zombie)
        }, 90)
      }
    }
  }
  updateHud()
}

function endRun(): void {
  state.gameOver = true
  state.fireHeld = false
  state.health = 0
  document.exitPointerLock?.()
  ui.finalScore.textContent = `Wave ${state.wave} · ${state.kills} kills · ${state.score} points`
  ui.gameOverScreen.classList.add('screen--visible')
  ui.gameOverScreen.setAttribute('aria-hidden', 'false')
  showBanner('SIGNAL LOST', 'NO MOVEMENT DETECTED', 2)
  noiseBurst(0.5, 0.12, 280)
  updateHud()
}

function resetRun(): void {
  clearZombies()
  player.position.set(0, 1.7, 15)
  player.yaw = Math.PI
  player.pitch = -0.03
  state.gameOver = false
  state.wave = 1
  state.waveActive = false
  state.intermission = 0
  state.pendingSpawns = 0
  state.spawnTimer = 0
  state.health = 100
  state.ammo = 30
  state.reserve = 180
  state.reloading = false
  state.reloadTimer = 0
  state.fireHeld = false
  state.fireCooldown = 0
  state.kills = 0
  state.score = 0
  ui.gameOverScreen.classList.remove('screen--visible')
  ui.gameOverScreen.setAttribute('aria-hidden', 'true')
  updateHud()
  startWave()
}

function startGame(): void {
  state.started = true
  state.paused = false
  ui.startScreen.classList.remove('screen--visible')
  ui.hud.setAttribute('aria-hidden', 'false')
  ensureAudio()
  void StatusBar.hide().catch(() => undefined)
  resetRun()
  if (!isTouch) void ui.canvas.requestPointerLock?.()
}

function updatePlayer(dt: number): void {
  let forward = 0
  let strafe = 0
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1
  if (keys.has('KeyD')) strafe += 1
  if (keys.has('KeyA')) strafe -= 1
  forward += -touchMove.y
  strafe += touchMove.x
  const length = Math.hypot(forward, strafe)
  if (length > 1) {
    forward /= length
    strafe /= length
  }

  const moving = Math.abs(forward) + Math.abs(strafe) > 0.025
  player.moving = moving
  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight') || sprintHeld
  const speed = sprinting ? player.sprintSpeed : player.walkSpeed
  if (moving) {
    const sin = Math.sin(player.yaw)
    const cos = Math.cos(player.yaw)
    const dx = (sin * forward + cos * strafe) * speed * dt
    const dz = (cos * forward - sin * strafe) * speed * dt
    movePlayer(dx, dz)
    player.bob += dt * (sprinting ? 13.5 : 9.2)
  }

  const bobY = moving ? Math.sin(player.bob) * (sprinting ? 0.055 : 0.035) : 0
  const bobX = moving ? Math.cos(player.bob * 0.5) * 0.018 : 0
  camera.position.set(player.position.x + bobX, player.position.y + bobY, player.position.z)
  camera.rotation.set(player.pitch, player.yaw, 0)

  const gunBobX = moving ? Math.cos(player.bob * 0.5) * 0.018 : 0
  const gunBobY = moving ? Math.abs(Math.sin(player.bob)) * 0.018 : 0
  state.recoil = Math.max(0, state.recoil - dt * 7.8)
  gun.position.set(0.34 + gunBobX, -0.29 - gunBobY - state.recoil * 0.04, -0.62 + state.recoil * 0.08)
  gun.rotation.x = -state.recoil * 0.12

  const x = player.position.x
  const z = player.position.z
  if (z < -35) ui.district.textContent = 'INTAKE SHORE'
  else if (x < -14 && z < 2) ui.district.textContent = 'REFINERY FIELD'
  else if (x > 15 && z < 11) ui.district.textContent = 'WAREHOUSE ROAD'
  else if (x > 13 && z > 12) ui.district.textContent = 'SHIPBREAKER YARD'
  else if (x < -12 && z > 10) ui.district.textContent = 'TURBINE QUARTER'
  else ui.district.textContent = 'CENTRAL YARD'
}

function updateZombies(dt: number, elapsed: number): void {
  for (const zombie of zombies) {
    if (zombie.dead) continue
    zombie.attackTimer -= dt
    zombie.flashTimer = Math.max(0, zombie.flashTimer - dt)
    const delta = new THREE.Vector3(
      player.position.x - zombie.group.position.x,
      0,
      player.position.z - zombie.group.position.z,
    )
    const distance = delta.length()
    playZombieMoan(distance)

    if (distance > 1.22) {
      delta.normalize()
      const separation = new THREE.Vector3()
      for (const other of zombies) {
        if (other === zombie || other.dead) continue
        const dx = zombie.group.position.x - other.group.position.x
        const dz = zombie.group.position.z - other.group.position.z
        const distanceSquared = dx * dx + dz * dz
        if (distanceSquared > 0.001 && distanceSquared < 1.3 * 1.3) {
          separation.x += dx / distanceSquared
          separation.z += dz / distanceSquared
        }
      }
      const sway = Math.sin(elapsed * 1.6 + zombie.phase) * 0.12
      const desiredX = delta.x + separation.x * 0.18 - delta.z * sway
      const desiredZ = delta.z + separation.z * 0.18 + delta.x * sway
      const desiredLength = Math.hypot(desiredX, desiredZ) || 1
      moveZombie(
        zombie,
        (desiredX / desiredLength) * zombie.speed * dt,
        (desiredZ / desiredLength) * zombie.speed * dt,
      )
      zombie.group.lookAt(player.position.x, zombie.group.position.y, player.position.z)
    } else if (zombie.attackTimer <= 0) {
      zombie.attackTimer = zombie.attackDelay
      damagePlayer(zombie.damage)
    }

    const walk = elapsed * zombie.speed * 4.1 + zombie.phase
    zombie.group.position.y = Math.abs(Math.sin(walk)) * 0.035
    const leftArm = zombie.parts[3]
    const rightArm = zombie.parts[4]
    leftArm.rotation.x = -0.85 + Math.sin(walk) * 0.16
    rightArm.rotation.x = -0.85 - Math.sin(walk) * 0.16

    for (const part of zombie.parts) {
      const material = part.material
      if (!Array.isArray(material) && material instanceof THREE.MeshStandardMaterial) {
        material.emissive.setHex(zombie.flashTimer > 0 ? 0x7d130b : 0x000000)
        material.emissiveIntensity = zombie.flashTimer > 0 ? 1.2 : 0
      }
    }
  }
}

function updateWave(dt: number): void {
  if (state.intermission > 0) {
    state.intermission -= dt
    const seconds = Math.max(0, Math.ceil(state.intermission))
    ui.waveBannerCopy.textContent = `WAVE ${state.wave} IN ${seconds} SECONDS`
    if (state.intermission <= 0) startWave()
    return
  }

  if (!state.waveActive) return
  state.spawnTimer -= dt
  if (state.pendingSpawns > 0 && state.spawnTimer <= 0 && zombies.length < (isTouch ? 38 : 48)) {
    createZombie(nearestSpawnPoint())
    state.pendingSpawns -= 1
    state.spawnTimer = spawnIntervalForWave(state.wave)
  }
  if (state.pendingSpawns === 0 && zombies.length === 0) finishWave()
}

function updateAtmosphere(dt: number, elapsed: number): void {
  const emberAttribute = emberGeometry.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < emberCount; i += 1) {
    let y = emberAttribute.getY(i) + dt * (0.7 + (i % 5) * 0.08)
    let x = emberAttribute.getX(i) + dt * 0.18
    if (y > 20) y = 0
    if (x > 62) x = -62
    emberAttribute.setXYZ(i, x, y, emberAttribute.getZ(i))
  }
  emberAttribute.needsUpdate = true

  const ashAttribute = ashGeometry.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < ashCount; i += 1) {
    let y = ashAttribute.getY(i) - dt * (0.35 + (i % 4) * 0.05)
    let x = ashAttribute.getX(i) + dt * 0.12
    if (y < 0) y = 22
    if (x > 64) x = -64
    ashAttribute.setXYZ(i, x, y, ashAttribute.getZ(i))
  }
  ashAttribute.needsUpdate = true

  for (const fire of animatedFires) {
    const pulse = 0.82 + Math.sin(elapsed * 8 + fire.phase) * 0.12 + Math.sin(elapsed * 14.2 + fire.phase) * 0.06
    fire.flame.scale.set(pulse, 0.85 + pulse * 0.25, pulse)
    fire.glow.intensity = (fire.flame.geometry.parameters.height > 1.5 ? 9 : 4.5) * pulse
  }

  if (state.muzzleTimer > 0) {
    state.muzzleTimer -= dt
    muzzle.visible = true
    muzzleLight.intensity = 4.5 * Math.max(0, state.muzzleTimer / 0.045)
  } else {
    muzzle.visible = false
    muzzleLight.intensity = 0
  }

  if (state.bannerTimer > 0) {
    state.bannerTimer -= dt
    if (state.bannerTimer <= 0) ui.waveBanner.classList.remove('visible')
  }
  if (state.hitTimer > 0) {
    state.hitTimer -= dt
    if (state.hitTimer <= 0) ui.hitMarker.classList.remove('visible', 'kill')
  }
  if (state.damageTimer > 0) {
    state.damageTimer -= dt
    if (state.damageTimer <= 0) ui.damageVignette.classList.remove('visible')
  }
  if (state.toastTimer > 0) {
    state.toastTimer -= dt
    if (state.toastTimer <= 0) ui.toast.classList.remove('visible')
  }
}

const touchMove = { x: 0, y: 0 }
let joystickPointer: number | null = null
function updateJoystick(event: PointerEvent): void {
  const rect = ui.joystick.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  let dx = event.clientX - centerX
  let dy = event.clientY - centerY
  const maximum = rect.width * 0.32
  const length = Math.hypot(dx, dy)
  if (length > maximum) {
    dx = (dx / length) * maximum
    dy = (dy / length) * maximum
  }
  touchMove.x = dx / maximum
  touchMove.y = dy / maximum
  ui.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`
}

ui.joystick.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  joystickPointer = event.pointerId
  ui.joystick.setPointerCapture(event.pointerId)
  updateJoystick(event)
})
ui.joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId === joystickPointer) updateJoystick(event)
})
function endJoystick(event: PointerEvent): void {
  if (event.pointerId !== joystickPointer) return
  joystickPointer = null
  touchMove.x = 0
  touchMove.y = 0
  ui.joystickKnob.style.transform = 'translate(0, 0)'
}
ui.joystick.addEventListener('pointerup', endJoystick)
ui.joystick.addEventListener('pointercancel', endJoystick)

let lookPointer: number | null = null
let lookX = 0
let lookY = 0
ui.lookPad.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  lookPointer = event.pointerId
  lookX = event.clientX
  lookY = event.clientY
  ui.lookPad.setPointerCapture(event.pointerId)
})
ui.lookPad.addEventListener('pointermove', (event) => {
  if (event.pointerId !== lookPointer) return
  const dx = event.clientX - lookX
  const dy = event.clientY - lookY
  lookX = event.clientX
  lookY = event.clientY
  player.yaw -= dx * 0.0048
  player.pitch -= dy * 0.0042
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.18, 1.04)
})
function endLook(event: PointerEvent): void {
  if (event.pointerId === lookPointer) lookPointer = null
}
ui.lookPad.addEventListener('pointerup', endLook)
ui.lookPad.addEventListener('pointercancel', endLook)

let sprintHeld = false
ui.sprintButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  sprintHeld = true
  ui.sprintButton.classList.add('held')
  ui.sprintButton.setPointerCapture(event.pointerId)
})
function endSprint(): void {
  sprintHeld = false
  ui.sprintButton.classList.remove('held')
}
ui.sprintButton.addEventListener('pointerup', endSprint)
ui.sprintButton.addEventListener('pointercancel', endSprint)

ui.fireButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  state.fireHeld = true
  ui.fireButton.setPointerCapture(event.pointerId)
  fireWeapon()
})
function endFire(): void {
  state.fireHeld = false
}
ui.fireButton.addEventListener('pointerup', endFire)
ui.fireButton.addEventListener('pointercancel', endFire)
ui.reloadButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  beginReload()
})

ui.startButton.addEventListener('click', startGame)
ui.restartButton.addEventListener('click', () => {
  ensureAudio()
  resetRun()
})
ui.canvas.addEventListener('click', () => {
  if (state.started && !state.gameOver && !isTouch && document.pointerLockElement !== ui.canvas) {
    void ui.canvas.requestPointerLock?.()
  }
})

addEventListener('keydown', (event) => {
  keys.add(event.code)
  if (event.code === 'KeyR') beginReload()
  if (event.code === 'Escape') document.exitPointerLock?.()
})
addEventListener('keyup', (event) => keys.delete(event.code))
addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== ui.canvas) return
  player.yaw -= event.movementX * 0.0021
  player.pitch -= event.movementY * 0.0019
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.18, 1.04)
})
addEventListener('mousedown', (event) => {
  if (event.button === 0 && document.pointerLockElement === ui.canvas) {
    state.fireHeld = true
    fireWeapon()
  }
})
addEventListener('mouseup', (event) => {
  if (event.button === 0) state.fireHeld = false
})
addEventListener('contextmenu', (event) => event.preventDefault())
addEventListener('blur', () => {
  state.fireHeld = false
  sprintHeld = false
  keys.clear()
})
document.addEventListener('visibilitychange', () => {
  state.paused = document.hidden
  if (state.paused) state.fireHeld = false
})

void App.addListener('backButton', () => {
  if (state.gameOver || !state.started) return
  state.paused = !state.paused
  showToast(state.paused ? 'PAUSED' : 'RESUMED', 1)
})

function onResize(): void {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.15 : 1.55))
  renderer.setSize(innerWidth, innerHeight)
}
addEventListener('resize', onResize)

let elapsed = 0
function animate(): void {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.04)
  elapsed += dt
  if (state.started && !state.paused && !state.gameOver) {
    state.fireCooldown = Math.max(0, state.fireCooldown - dt)
    if (state.fireHeld) fireWeapon()
    if (state.reloading) {
      state.reloadTimer -= dt
      if (state.reloadTimer <= 0) finishReload()
    }
    updatePlayer(dt)
    updateZombies(dt, elapsed)
    updateWave(dt)
  }
  updateAtmosphere(dt, elapsed)
  renderer.render(scene, camera)
}

updateHud()
camera.position.copy(player.position)
camera.rotation.set(player.pitch, player.yaw, 0)
animate()
