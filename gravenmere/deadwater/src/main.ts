import * as THREE from 'three'
import { App } from '@capacitor/app'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { StatusBar } from '@capacitor/status-bar'
import {
  fallDamageForDrop,
  healthAfterRecovery,
  pointsForHit,
  reserveAmmoAfterWave,
  spawnIntervalForWave,
  tuningForWave,
  zombiesForWave,
} from './game-rules'
import type { WeaponPickup } from './environment'
import { DeadwaterSoundscapeV7 } from './soundscape-v7'
import {
  LOOK_SENSITIVITIES,
  canRepairBoat,
  nextSensitivityIndex,
  opticForUpgrade,
  upgradeCost,
  weaponDamageMultiplier,
  weaponMagazineSize,
} from './expansion-rules'
import { buildWorldExpansion } from './world-expansion'
import { DOCK_TOWN_LIMITS, PLAYER_START } from './districts/dock-town-plan'
import type { Driveable, TowerAccess } from './world-objects-v5'
import { WEAPONS, type WeaponId } from './weapons'
import {
  advanceZombieAnimation,
  createTexturedZombieVisual,
  disposeZombieVisual,
  setZombieAnimation,
  type ZombieVisual,
} from './zombie-model'
import {
  circleIntersectsBounds,
  lerpRadians,
  moveCircleSwept,
} from './zombie-navigation'
import {
  ATLAS_TILES,
  configureAtlasTextures,
  gunAtlasTexture,
  installAshfallSky,
  mapGeometryToAtlas,
  type AtlasTile,
} from './texture-atlas'
import './styles.css'
import './expansion-v5.css'
import './polish-v6.css'

// DEADWATER_FEEDBACK_PASS_V2
// DEADWATER_CONTROLS_V3
// DEADWATER_WORLD_PASS_V4
// DEADWATER_EXPANSION_V5
// DEADWATER_POLISH_V6
// DEADWATER_RECORDED_AUDIO_V7
// DEADWATER_DOCK_TOWN_V8

type Collider = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

type Zombie = {
  group: THREE.Group
  parts: THREE.Mesh[]
  visual: ZombieVisual
  health: number
  maxHealth: number
  speed: number
  radius: number
  damage: number
  attackDelay: number
  attackTimer: number
  flashTimer: number
  stuckTimer: number
  velocityX: number
  velocityZ: number
  avoidanceSign: number
  runner: boolean
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

const weaponLabel = ui.ammoPanel.querySelector<HTMLElement>('span')!
const useButton = ui.sprintButton
useButton.textContent = 'USE'
useButton.setAttribute('aria-label', 'Use or enter nearby object')
useButton.classList.remove('round-action--sprint')
useButton.classList.add('round-action--use')

function createHudButton(id: string, label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.id = id
  button.className = 'round-action ' + className
  button.textContent = label
  button.setAttribute('aria-label', label)
  ui.hud.append(button)
  return button
}

const switchButton = createHudButton('switch-button', 'SWP', 'round-action--switch')
const scopeButton = createHudButton('scope-button', 'ADS', 'round-action--scope')
const jumpButton = createHudButton('jump-button', 'JMP', 'round-action--jump')
const pauseButton = createHudButton('pause-button', 'Ⅱ', 'round-action--pause')
pauseButton.setAttribute('aria-label', 'Pause')
const pauseMenu = document.createElement('section')
pauseMenu.id = 'pause-menu'
pauseMenu.setAttribute('aria-hidden', 'true')
pauseMenu.innerHTML =
  '<div class="pause-card">' +
  '<span class="eyebrow">DEADWATER SYSTEMS</span>' +
  '<h2>PAUSED</h2>' +
  '<button id="pause-resume" class="primary-button">RESUME</button>' +
  '<button id="pause-sensitivity" class="pause-setting">LOOK: FAST</button>' +
  '<button id="pause-brightness" class="pause-setting">BRIGHTNESS: STANDARD</button>' +
  '</div>'
document.getElementById('app')!.append(pauseMenu)
const resumeButton = pauseMenu.querySelector<HTMLButtonElement>('#pause-resume')!
const pauseSensitivityButton = pauseMenu.querySelector<HTMLButtonElement>('#pause-sensitivity')!
const pauseBrightnessButton = pauseMenu.querySelector<HTMLButtonElement>('#pause-brightness')!
const scopeOverlay = document.createElement('div')
scopeOverlay.id = 'scope-overlay'
ui.hud.append(scopeOverlay)
const interactionPrompt = document.createElement('div')
interactionPrompt.id = 'interaction-prompt'
ui.hud.append(interactionPrompt)
const questStrip = document.createElement('div')
questStrip.id = 'quest-strip'
questStrip.hidden = true
ui.hud.append(questStrip)
const vehicleStatus = document.createElement('div')
vehicleStatus.id = 'vehicle-status'
ui.hud.append(vehicleStatus)

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x170c09)
scene.fog = new THREE.FogExp2(0x2a130d, 0.0062)

const camera = new THREE.PerspectiveCamera(69, innerWidth / innerHeight, 0.06, 440)
camera.rotation.order = 'YXZ'
scene.add(camera)

const renderer = new THREE.WebGLRenderer({
  canvas: ui.canvas,
  antialias: !isTouch,
  powerPreference: 'high-performance',
})
let renderPixelRatio = Math.min(devicePixelRatio || 1, isTouch ? 0.92 : 1.55)
renderer.setPixelRatio(renderPixelRatio)
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 2.05
configureAtlasTextures(renderer)
installAshfallSky(scene, renderer)

const clock = new THREE.Clock()
const raycaster = new THREE.Raycaster()
raycaster.far = 220
const localHitPoint = new THREE.Vector3()
const shotAim = new THREE.Vector2()
const colliders: Collider[] = []
const colliderGrid = new Map<number, Collider[]>()
const COLLIDER_GRID_SIZE = 12
let colliderIndexReady = false
const shotTargets: THREE.Object3D[] = []
const zombies: Zombie[] = []
const zombieBuckets = new Map<number, Zombie[]>()
const activeZombieBuckets: Zombie[][] = []
const animatedFires: Array<{ flame: THREE.Mesh; glow: THREE.PointLight; phase: number }> = []
const spawnPoints: THREE.Vector3[] = []
const keys = new Set<string>()

const NAV_CELL_SIZE = 1.8
const NAV_COLUMNS = Math.ceil(
  (DOCK_TOWN_LIMITS.maxX - DOCK_TOWN_LIMITS.minX) / NAV_CELL_SIZE,
) + 1
const NAV_ROWS = Math.ceil(
  (DOCK_TOWN_LIMITS.maxZ - DOCK_TOWN_LIMITS.minZ) / NAV_CELL_SIZE,
) + 1
const navBlocked = new Uint8Array(NAV_COLUMNS * NAV_ROWS)
const navDistance = new Int32Array(NAV_COLUMNS * NAV_ROWS)
const navQueue = new Int32Array(NAV_COLUMNS * NAV_ROWS)
const navDirection = new THREE.Vector2()
let navPlayerCell = -1

const player = {
  position: new THREE.Vector3(PLAYER_START.x, 1.82, PLAYER_START.y),
  yaw: Math.PI,
  pitch: -0.03,
  radius: 0.5,
  walkSpeed: 7.45,
  sprintSpeed: 7.45,
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
  weaponId: 'carbine' as WeaponId,
  weaponPickupCooldown: 0,
  weaponSlots: ['carbine'] as WeaponId[],
  weaponIndex: 0,
  weaponAmmo: {} as Partial<Record<WeaponId, { ammo: number; reserve: number }>>,
  weaponLevels: {} as Partial<Record<WeaponId, number>>,
  lookSensitivityIndex: 1,
  brightnessIndex: 2,
  scoped: false,
  vehicleLookYaw: 0,
  vehicleLookPitch: -0.18,
  vehicle: null as Driveable | null,
  elevatedTower: null as TowerAccess | null,
  collectedParts: new Set<string>(),
  interactionCooldown: 0,
  bannerTimer: 0,
  hitTimer: 0,
  damageTimer: 0,
  secondsSinceDamage: 99,
  airborne: false,
  verticalVelocity: 0,
  fallStartY: 0,
  toastTimer: 0,
}

const mats = {
  island: new THREE.MeshStandardMaterial({ color: 0x32241c, roughness: 1 }),
  concrete: new THREE.MeshStandardMaterial({
    color: 0x45413b,
    roughness: 0.96,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }),
  cracked: new THREE.MeshStandardMaterial({
    color: 0x292823,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  }),
  rust: new THREE.MeshStandardMaterial({ color: 0x6f2f20, roughness: 0.9, metalness: 0.42 }),
  darkRust: new THREE.MeshStandardMaterial({ color: 0x351b17, roughness: 0.92, metalness: 0.55 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x3d4140, roughness: 0.63, metalness: 0.72 }),
  blackMetal: new THREE.MeshStandardMaterial({ color: 0x171818, roughness: 0.68, metalness: 0.75 }),
  warning: new THREE.MeshStandardMaterial({ color: 0x9a5a22, roughness: 0.85, metalness: 0.2 }),
  water: new THREE.MeshStandardMaterial({ color: 0x101a1c, roughness: 0.3, metalness: 0.18, transparent: true, opacity: 0.92 }),
  ember: new THREE.MeshBasicMaterial({ color: 0xff6b28, transparent: true, opacity: 0.88 }),
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

function colliderGridKey(cellX: number, cellZ: number): number {
  return (cellX + 512) * 2048 + cellZ + 512
}

function indexCollider(collider: Collider): void {
  const minCellX = Math.floor(collider.minX / COLLIDER_GRID_SIZE)
  const maxCellX = Math.floor(collider.maxX / COLLIDER_GRID_SIZE)
  const minCellZ = Math.floor(collider.minZ / COLLIDER_GRID_SIZE)
  const maxCellZ = Math.floor(collider.maxZ / COLLIDER_GRID_SIZE)
  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      const key = colliderGridKey(cellX, cellZ)
      const bucket = colliderGrid.get(key)
      if (bucket) bucket.push(collider)
      else colliderGrid.set(key, [collider])
    }
  }
}

function rebuildColliderIndex(): void {
  colliderGrid.clear()
  for (const collider of colliders) indexCollider(collider)
  colliderIndexReady = true
}

function addCollider(x: number, z: number, width: number, depth: number, padding = 0.25): void {
  const collider = {
    minX: x - width / 2 - padding,
    maxX: x + width / 2 + padding,
    minZ: z - depth / 2 - padding,
    maxZ: z + depth / 2 + padding,
  }
  colliders.push(collider)
  if (colliderIndexReady) indexCollider(collider)
}

function buildDockTownAtmosphere(): void {
  const hemi = new THREE.HemisphereLight(0x78838b, 0x17100d, 2.45)
  scene.add(hemi)
  const firelight = new THREE.DirectionalLight(0xff7950, 2.15)
  firelight.position.set(-24, 42, 18)
  scene.add(firelight)
  const overcast = new THREE.DirectionalLight(0x8fa4b3, 1.55)
  overcast.position.set(75, 28, 34)
  scene.add(overcast)
  scene.add(new THREE.AmbientLight(0x6f7478, 0.88))

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), mats.water)
  ocean.rotation.x = -Math.PI / 2
  ocean.position.set(86, -0.9, 82)
  scene.add(ocean)
}

buildDockTownAtmosphere()

const weaponPickups: WeaponPickup[] = []

const expandedWorld = buildWorldExpansion({
  scene,
  materials: {
    concrete: mats.concrete,
    cracked: mats.cracked,
    rust: mats.rust,
    darkRust: mats.darkRust,
    metal: mats.metal,
    blackMetal: mats.blackMetal,
    warning: mats.warning,
    ember: mats.ember,
    island: mats.island,
    water: mats.water,
  },
  shotTargets,
  addCollider,
})
weaponPickups.push(...expandedWorld.weaponPickups)
spawnPoints.length = 0
spawnPoints.push(...expandedWorld.spawnPoints)
rebuildColliderIndex()
buildNavigationGrid()

const emberCount = isTouch ? 82 : 180
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

const ashCount = isTouch ? 64 : 140
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

const gunSteelMaterial = new THREE.MeshStandardMaterial({
  color: 0xd4d4d2,
  map: gunAtlasTexture,
  roughness: 0.66,
  metalness: 0.74,
})
const gunPolymerMaterial = new THREE.MeshStandardMaterial({
  color: 0xd0d0ce,
  map: gunAtlasTexture,
  roughness: 0.9,
  metalness: 0.08,
})
const gunWoodMaterial = new THREE.MeshStandardMaterial({
  color: 0xd4c6b7,
  map: gunAtlasTexture,
  roughness: 0.92,
  metalness: 0.02,
})
const gunRustMaterial = new THREE.MeshStandardMaterial({
  color: 0xd0c2b3,
  map: gunAtlasTexture,
  roughness: 0.84,
  metalness: 0.42,
})

function mapWeaponPart(mesh: THREE.Mesh, tile: AtlasTile): THREE.Mesh {
  mapGeometryToAtlas(mesh.geometry, tile)
  return mesh
}

const gun = new THREE.Group()
const gunBody = mapWeaponPart(
  box(0.22, 0.2, 0.72, gunSteelMaterial, 0, 0, -0.02),
  ATLAS_TILES.topLeft,
)
const upperReceiver = mapWeaponPart(
  box(0.16, 0.11, 0.58, gunSteelMaterial, 0, 0.145, -0.08),
  ATLAS_TILES.topLeft,
)
const handguard = mapWeaponPart(
  box(0.18, 0.16, 0.46, gunPolymerMaterial, 0, -0.005, -0.55),
  ATLAS_TILES.topRight,
)
const stock = mapWeaponPart(
  box(0.2, 0.19, 0.38, gunWoodMaterial, 0, -0.015, 0.48),
  ATLAS_TILES.topRight,
)
stock.rotation.x = 0.05
const cheekRest = mapWeaponPart(
  box(0.14, 0.08, 0.28, gunPolymerMaterial, 0, 0.12, 0.45),
  ATLAS_TILES.topRight,
)
const gunGrip = mapWeaponPart(
  box(0.14, 0.36, 0.17, gunPolymerMaterial, 0, -0.24, 0.18),
  ATLAS_TILES.topRight,
)
gunGrip.rotation.x = -0.24
const magazine = mapWeaponPart(
  box(0.15, 0.39, 0.2, gunPolymerMaterial, 0, -0.25, -0.12),
  ATLAS_TILES.topRight,
)
magazine.rotation.x = 0.16
const barrelSleeve = mapWeaponPart(
  cylinder(0.055, 0.055, 0.42, 10, gunSteelMaterial, 0, 0.01, -0.77),
  ATLAS_TILES.topLeft,
)
barrelSleeve.rotation.x = Math.PI / 2
const gunBarrel = mapWeaponPart(
  cylinder(0.03, 0.03, 0.38, 10, gunSteelMaterial, 0, 0.01, -1.04),
  ATLAS_TILES.topLeft,
)
gunBarrel.rotation.x = Math.PI / 2
const frontSight = mapWeaponPart(
  box(0.055, 0.16, 0.055, gunSteelMaterial, 0, 0.16, -0.85),
  ATLAS_TILES.topLeft,
)
const rearSight = mapWeaponPart(
  box(0.075, 0.12, 0.06, gunSteelMaterial, 0, 0.19, 0.08),
  ATLAS_TILES.topLeft,
)
const sidePlate = mapWeaponPart(
  box(0.235, 0.075, 0.3, gunRustMaterial, 0, -0.02, -0.2),
  ATLAS_TILES.bottomRight,
)
const opticGroup = new THREE.Group()
opticGroup.position.set(0, 0.255, -0.1)
const opticRail = mapWeaponPart(
  box(0.15, 0.045, 0.48, gunSteelMaterial, 0, 0, 0),
  ATLAS_TILES.topLeft,
)
const opticLensMaterial = new THREE.MeshBasicMaterial({
  color: 0xff9a5e,
  transparent: true,
  opacity: 0.78,
  toneMapped: false,
})
const reflexOptic = new THREE.Group()
reflexOptic.add(box(0.14, 0.17, 0.07, gunSteelMaterial, 0, 0.12, -0.08))
reflexOptic.add(box(0.105, 0.105, 0.015, opticLensMaterial, 0, 0.13, -0.122))
const combatOptic = new THREE.Group()
const combatTube = cylinder(0.075, 0.075, 0.36, 10, gunSteelMaterial, 0, 0.105, -0.02)
combatTube.rotation.x = Math.PI / 2
combatOptic.add(combatTube)
combatOptic.add(box(0.18, 0.075, 0.12, gunRustMaterial, 0, 0.03, -0.02))
const marksmanOptic = new THREE.Group()
const marksmanTube = cylinder(0.095, 0.095, 0.58, 12, gunSteelMaterial, 0, 0.12, -0.06)
marksmanTube.rotation.x = Math.PI / 2
marksmanOptic.add(marksmanTube)
marksmanOptic.add(box(0.19, 0.08, 0.16, gunRustMaterial, 0, 0.035, -0.06))
const scoutOptic = new THREE.Group()
const scoutTube = cylinder(0.065, 0.065, 0.44, 9, gunRustMaterial, 0, 0.1, -0.19)
scoutTube.rotation.x = Math.PI / 2
scoutOptic.add(scoutTube)
scoutOptic.add(box(0.145, 0.065, 0.13, gunSteelMaterial, 0, 0.028, -0.19))
opticGroup.add(opticRail, reflexOptic, combatOptic, marksmanOptic, scoutOptic)
const forgeBands = [0, 1, 2, 3].map((index) => {
  const band = box(0.235, 0.035, 0.038, gunRustMaterial, 0, 0.105, -0.49 - index * 0.09)
  band.visible = false
  return band
})
const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mats.ember)
muzzle.position.set(0, 0.01, -1.25)
muzzle.visible = false
const muzzleLight = new THREE.PointLight(0xff8b45, 0, 3, 2)
muzzleLight.position.copy(muzzle.position)
gun.add(
  gunBody,
  upperReceiver,
  handguard,
  stock,
  cheekRest,
  gunGrip,
  magazine,
  barrelSleeve,
  gunBarrel,
  frontSight,
  rearSight,
  sidePlate,
  opticGroup,
  ...forgeBands,
  muzzle,
  muzzleLight,
)
gun.rotation.y = -0.035
gun.position.set(0.35, -0.3, -0.55)
camera.add(gun)

const weaponAccentMaterial = gunRustMaterial.clone()
sidePlate.material = weaponAccentMaterial
const weaponViewBase = new THREE.Vector3(0.34, -0.29, -0.61)

function applyWeaponVisual(): void {
  const definition = WEAPONS[state.weaponId]
  const level = currentUpgradeLevel()
  const optic = opticForUpgrade(definition.scopeFov, level)
  gun.scale.set(...definition.viewScale)
  weaponViewBase.set(...definition.viewPosition)
  weaponAccentMaterial.color.setHex(definition.accent)
  weaponAccentMaterial.emissive.setHex(definition.accent)
  weaponAccentMaterial.emissiveIntensity = 0.16 + Math.min(0.7, level * 0.14)
  magazine.scale.set(1 + Math.min(0.18, level * 0.035), 1 + Math.min(0.62, level * 0.13), 1)
  opticGroup.visible = Boolean(optic)
  reflexOptic.visible = optic?.id === 'reflex'
  combatOptic.visible = optic?.id === 'combat'
  marksmanOptic.visible = optic?.id === 'marksman' || optic?.id === 'factory'
  scoutOptic.visible = optic?.id === 'scout'
  frontSight.visible = !optic
  rearSight.visible = !optic
  forgeBands.forEach((band, index) => {
    band.visible = index < Math.min(level, forgeBands.length)
  })
  scopeOverlay.dataset.optic = optic?.id ?? 'iron'
  weaponLabel.textContent = definition.name + (level > 0 ? ' · FORGE ' + level : '')
}

const BRIGHTNESS_LEVELS = [1.45, 1.75, 2.05, 2.38] as const
const BRIGHTNESS_LABELS = ['LOW', 'BRIGHT', 'HIGH', 'MAX'] as const
const SENSITIVITY_LABELS = ['NORMAL', 'FAST', 'VERY FAST'] as const

function refreshPauseSettings(): void {
  pauseSensitivityButton.textContent = 'LOOK: ' + SENSITIVITY_LABELS[state.lookSensitivityIndex]
  pauseBrightnessButton.textContent = 'BRIGHTNESS: ' + BRIGHTNESS_LABELS[state.brightnessIndex]
  renderer.toneMappingExposure = BRIGHTNESS_LEVELS[state.brightnessIndex]
}

function setPaused(paused: boolean): void {
  if (!state.started || state.gameOver) paused = false
  state.paused = paused
  state.fireHeld = false
  pauseMenu.classList.toggle('visible', paused)
  pauseMenu.setAttribute('aria-hidden', String(!paused))
  refreshPauseSettings()
}

function cycleSensitivity(): void {
  state.lookSensitivityIndex = nextSensitivityIndex(state.lookSensitivityIndex)
  refreshPauseSettings()
}

function cycleBrightness(): void {
  state.brightnessIndex = (state.brightnessIndex + 1) % BRIGHTNESS_LEVELS.length
  refreshPauseSettings()
}

function currentUpgradeLevel(): number {
  return state.weaponLevels[state.weaponId] ?? 0
}

function magazineSizeFor(id: WeaponId): number {
  return weaponMagazineSize(WEAPONS[id].magazineSize, state.weaponLevels[id] ?? 0)
}

function currentOptic() {
  const definition = WEAPONS[state.weaponId]
  return opticForUpgrade(definition.scopeFov, currentUpgradeLevel())
}

function ensureWeaponAmmo(id: WeaponId): { ammo: number; reserve: number } {
  let record = state.weaponAmmo[id]
  if (!record) {
    const definition = WEAPONS[id]
    record = { ammo: magazineSizeFor(id), reserve: definition.startingReserve }
    state.weaponAmmo[id] = record
  }
  return record
}

function syncCurrentWeaponAmmo(): void {
  state.weaponAmmo[state.weaponId] = { ammo: state.ammo, reserve: state.reserve }
}

function setScoped(enabled: boolean): void {
  const optic = currentOptic()
  const hasScope = Boolean(optic)
  state.scoped = enabled && !state.vehicle
  camera.fov = state.scoped ? optic?.fov ?? 54 : 69
  camera.updateProjectionMatrix()
  scopeOverlay.classList.toggle('visible', state.scoped && hasScope)
  ui.hud.classList.toggle('aiming', state.scoped)
  ui.hud.classList.toggle('scoped', state.scoped && hasScope)
  scopeButton.textContent = state.scoped ? 'HIP' : 'ADS'
  gun.visible = !state.vehicle && !(state.scoped && hasScope)
}

function toggleScope(): void {
  setScoped(!state.scoped)
}

function equipWeapon(id: WeaponId, fromPickup = false): void {
  syncCurrentWeaponAmmo()
  if (!state.weaponSlots.includes(id)) state.weaponSlots.push(id)
  state.weaponIndex = state.weaponSlots.indexOf(id)
  state.weaponId = id
  const record = ensureWeaponAmmo(id)
  if (fromPickup) {
    const definition = WEAPONS[id]
    record.ammo = Math.max(record.ammo, magazineSizeFor(id))
    record.reserve = Math.max(record.reserve, definition.startingReserve)
  }
  state.ammo = record.ammo
  state.reserve = record.reserve
  state.reloading = false
  state.reloadTimer = 0
  setScoped(false)
  applyWeaponVisual()
  soundscape.switchWeapon()
  showToast((fromPickup ? 'ACQUIRED: ' : 'EQUIPPED: ') + WEAPONS[id].name, 1.7)
  updateHud()
}

function switchWeapon(): void {
  if (state.weaponSlots.length < 2 || state.vehicle) return
  syncCurrentWeaponAmmo()
  state.weaponIndex = (state.weaponIndex + 1) % state.weaponSlots.length
  equipWeapon(state.weaponSlots[state.weaponIndex])
}

function updateQuestStrip(): void {
  const parts = ['propeller', 'fuel-cell', 'toolkit']
  const found = parts.filter((part) => state.collectedParts.has(part)).length
  const boat = expandedWorld.vehicles.find((vehicle) => vehicle.kind === 'boat')
  if (boat?.repaired) {
    questStrip.innerHTML = '<strong>BOAT REPAIRED</strong> · BLACKWATER OUTPOST ACCESSIBLE'
  } else {
    questStrip.innerHTML = '<strong>REPAIR THE LAUNCH</strong> · PARTS ' + found + '/3'
  }
}

function resetExpansionProgress(): void {
  state.weaponSlots = ['carbine']
  state.weaponIndex = 0
  state.weaponAmmo = {
    carbine: { ammo: WEAPONS.carbine.magazineSize, reserve: WEAPONS.carbine.startingReserve },
  }
  state.weaponLevels = {}
  state.weaponId = 'carbine'
  state.ammo = WEAPONS.carbine.magazineSize
  state.reserve = WEAPONS.carbine.startingReserve
  state.collectedParts.clear()
  state.vehicle = null
  state.elevatedTower = null
  state.airborne = false
  state.verticalVelocity = 0
  state.fallStartY = player.position.y
  state.interactionCooldown = 0
  setScoped(false)
  soundscape.stopVehicle()
  vehicleStatus.classList.remove('visible')
  for (const pickup of expandedWorld.questPickups) {
    pickup.active = true
    pickup.group.visible = true
  }
  for (const vehicle of expandedWorld.vehicles) {
    vehicle.fuel = vehicle.startingFuel
    vehicle.group.userData.emptyFuelWarned = false
  }
  const boat = expandedWorld.vehicles.find((vehicle) => vehicle.kind === 'boat')
  if (boat) boat.repaired = false
  updateQuestStrip()
}

function nearestVehicle(): Driveable | null {
  let nearest: Driveable | null = null
  let best = Number.POSITIVE_INFINITY
  for (const vehicle of expandedWorld.vehicles) {
    const dx = player.position.x - vehicle.group.position.x
    const dz = player.position.z - vehicle.group.position.z
    const distanceSquared = dx * dx + dz * dz
    if (distanceSquared < vehicle.enterRadius * vehicle.enterRadius && distanceSquared < best) {
      nearest = vehicle
      best = distanceSquared
    }
  }
  return nearest
}

function vehicleFuelPercent(vehicle: Driveable): number {
  return Math.round((vehicle.fuel / vehicle.fuelCapacity) * 100)
}

function vehicleAtFuelStation(vehicle: Driveable): boolean {
  const station = expandedWorld.fuelStation
  const dx = vehicle.group.position.x - station.position.x
  const dz = vehicle.group.position.z - station.position.z
  return dx * dx + dz * dz <= station.radius * station.radius
}

function updateVehicleStatus(vehicle: Driveable): void {
  vehicleStatus.textContent =
    vehicle.label + ' · FUEL ' + vehicleFuelPercent(vehicle) + '% · USE TO EXIT'
}

function refuelCurrentVehicle(): boolean {
  const vehicle = state.vehicle
  if (!vehicle || !vehicleAtFuelStation(vehicle) || vehicle.fuel >= vehicle.fuelCapacity - 0.5) return false
  const cost = expandedWorld.fuelStation.cost
  if (state.score < cost) {
    showToast('REFUEL REQUIRES ' + cost + ' POINTS', 1.8)
    return true
  }
  state.score -= cost
  vehicle.fuel = vehicle.fuelCapacity
  vehicle.group.userData.emptyFuelWarned = false
  updateVehicleStatus(vehicle)
  updateHud()
  showToast('TANK FILLED · ' + cost + ' POINTS', 1.8)
  return true
}

function nearestQuestPickup() {
  return expandedWorld.questPickups.find((pickup) => {
    if (!pickup.active) return false
    const dx = player.position.x - pickup.position.x
    const dz = player.position.z - pickup.position.z
    return dx * dx + dz * dz < 3 * 3
  }) ?? null
}

function nearestTower(): TowerAccess | null {
  return expandedWorld.towers.find((tower) => {
    const dx = player.position.x - tower.base.x
    const dz = player.position.z - tower.base.z
    return dx * dx + dz * dz < 3.2 * 3.2
  }) ?? null
}

function enterVehicle(vehicle: Driveable): void {
  if (vehicle.kind === 'boat' && !vehicle.repaired) {
    if (!canRepairBoat(state.collectedParts)) {
      showToast('LAUNCH NEEDS PROPELLER · FUEL CELL · TOOLKIT', 2.1)
      return
    }
    vehicle.repaired = true
    soundscape.repairBoat()
    updateQuestStrip()
    showToast('DEADWATER LAUNCH REPAIRED', 2.2)
    return
  }
  state.vehicle = vehicle
  state.airborne = false
  state.verticalVelocity = 0
  state.vehicleLookYaw = 0
  state.vehicleLookPitch = -0.18
  state.elevatedTower = null
  state.fireHeld = false
  setScoped(false)
  soundscape.enterVehicle(vehicle.kind)
  updateVehicleStatus(vehicle)
  vehicleStatus.classList.add('visible')
  gun.visible = false
}

function exitVehicle(): void {
  const vehicle = state.vehicle
  if (!vehicle) return
  if (vehicle.kind === 'boat' && !expandedWorld.isNearLand(vehicle.group.position.x, vehicle.group.position.z, 5.5)) {
    showToast('MOVE CLOSER TO SHORE', 1.4)
    return
  }
  const sideX = vehicle.group.position.x + Math.cos(vehicle.yaw) * 3
  const sideZ = vehicle.group.position.z - Math.sin(vehicle.yaw) * 3
  player.position.x = sideX
  player.position.z = sideZ
  player.position.y = expandedWorld.heightAt(sideX, sideZ) + 1.7
  player.yaw = vehicle.yaw + state.vehicleLookYaw
  player.pitch = state.vehicleLookPitch
  state.vehicle = null
  state.airborne = false
  state.verticalVelocity = 0
  state.vehicleLookYaw = 0
  state.vehicleLookPitch = -0.18
  soundscape.stopVehicle()
  vehicleStatus.classList.remove('visible')
  gun.visible = !state.scoped
}

function performInteraction(): void {
  if (state.interactionCooldown > 0 || state.gameOver) return
  state.interactionCooldown = 0.25
  if (state.vehicle) {
    if (refuelCurrentVehicle()) return
    exitVehicle()
    return
  }
  if (state.elevatedTower) {
    player.position.copy(state.elevatedTower.base)
    player.position.y = expandedWorld.heightAt(player.position.x, player.position.z) + 1.7
    state.elevatedTower = null
    showToast('DESCENDED', 1)
    return
  }
  const questPickup = nearestQuestPickup()
  if (questPickup) {
    questPickup.active = false
    questPickup.group.visible = false
    state.collectedParts.add(questPickup.id)
    soundscape.questPickup()
    updateQuestStrip()
    showToast(questPickup.label + ' FOUND', 1.7)
    return
  }
  const vehicle = nearestVehicle()
  if (vehicle) {
    enterVehicle(vehicle)
    return
  }
  const tower = nearestTower()
  if (tower) {
    state.elevatedTower = tower
    state.airborne = false
    state.verticalVelocity = 0
    player.position.copy(tower.top)
    showToast(tower.label, 1.5)
    return
  }
  const forge = expandedWorld.upgradeMachine
  const forgeDx = player.position.x - forge.position.x
  const forgeDz = player.position.z - forge.position.z
  if (forgeDx * forgeDx + forgeDz * forgeDz < 4.2 * 4.2) {
    const level = currentUpgradeLevel()
    const cost = upgradeCost(level)
    if (state.score < cost) {
      showToast('THE FORGE REQUIRES ' + cost + ' POINTS', 1.8)
      return
    }
    state.score -= cost
    state.weaponLevels[state.weaponId] = level + 1
    const definition = WEAPONS[state.weaponId]
    state.ammo = magazineSizeFor(state.weaponId)
    state.reserve = Math.max(state.reserve, definition.startingReserve)
    syncCurrentWeaponAmmo()
    soundscape.upgrade()
    applyWeaponVisual()
    showToast(
      definition.name + ' FORGED +' + (level + 1) +
      ' · MAG ' + magazineSizeFor(state.weaponId) +
      ' · ' + (currentOptic()?.id.toUpperCase() ?? 'IRON'),
      2.4,
    )
    updateHud()
  }
}

function updateInteractionPrompt(): void {
  let text = ''
  if (state.vehicle) {
    if (vehicleAtFuelStation(state.vehicle) && state.vehicle.fuel < state.vehicle.fuelCapacity - 0.5) {
      text = 'USE · REFUEL · ' + expandedWorld.fuelStation.cost + ' PTS'
    } else {
      text = 'USE · EXIT ' + state.vehicle.label
    }
  } else if (state.elevatedTower) {
    text = 'USE · DESCEND'
  } else {
    const questPickup = nearestQuestPickup()
    const vehicle = nearestVehicle()
    const tower = nearestTower()
    const forge = expandedWorld.upgradeMachine
    const forgeDx = player.position.x - forge.position.x
    const forgeDz = player.position.z - forge.position.z
    if (questPickup) text = 'USE · TAKE ' + questPickup.label
    else if (vehicle) {
      if (vehicle.kind === 'boat' && !vehicle.repaired) {
        const found = ['propeller', 'fuel-cell', 'toolkit']
          .filter((part) => state.collectedParts.has(part)).length
        text = canRepairBoat(state.collectedParts)
          ? 'USE · REPAIR DEADWATER LAUNCH'
          : 'LAUNCH PARTS ' + found + '/3'
      } else {
        text = 'USE · ENTER ' + vehicle.label
      }
    } else if (tower) {
      text = 'USE · CLIMB ' + tower.label
    } else if (forgeDx * forgeDx + forgeDz * forgeDz < 4.2 * 4.2) {
      text = 'USE · FORGE ' + WEAPONS[state.weaponId].name + ' · ' + upgradeCost(currentUpgradeLevel()) + ' PTS'
    }
  }
  interactionPrompt.textContent = text
  interactionPrompt.classList.toggle('visible', text.length > 0)
}

function resetWeaponPickups(): void {
  for (const pickup of weaponPickups) {
    pickup.active = true
    pickup.group.visible = true
    pickup.group.position.y = pickup.baseY
    if (!pickup.group.parent) scene.add(pickup.group)
  }
}

function updateWeaponPickups(dt: number, elapsed: number): void {
  state.weaponPickupCooldown = Math.max(0, state.weaponPickupCooldown - dt)
  for (const pickup of weaponPickups) {
    if (!pickup.active) continue
    pickup.group.rotation.y += dt * 0.18
    pickup.group.position.y = pickup.baseY + Math.sin(elapsed * 1.8 + pickup.phase) * 0.035
    const dx = player.position.x - pickup.group.position.x
    const dz = player.position.z - pickup.group.position.z
    if (state.weaponPickupCooldown > 0 || dx * dx + dz * dz > 2.1 * 2.1) continue
    pickup.active = false
    pickup.group.visible = false
    state.weaponPickupCooldown = 1
    equipWeapon(pickup.weaponId, true)
    soundscape.pickup()
  }
}

applyWeaponVisual()

function circleHitsCollider(x: number, z: number, radius: number): boolean {
  if (!colliderIndexReady) {
    for (const collider of colliders) {
      if (circleIntersectsBounds(x, z, radius, collider)) return true
    }
    return false
  }

  const minCellX = Math.floor((x - radius) / COLLIDER_GRID_SIZE)
  const maxCellX = Math.floor((x + radius) / COLLIDER_GRID_SIZE)
  const minCellZ = Math.floor((z - radius) / COLLIDER_GRID_SIZE)
  const maxCellZ = Math.floor((z + radius) / COLLIDER_GRID_SIZE)
  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      const bucket = colliderGrid.get(colliderGridKey(cellX, cellZ))
      if (!bucket) continue
      for (const collider of bucket) {
        if (circleIntersectsBounds(x, z, radius, collider)) return true
      }
    }
  }
  return false
}

function insideIsland(x: number, z: number, margin = 0): boolean {
  void margin
  return expandedWorld.isWalkableAt(x, z)
}

function navigationCellAt(x: number, z: number): number {
  const column = Math.floor((x - DOCK_TOWN_LIMITS.minX) / NAV_CELL_SIZE)
  const row = Math.floor((z - DOCK_TOWN_LIMITS.minZ) / NAV_CELL_SIZE)
  if (column < 0 || column >= NAV_COLUMNS || row < 0 || row >= NAV_ROWS) return -1
  return row * NAV_COLUMNS + column
}

function navigationCellCenter(index: number, target: THREE.Vector2): THREE.Vector2 {
  const column = index % NAV_COLUMNS
  const row = Math.floor(index / NAV_COLUMNS)
  return target.set(
    DOCK_TOWN_LIMITS.minX + (column + 0.5) * NAV_CELL_SIZE,
    DOCK_TOWN_LIMITS.minZ + (row + 0.5) * NAV_CELL_SIZE,
  )
}

function nearestOpenNavigationCell(index: number, maximumRadius = 8): number {
  if (index < 0) return -1
  if (navBlocked[index] === 0) return index
  const originColumn = index % NAV_COLUMNS
  const originRow = Math.floor(index / NAV_COLUMNS)
  for (let radius = 1; radius <= maximumRadius; radius += 1) {
    for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
      for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
        if (Math.abs(rowOffset) !== radius && Math.abs(columnOffset) !== radius) continue
        const column = originColumn + columnOffset
        const row = originRow + rowOffset
        if (column < 0 || column >= NAV_COLUMNS || row < 0 || row >= NAV_ROWS) continue
        const candidate = row * NAV_COLUMNS + column
        if (navBlocked[candidate] === 0) return candidate
      }
    }
  }
  return -1
}

function nearestReachableNavigationCell(index: number, maximumRadius = 8): number {
  if (index < 0) return -1
  if (navBlocked[index] === 0 && navDistance[index] >= 0) return index
  const originColumn = index % NAV_COLUMNS
  const originRow = Math.floor(index / NAV_COLUMNS)
  for (let radius = 1; radius <= maximumRadius; radius += 1) {
    for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
      for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
        if (Math.abs(rowOffset) !== radius && Math.abs(columnOffset) !== radius) continue
        const column = originColumn + columnOffset
        const row = originRow + rowOffset
        if (column < 0 || column >= NAV_COLUMNS || row < 0 || row >= NAV_ROWS) continue
        const candidate = row * NAV_COLUMNS + column
        if (navBlocked[candidate] === 0 && navDistance[candidate] >= 0) return candidate
      }
    }
  }
  return -1
}

function rebuildNavigationFlow(force = false): void {
  const requestedStart = navigationCellAt(player.position.x, player.position.z)
  const start = nearestOpenNavigationCell(requestedStart, 6)
  if (!force && start === navPlayerCell) return
  navPlayerCell = start
  navDistance.fill(-1)
  if (start < 0) return

  let read = 0
  let write = 0
  navQueue[write++] = start
  navDistance[start] = 0
  const offsets = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ] as const

  while (read < write) {
    const current = navQueue[read++]
    const currentColumn = current % NAV_COLUMNS
    const currentRow = Math.floor(current / NAV_COLUMNS)
    const nextDistance = navDistance[current] + 1
    for (const [columnOffset, rowOffset] of offsets) {
      const column = currentColumn + columnOffset
      const row = currentRow + rowOffset
      if (column < 0 || column >= NAV_COLUMNS || row < 0 || row >= NAV_ROWS) continue
      const candidate = row * NAV_COLUMNS + column
      if (navBlocked[candidate] !== 0 || navDistance[candidate] >= 0) continue
      if (columnOffset !== 0 && rowOffset !== 0) {
        const horizontal = currentRow * NAV_COLUMNS + column
        const vertical = row * NAV_COLUMNS + currentColumn
        if (navBlocked[horizontal] !== 0 || navBlocked[vertical] !== 0) continue
      }
      navDistance[candidate] = nextDistance
      navQueue[write++] = candidate
    }
  }
}

function buildNavigationGrid(): void {
  for (let row = 0; row < NAV_ROWS; row += 1) {
    for (let column = 0; column < NAV_COLUMNS; column += 1) {
      const x = DOCK_TOWN_LIMITS.minX + (column + 0.5) * NAV_CELL_SIZE
      const z = DOCK_TOWN_LIMITS.minZ + (row + 0.5) * NAV_CELL_SIZE
      const index = row * NAV_COLUMNS + column
      navBlocked[index] = (
        insideIsland(x, z, 0.44) &&
        !circleHitsCollider(x, z, 0.44)
      ) ? 0 : 1
    }
  }
  navPlayerCell = -1
  rebuildNavigationFlow(true)
}

function sampleNavigationDirection(
  x: number,
  z: number,
  directX: number,
  directZ: number,
): THREE.Vector2 {
  const current = navigationCellAt(x, z)
  if (current < 0 || navBlocked[current] !== 0 || navDistance[current] < 0) {
    return navDirection.set(directX, directZ)
  }
  const currentColumn = current % NAV_COLUMNS
  const currentRow = Math.floor(current / NAV_COLUMNS)
  let best = current
  let bestDistance = navDistance[current]
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (columnOffset === 0 && rowOffset === 0) continue
      const column = currentColumn + columnOffset
      const row = currentRow + rowOffset
      if (column < 0 || column >= NAV_COLUMNS || row < 0 || row >= NAV_ROWS) continue
      const candidate = row * NAV_COLUMNS + column
      const distance = navDistance[candidate]
      if (columnOffset !== 0 && rowOffset !== 0) {
        const horizontal = currentRow * NAV_COLUMNS + column
        const vertical = row * NAV_COLUMNS + currentColumn
        if (navBlocked[horizontal] !== 0 || navBlocked[vertical] !== 0) continue
      }
      if (navBlocked[candidate] === 0 && distance >= 0 && distance < bestDistance) {
        best = candidate
        bestDistance = distance
      }
    }
  }
  if (best === current) return navDirection.set(directX, directZ)
  navigationCellCenter(best, navDirection)
  navDirection.set(navDirection.x - x, navDirection.y - z).normalize()
  navDirection.x = navDirection.x * 0.82 + directX * 0.18
  navDirection.y = navDirection.y * 0.82 + directZ * 0.18
  return navDirection.normalize()
}

function worldWalkableProbe(x: number, z: number, radius: number): boolean {
  return insideIsland(x, z, radius)
}

function worldColliderProbe(x: number, z: number, radius: number): boolean {
  return circleHitsCollider(x, z, radius)
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

function moveZombie(zombie: Zombie, dx: number, dz: number): boolean {
  return moveCircleSwept(
    zombie.group.position,
    dx,
    dz,
    zombie.radius,
    worldWalkableProbe,
    worldColliderProbe,
  )
}

function nudgeZombieAlongWall(
  zombie: Zombie,
  flowX: number,
  flowZ: number,
): boolean {
  const step = Math.min(0.36, zombie.speed * 0.075)
  let tangentX = -flowZ * zombie.avoidanceSign
  let tangentZ = flowX * zombie.avoidanceSign
  let moved = moveZombie(zombie, tangentX * step, tangentZ * step)
  if (!moved) {
    zombie.avoidanceSign *= -1
    tangentX = -tangentX
    tangentZ = -tangentZ
    moved = moveZombie(zombie, tangentX * step, tangentZ * step)
  }
  if (moved) {
    zombie.velocityX = tangentX
    zombie.velocityZ = tangentZ
    zombie.stuckTimer = 0.24
  } else {
    zombie.stuckTimer = 0.62
  }
  return moved
}

function createZombie(position: THREE.Vector3): Zombie | null {
  const tuning = tuningForWave(state.wave)
  const visual = createTexturedZombieVisual()
  if (!visual) return null
  const group = visual.group
  const scale = 0.9 + Math.random() * 0.2
  group.position.copy(position)
  group.scale.setScalar(scale)
  const runner = Math.random() < Math.min(0.52, 0.2 + state.wave * 0.025)

  const zombie: Zombie = {
    group,
    parts: visual.parts,
    visual,
    health: tuning.health,
    maxHealth: tuning.health,
    speed: tuning.speed * (0.94 + Math.random() * 0.24) * (runner ? 1.3 : 1),
    radius: 0.44 * scale,
    damage: tuning.damage,
    attackDelay: tuning.attackDelay,
    attackTimer: Math.random() * 0.4,
    flashTimer: 0,
    stuckTimer: 0,
    velocityX: 0,
    velocityZ: 0,
    avoidanceSign: Math.random() < 0.5 ? -1 : 1,
    runner,
    dead: false,
  }

  setZombieAnimation(
    visual,
    runner ? 'run' : 'walk',
    runner ? 0.95 + Math.random() * 0.12 : 0.86 + Math.random() * 0.12,
  )
  for (const part of visual.parts) {
    part.userData.zombie = zombie
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
  }
  disposeZombieVisual(zombie.visual)
  const zombieIndex = zombies.indexOf(zombie)
  if (zombieIndex >= 0) zombies.splice(zombieIndex, 1)
}

function clearZombies(): void {
  for (const zombie of [...zombies]) removeZombie(zombie)
}

const soundscape = new DeadwaterSoundscapeV7()

function ensureAudio(): AudioContext {
  return soundscape.ensure()
}

function noiseBurst(
  duration: number,
  volume: number,
  frequency: number,
  filterType: BiquadFilterType = 'lowpass',
  q = 0.7,
  delay = 0,
): void {
  soundscape.noiseBurst(duration, volume, frequency, filterType, q, delay)
}

function playGunshot(): void {
  soundscape.gunshot(state.weaponId)
}

function playEmptyClick(): void {
  soundscape.emptyClick()
}

function playZombieMoan(distance: number): void {
  soundscape.zombieMoan(distance)
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
  const level = currentUpgradeLevel()
  weaponLabel.textContent = WEAPONS[state.weaponId].name + (level > 0 ? ' · FORGE ' + level : '')
}

function nearestSpawnPoint(): THREE.Vector3 {
  const preferred = spawnPoints.filter((point) => {
    const distanceSquared = point.distanceToSquared(player.position)
    return distanceSquared > 38 * 38 && distanceSquared < 112 * 112
  })
  const distant = spawnPoints.filter((point) => point.distanceToSquared(player.position) > 32 * 32)
  const pool = preferred.length > 0 ? preferred : distant.length > 0 ? distant : spawnPoints
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const base = pool[Math.floor(Math.random() * pool.length)]
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * 7.5
    const candidate = new THREE.Vector3(
      base.x + Math.cos(angle) * radius,
      base.y,
      base.z + Math.sin(angle) * radius,
    )
    const navCell = navigationCellAt(candidate.x, candidate.z)
    if (
      navCell >= 0 &&
      navBlocked[navCell] === 0 &&
      navDistance[navCell] >= 0 &&
      insideIsland(candidate.x, candidate.z, 0.44) &&
      !circleHitsCollider(candidate.x, candidate.z, 0.44)
    ) {
      return candidate
    }
  }

  const fallback = pool[Math.floor(Math.random() * pool.length)].clone()
  const open = nearestReachableNavigationCell(navigationCellAt(fallback.x, fallback.z), 12)
  if (open >= 0) {
    navigationCellCenter(open, navDirection)
    fallback.set(navDirection.x, fallback.y, navDirection.y)
  }
  return fallback
}

function startWave(): void {
  state.waveActive = true
  state.pendingSpawns = zombiesForWave(state.wave)
  state.spawnTimer = 0.9
  showBanner(`WAVE ${state.wave}`, state.wave === 1 ? 'THE TREELINE IS MOVING' : 'THE SIRENS START AGAIN', 3)
  updateHud()
}

function finishWave(): void {
  state.waveActive = false
  state.wave += 1
  state.intermission = 7
  state.health = Math.min(100, state.health + 22)
  state.reserve = reserveAmmoAfterWave(state.reserve, state.wave)
  const weapon = WEAPONS[state.weaponId]
  const magazineSize = magazineSizeFor(state.weaponId)
  if (state.ammo < magazineSize) {
    const needed = magazineSize - state.ammo
    const loaded = Math.min(needed, state.reserve)
    state.ammo += loaded
    state.reserve -= loaded
  }
  showBanner('WAVE CLEARED', `WAVE ${state.wave} IN 7 SECONDS`, 6.8)
  showToast('AMMO AND HEALTH RECOVERED', 2.4)
  updateHud()
}

function beginReload(): void {
  const weapon = WEAPONS[state.weaponId]
  if (state.reloading || state.ammo >= magazineSizeFor(state.weaponId) || state.reserve <= 0 || state.gameOver) return
  state.reloading = true
  state.reloadTimer = weapon.reloadTime
  soundscape.reload()
  showToast('RELOADING', 1.2)
  updateHud()
}

function finishReload(): void {
  const needed = magazineSizeFor(state.weaponId) - state.ammo
  const amount = Math.min(needed, state.reserve)
  state.ammo += amount
  state.reserve -= amount
  state.reloading = false
  syncCurrentWeaponAmmo()
  updateHud()
}

function damagePlayer(amount: number): void {
  if (state.gameOver) return
  state.health -= amount
  state.secondsSinceDamage = 0
  state.damageTimer = 0.26
  ui.damageVignette.classList.add('visible')
  void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined)
  updateHud()
  if (state.health <= 0) endRun()
}

function jumpPlayer(): void {
  if (!state.started || state.paused || state.gameOver || state.vehicle || state.airborne) return
  state.fallStartY = player.position.y
  state.verticalVelocity = state.elevatedTower ? 2.35 : 5.2
  state.airborne = true
  if (state.elevatedTower) {
    state.elevatedTower = null
    showToast('BALCONY JUMP', 0.9)
  }
}

function updateVerticalMotion(dt: number): void {
  if (state.vehicle || state.elevatedTower || !state.airborne) return
  const groundY = expandedWorld.heightAt(player.position.x, player.position.z) + 1.7
  state.verticalVelocity -= 13.8 * dt
  player.position.y += state.verticalVelocity * dt
  state.fallStartY = Math.max(state.fallStartY, player.position.y)
  if (player.position.y > groundY) return
  const dropHeight = state.fallStartY - groundY
  player.position.y = groundY
  state.airborne = false
  state.verticalVelocity = 0
  const damage = fallDamageForDrop(dropHeight)
  if (damage > 0) {
    damagePlayer(damage)
    showToast('FALL · ' + damage + ' DAMAGE', 1.15)
  }
}

function updateHealthRecovery(dt: number): void {
  state.secondsSinceDamage += dt
  const previousHealth = state.health
  state.health = healthAfterRecovery(state.health, state.secondsSinceDamage, dt)
  if (Math.ceil(previousHealth) !== Math.ceil(state.health)) updateHud()
}

function fireWeapon(): void {
  if (!state.started || state.gameOver || state.reloading || state.fireCooldown > 0 || state.vehicle) return
  const weapon = WEAPONS[state.weaponId]
  state.fireCooldown = weapon.fireDelay
  if (state.ammo <= 0) {
    playEmptyClick()
    beginReload()
    return
  }
  state.ammo -= 1
  state.recoil = Math.min(1, state.recoil + (state.weaponId === 'shotgun' ? 0.92 : 0.62))
  state.muzzleTimer = state.weaponId === 'shotgun' ? 0.07 : 0.045
  muzzle.visible = true
  muzzleLight.intensity = state.weaponId === 'shotgun' ? 7 : 4.5
  playGunshot()
  if (!weapon.automatic) state.fireHeld = false
  if (state.ammo % 4 === 0) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)

  let hitSomething = false
  let killedSomething = false
  for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
    const spreadX = (Math.random() - 0.5) * weapon.spread
    const spreadY = (Math.random() - 0.5) * weapon.spread
    shotAim.set(spreadX, spreadY)
    raycaster.setFromCamera(shotAim, camera)
    const hit = raycaster.intersectObjects(shotTargets, false)[0]
    if (!hit) continue
    const zombie = hit.object.userData.zombie as Zombie | undefined
    if (!zombie || zombie.dead) continue
    hitSomething = true
    localHitPoint.copy(hit.point)
    zombie.group.worldToLocal(localHitPoint)
    const headshot = localHitPoint.y > 1.43
    const waveBonus = Math.floor((state.wave - 1) / 6) * 2
    const damage =
      (weapon.damage + waveBonus) *
      weaponDamageMultiplier(currentUpgradeLevel()) *
      (headshot ? weapon.headshotMultiplier : 1)
    zombie.health -= damage
    zombie.flashTimer = 0.075
    const killed = zombie.health <= 0
    state.score += pointsForHit(headshot, killed)
    if (killed) {
      zombie.dead = true
      killedSomething = true
      state.kills += 1
      soundscape.zombieDeath()
      setZombieAnimation(zombie.visual, 'death', 1)
      setTimeout(() => {
        if (zombies.includes(zombie)) removeZombie(zombie)
      }, 900)
    }
  }
  if (hitSomething) showHit(killedSomething)
  updateHud()
}

function endRun(): void {
  state.gameOver = true
  setPaused(false)
  state.fireHeld = false
  state.health = 0
  document.exitPointerLock?.()
  ui.finalScore.textContent = `Wave ${state.wave} · ${state.kills} kills · ${state.score} points`
  ui.gameOverScreen.classList.add('screen--visible')
  ui.gameOverScreen.setAttribute('aria-hidden', 'false')
  showBanner('SIGNAL LOST', 'NO MOVEMENT DETECTED', 2)
  soundscape.gameOver()
  updateHud()
}

function resetRun(): void {
  clearZombies()
  player.position.set(
    PLAYER_START.x,
    expandedWorld.heightAt(PLAYER_START.x, PLAYER_START.y) + 1.7,
    PLAYER_START.y,
  )
  player.yaw = Math.PI
  player.pitch = -0.03
  state.gameOver = false
  state.wave = 1
  state.waveActive = false
  state.intermission = 0
  state.pendingSpawns = 0
  state.spawnTimer = 0
  state.health = 100
  state.secondsSinceDamage = 99
  state.airborne = false
  state.verticalVelocity = 0
  state.fallStartY = player.position.y
  state.weaponId = 'carbine'
  const startingWeapon = WEAPONS.carbine
  state.ammo = startingWeapon.magazineSize
  state.reserve = startingWeapon.startingReserve
  state.reloading = false
  state.reloadTimer = 0
  state.fireHeld = false
  state.fireCooldown = 0
  state.kills = 0
  state.score = 0
  resetExpansionProgress()
  resetWeaponPickups()
  applyWeaponVisual()
  ui.gameOverScreen.classList.remove('screen--visible')
  ui.gameOverScreen.setAttribute('aria-hidden', 'true')
  updateHud()
  startWave()
}

function startGame(): void {
  state.started = true
  setPaused(false)
  ui.startScreen.classList.remove('screen--visible')
  ui.hud.setAttribute('aria-hidden', 'false')
  soundscape.start()
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
  const inputLength = Math.hypot(forward, strafe)
  if (inputLength > 1) {
    forward /= inputLength
    strafe /= inputLength
  }

  if (state.vehicle) {
    const vehicle = state.vehicle
    const targetSpeed = vehicle.fuel > 0 ? forward * vehicle.maxSpeed : 0
    if (vehicle.fuel <= 0 && Math.abs(forward) > 0.05 && !vehicle.group.userData.emptyFuelWarned) {
      vehicle.group.userData.emptyFuelWarned = true
      showToast('OUT OF FUEL · FIND THE LAST STOP', 2.1)
    }
    vehicle.speed = THREE.MathUtils.damp(vehicle.speed, targetSpeed, 4.2, dt)
    if (Math.abs(forward) < 0.02) vehicle.speed = THREE.MathUtils.damp(vehicle.speed, 0, 2.7, dt)
    const steeringStrength = THREE.MathUtils.clamp(Math.abs(vehicle.speed) / Math.max(1, vehicle.maxSpeed), 0.18, 1)
    const steeringDirection = vehicle.speed < 0 ? -1 : 1
    const manualTurn =
      strafe * vehicle.turnRate * dt * steeringStrength * steeringDirection
    vehicle.yaw += manualTurn
    state.vehicleLookYaw -= manualTurn

    // The right-side look direction is the desired driving heading. The vehicle
    // follows it smoothly while throttle is applied, while the absolute camera
    // direction remains stable as the chassis turns underneath it.
    if (Math.abs(forward) > 0.035) {
      const perspectiveDelta = Math.atan2(
        Math.sin(state.vehicleLookYaw),
        Math.cos(state.vehicleLookYaw),
      )
      const maximumFollowTurn = vehicle.turnRate * dt * steeringStrength * 1.08
      const perspectiveTurn = THREE.MathUtils.clamp(
        perspectiveDelta,
        -maximumFollowTurn,
        maximumFollowTurn,
      ) * steeringDirection
      vehicle.yaw += perspectiveTurn
      state.vehicleLookYaw -= perspectiveTurn
    }

    const nextX = vehicle.group.position.x - Math.sin(vehicle.yaw) * vehicle.speed * dt
    const nextZ = vehicle.group.position.z - Math.cos(vehicle.yaw) * vehicle.speed * dt
    const radius = vehicle.kind === 'boat' ? 2.4 : 1.45
    const allowed = vehicle.kind === 'boat'
      ? expandedWorld.canBoatAt(nextX, nextZ)
      : expandedWorld.isMainLandAt(nextX, nextZ) && !circleHitsCollider(nextX, nextZ, radius)
    if (allowed) {
      vehicle.group.position.x = nextX
      vehicle.group.position.z = nextZ
    } else {
      vehicle.speed *= -0.12
    }
    if (vehicle.fuel > 0 && Math.abs(vehicle.speed) > 0.08) {
      vehicle.fuel = Math.max(0, vehicle.fuel - Math.abs(vehicle.speed) * dt * 0.024)
      if (vehicle.fuel === 0) vehicle.group.userData.emptyFuelWarned = false
    }
    vehicle.group.position.y = vehicle.kind === 'boat'
      ? -0.02
      : expandedWorld.heightAt(vehicle.group.position.x, vehicle.group.position.z) + 0.1
    vehicle.group.rotation.y = vehicle.yaw
    player.position.set(
      vehicle.group.position.x,
      vehicle.group.position.y + 1.5,
      vehicle.group.position.z,
    )
    player.yaw = vehicle.yaw
    const orbitYaw = vehicle.yaw + state.vehicleLookYaw
    const orbitDistance = vehicle.kind === 'boat' ? 7.2 : 6.2
    const verticalLook = Math.sin(state.vehicleLookPitch)
    camera.position.set(
      vehicle.group.position.x + Math.sin(orbitYaw) * orbitDistance,
      vehicle.group.position.y + 3.45 - verticalLook * 2.25,
      vehicle.group.position.z + Math.cos(orbitYaw) * orbitDistance,
    )
    camera.lookAt(
      vehicle.group.position.x,
      vehicle.group.position.y + 1.25 + verticalLook * 4.2,
      vehicle.group.position.z,
    )
    soundscape.updateVehicle(vehicle.kind, vehicle.speed / vehicle.maxSpeed)
    updateVehicleStatus(vehicle)
    ui.district.textContent = expandedWorld.districtAt(player.position.x, player.position.z)
    emberCloud.position.set(player.position.x, 0, player.position.z)
    ashCloud.position.set(player.position.x, 0, player.position.z)
    updateInteractionPrompt()
    return
  }

  const moving = Math.abs(forward) + Math.abs(strafe) > 0.025
  player.moving = moving
  if (moving) {
    const sin = Math.sin(player.yaw)
    const cos = Math.cos(player.yaw)
    const dx = (-sin * forward + cos * strafe) * player.walkSpeed * dt
    const dz = (-cos * forward - sin * strafe) * player.walkSpeed * dt
    if (state.elevatedTower) {
      const tower = state.elevatedTower
      player.position.x = THREE.MathUtils.clamp(
        player.position.x + dx,
        tower.top.x - tower.halfWidth,
        tower.top.x + tower.halfWidth,
      )
      player.position.z = THREE.MathUtils.clamp(
        player.position.z + dz,
        tower.top.z - tower.halfDepth,
        tower.top.z + tower.halfDepth,
      )
      player.position.y = tower.top.y
    } else {
      movePlayer(dx, dz)
      if (!state.airborne) {
        player.position.y = expandedWorld.heightAt(player.position.x, player.position.z) + 1.7
      }
    }
    player.bob += dt * 11.2
  } else if (!state.elevatedTower && !state.airborne) {
    player.position.y = expandedWorld.heightAt(player.position.x, player.position.z) + 1.7
  }

  updateVerticalMotion(dt)

  const bobY = moving && !state.scoped ? Math.sin(player.bob) * 0.04 : 0
  const bobX = moving && !state.scoped ? Math.cos(player.bob * 0.5) * 0.02 : 0
  camera.position.set(player.position.x + bobX, player.position.y + bobY, player.position.z)
  camera.rotation.set(player.pitch, player.yaw, 0)
  updateWeaponPickups(dt, elapsed)

  const gunBobX = moving ? Math.cos(player.bob * 0.5) * 0.018 : 0
  const gunBobY = moving ? Math.abs(Math.sin(player.bob)) * 0.018 : 0
  state.recoil = Math.max(0, state.recoil - dt * 7.8)
  const hasOptic = Boolean(currentOptic())
  const ironSights = state.scoped && !hasOptic
  gun.position.set(
    ironSights ? 0.012 : weaponViewBase.x + gunBobX,
    ironSights ? -0.185 - state.recoil * 0.025 : weaponViewBase.y - gunBobY - state.recoil * 0.04,
    ironSights ? weaponViewBase.z - 0.08 + state.recoil * 0.045 : weaponViewBase.z + state.recoil * 0.08,
  )
  gun.rotation.x = -state.recoil * (ironSights ? 0.07 : 0.12)
  gun.rotation.y = ironSights ? 0 : -0.035
  gun.visible = !state.vehicle && !(state.scoped && hasOptic)

  ui.district.textContent = expandedWorld.districtAt(player.position.x, player.position.z)
  emberCloud.position.set(player.position.x, 0, player.position.z)
  ashCloud.position.set(player.position.x, 0, player.position.z)
  updateInteractionPrompt()
}

function updateZombies(dt: number, _elapsed: number): void {
  rebuildNavigationFlow()
  const cellSize = 3.1
  for (const bucket of activeZombieBuckets) bucket.length = 0
  activeZombieBuckets.length = 0
  for (const zombie of zombies) {
    if (zombie.dead) continue
    const cellX = Math.floor(zombie.group.position.x / cellSize)
    const cellZ = Math.floor(zombie.group.position.z / cellSize)
    const key = (cellX + 256) * 1024 + cellZ + 256
    let bucket = zombieBuckets.get(key)
    if (!bucket) {
      bucket = []
      zombieBuckets.set(key, bucket)
    }
    if (bucket.length === 0) activeZombieBuckets.push(bucket)
    bucket.push(zombie)
  }

  for (const zombie of zombies) {
    if (zombie.dead) {
      advanceZombieAnimation(zombie.visual, dt, 0)
      continue
    }
    zombie.attackTimer -= dt
    zombie.flashTimer = Math.max(0, zombie.flashTimer - dt)
    const deltaX = player.position.x - zombie.group.position.x
    const deltaZ = player.position.z - zombie.group.position.z
    const distance = Math.hypot(deltaX, deltaZ)
    playZombieMoan(distance)

    if (distance > 1.22) {
      const inverseDistance = 1 / Math.max(distance, 0.001)
      const directionX = deltaX * inverseDistance
      const directionZ = deltaZ * inverseDistance
      const flow = sampleNavigationDirection(
        zombie.group.position.x,
        zombie.group.position.z,
        directionX,
        directionZ,
      )
      const flowX = flow.x
      const flowZ = flow.y
      let separationX = 0
      let separationZ = 0
      const cellX = Math.floor(zombie.group.position.x / cellSize)
      const cellZ = Math.floor(zombie.group.position.z / cellSize)
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
          const nearby = zombieBuckets.get(
            (cellX + offsetX + 256) * 1024 + cellZ + offsetZ + 256,
          )
          if (!nearby) continue
          for (const other of nearby) {
            if (other === zombie || other.dead) continue
            const dx = zombie.group.position.x - other.group.position.x
            const dz = zombie.group.position.z - other.group.position.z
            const distanceSquared = dx * dx + dz * dz
            if (distanceSquared > 0.001 && distanceSquared < 1.35 * 1.35) {
              separationX += dx / distanceSquared
              separationZ += dz / distanceSquared
            }
          }
        }
      }
      const separationLength = Math.hypot(separationX, separationZ)
      if (separationLength > 1.2) {
        separationX = (separationX / separationLength) * 1.2
        separationZ = (separationZ / separationLength) * 1.2
      }
      const desiredX = flowX + separationX * 0.16
      const desiredZ = flowZ + separationZ * 0.16
      const desiredLength = Math.hypot(desiredX, desiredZ) || 1
      const targetX = desiredX / desiredLength
      const targetZ = desiredZ / desiredLength
      const steering = 1 - Math.exp(-dt * (zombie.stuckTimer > 0.35 ? 11 : 7.5))
      if (Math.hypot(zombie.velocityX, zombie.velocityZ) < 0.01) {
        zombie.velocityX = targetX
        zombie.velocityZ = targetZ
      } else {
        zombie.velocityX += (targetX - zombie.velocityX) * steering
        zombie.velocityZ += (targetZ - zombie.velocityZ) * steering
        const velocityLength = Math.hypot(zombie.velocityX, zombie.velocityZ) || 1
        zombie.velocityX /= velocityLength
        zombie.velocityZ /= velocityLength
      }
      const previousX = zombie.group.position.x
      const previousZ = zombie.group.position.z
      const moved = moveZombie(
        zombie,
        zombie.velocityX * zombie.speed * dt,
        zombie.velocityZ * zombie.speed * dt,
      )
      let movement = Math.hypot(
        zombie.group.position.x - previousX,
        zombie.group.position.z - previousZ,
      )
      if (!moved || movement < zombie.speed * dt * 0.1) {
        zombie.stuckTimer += dt
      } else {
        zombie.stuckTimer = Math.max(0, zombie.stuckTimer - dt * 2.2)
      }
      if (zombie.stuckTimer > 0.62) {
        nudgeZombieAlongWall(zombie, flowX, flowZ)
        movement = Math.hypot(
          zombie.group.position.x - previousX,
          zombie.group.position.z - previousZ,
        )
      }
      if (movement > 0.001) {
        const movementX = zombie.group.position.x - previousX
        const movementZ = zombie.group.position.z - previousZ
        const targetYaw = Math.atan2(-movementX, -movementZ)
        zombie.group.rotation.y = lerpRadians(
          zombie.group.rotation.y,
          targetYaw,
          1 - Math.exp(-dt * 10),
        )
      }
      setZombieAnimation(
        zombie.visual,
        zombie.runner ? 'run' : 'walk',
        THREE.MathUtils.clamp(zombie.speed / (zombie.runner ? 4.6 : 3.35), 0.78, 1.35),
      )
    } else if (!state.elevatedTower && zombie.attackTimer <= 0) {
      zombie.attackTimer = zombie.attackDelay
      soundscape.zombieAttack()
      damagePlayer(zombie.damage)
    }

    if (distance <= 1.22) setZombieAnimation(zombie.visual, 'attack', 0.94)
    zombie.group.position.y =
      expandedWorld.heightAt(zombie.group.position.x, zombie.group.position.z)
    advanceZombieAnimation(zombie.visual, dt, distance)

    const flashing = zombie.flashTimer > 0
    if (Boolean(zombie.group.userData.flashActive) !== flashing) {
      zombie.group.userData.flashActive = flashing
      const materials = new Set<THREE.MeshStandardMaterial>()
      for (const part of zombie.parts) {
        const material = part.material
        if (!Array.isArray(material) && material instanceof THREE.MeshStandardMaterial) materials.add(material)
      }
      for (const material of materials) {
        material.emissive.setHex(flashing ? 0x7d130b : 0x000000)
        material.emissiveIntensity = flashing ? 1.2 : 0
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
  if (state.pendingSpawns > 0 && state.spawnTimer <= 0 && zombies.length < (isTouch ? 40 : 60)) {
    const zombie = createZombie(nearestSpawnPoint())
    if (zombie) {
      state.pendingSpawns -= 1
      state.spawnTimer = spawnIntervalForWave(state.wave)
    } else {
      // The embedded GLB normally finishes parsing on the title screen. If the
      // player starts instantly, keep the wave alive for the few frames needed
      // to finish without ever showing the rejected placeholder model.
      state.spawnTimer = 0.08
    }
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
  if (joystickPointer !== null) return
  joystickPointer = event.pointerId
  updateJoystick(event)
})
function endJoystick(event: PointerEvent): void {
  if (event.pointerId !== joystickPointer) return
  joystickPointer = null
  touchMove.x = 0
  touchMove.y = 0
  ui.joystickKnob.style.transform = 'translate(0, 0)'
}

let lookPointer: number | null = null
let lookX = 0
let lookY = 0
ui.lookPad.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  if (lookPointer !== null) return
  lookPointer = event.pointerId
  lookX = event.clientX
  lookY = event.clientY
})
function updateLook(event: PointerEvent): void {
  if (event.pointerId !== lookPointer) return
  const dx = event.clientX - lookX
  const dy = event.clientY - lookY
  lookX = event.clientX
  lookY = event.clientY
  const lookScale = LOOK_SENSITIVITIES[state.lookSensitivityIndex]
  if (state.vehicle) {
    state.vehicleLookYaw -= dx * 0.0048 * lookScale
    state.vehicleLookPitch -= dy * 0.0042 * lookScale
    state.vehicleLookPitch = THREE.MathUtils.clamp(state.vehicleLookPitch, -0.72, 0.62)
  } else {
    player.yaw -= dx * 0.0048 * lookScale
    player.pitch -= dy * 0.0042 * lookScale
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.18, 1.04)
  }
}
function endLook(event: PointerEvent): void {
  if (event.pointerId === lookPointer) lookPointer = null
}

ui.sprintButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  performInteraction()
})

let firePointer: number | null = null
ui.fireButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  if (firePointer !== null) return
  firePointer = event.pointerId
  state.fireHeld = true
  fireWeapon()
})
function endFire(event: PointerEvent): void {
  if (event.pointerId !== firePointer) return
  firePointer = null
  state.fireHeld = false
}

// WebView pointer capture can serialize separate fingers onto one control. A
// single document-level router keeps movement, look, and fire IDs independent,
// allowing all three actions to remain live at the same time.
document.addEventListener('pointermove', (event) => {
  if (
    event.pointerId !== joystickPointer &&
    event.pointerId !== lookPointer
  ) return
  event.preventDefault()
  if (event.pointerId === joystickPointer) updateJoystick(event)
  if (event.pointerId === lookPointer) updateLook(event)
}, { passive: false })

function endTouchPointer(event: PointerEvent): void {
  endJoystick(event)
  endLook(event)
  endFire(event)
}
document.addEventListener('pointerup', endTouchPointer)
document.addEventListener('pointercancel', endTouchPointer)

ui.reloadButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  beginReload()
})
switchButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  switchWeapon()
})
scopeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  toggleScope()
})
jumpButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  jumpPlayer()
})
pauseButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  setPaused(true)
})
resumeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  setPaused(false)
})
pauseSensitivityButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  cycleSensitivity()
})
pauseBrightnessButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  cycleBrightness()
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
  if (event.code === 'KeyQ') switchWeapon()
  if (event.code === 'KeyE') performInteraction()
  if (event.code === 'KeyC') toggleScope()
  if (event.code === 'Space') {
    event.preventDefault()
    jumpPlayer()
  }
  if (event.code === 'Escape') {
    setPaused(!state.paused)
    if (state.paused) document.exitPointerLock?.()
  }
})
addEventListener('keyup', (event) => keys.delete(event.code))
addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== ui.canvas) return
  const lookScale = LOOK_SENSITIVITIES[state.lookSensitivityIndex]
  if (state.vehicle) {
    state.vehicleLookYaw -= event.movementX * 0.0021 * lookScale
    state.vehicleLookPitch -= event.movementY * 0.0019 * lookScale
    state.vehicleLookPitch = THREE.MathUtils.clamp(state.vehicleLookPitch, -0.72, 0.62)
  } else {
    player.yaw -= event.movementX * 0.0021 * lookScale
    player.pitch -= event.movementY * 0.0019 * lookScale
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.18, 1.04)
  }
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
  firePointer = null
  lookPointer = null
  joystickPointer = null
  touchMove.x = 0
  touchMove.y = 0
  ui.joystickKnob.style.transform = 'translate(0, 0)'
  keys.clear()
})
document.addEventListener('visibilitychange', () => {
  state.paused = document.hidden
  if (state.paused) state.fireHeld = false
})

void App.addListener('backButton', () => {
  if (state.gameOver || !state.started) return
  setPaused(!state.paused)
})

function onResize(): void {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(renderPixelRatio)
  renderer.setSize(innerWidth, innerHeight)
}
addEventListener('resize', onResize)

let elapsed = 0
let atmosphereFrame = 0
let adaptiveSeconds = 0
let adaptiveFrames = 0

function updateAdaptiveResolution(rawDelta: number): void {
  if (!isTouch || !state.started || state.paused || state.gameOver || rawDelta > 0.2) return
  adaptiveSeconds += rawDelta
  adaptiveFrames += 1
  if (adaptiveSeconds < 2.4) return

  const averageFps = adaptiveFrames / adaptiveSeconds
  const previous = renderPixelRatio
  if (averageFps < 43) renderPixelRatio = Math.max(0.68, renderPixelRatio - 0.075)
  else if (averageFps < 51) renderPixelRatio = Math.max(0.68, renderPixelRatio - 0.045)
  else if (averageFps > 58) renderPixelRatio = Math.min(0.92, renderPixelRatio + 0.025)

  adaptiveSeconds = 0
  adaptiveFrames = 0
  if (Math.abs(previous - renderPixelRatio) < 0.001) return
  renderer.setPixelRatio(renderPixelRatio)
  renderer.setSize(innerWidth, innerHeight, false)
}

function animate(): void {
  requestAnimationFrame(animate)
  const rawDelta = clock.getDelta()
  const dt = Math.min(rawDelta, 0.04)
  elapsed += dt
  updateAdaptiveResolution(rawDelta)
  if (state.started && !state.paused && !state.gameOver) {
    state.fireCooldown = Math.max(0, state.fireCooldown - dt)
    state.interactionCooldown = Math.max(0, state.interactionCooldown - dt)
    expandedWorld.update(dt, elapsed)
    if (state.fireHeld) fireWeapon()
    if (state.reloading) {
      state.reloadTimer -= dt
      if (state.reloadTimer <= 0) finishReload()
    }
    updatePlayer(dt)
    updateZombies(dt, elapsed)
    updateWave(dt)
    updateHealthRecovery(dt)
  }
  atmosphereFrame += 1
  if (!isTouch || atmosphereFrame % 2 === 0) {
    updateAtmosphere(isTouch ? dt * 2 : dt, elapsed)
  }
  soundscape.update(dt)
  renderer.render(scene, camera)
}

updateQuestStrip()
refreshPauseSettings()
updateHud()
camera.position.copy(player.position)
camera.rotation.set(player.pitch, player.yaw, 0)
animate()
