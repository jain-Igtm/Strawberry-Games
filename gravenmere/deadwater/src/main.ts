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
import { PLAYER_START } from './districts/dock-town-plan'
import type { Driveable, TowerAccess } from './world-objects-v5'
import { WEAPONS, type WeaponId } from './weapons'
import { createRoundedZombieVisual } from './zombie-model'
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
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 0.95 : 1.55))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 2.05
configureAtlasTextures(renderer)
installAshfallSky(scene, renderer)

const clock = new THREE.Clock()
const raycaster = new THREE.Raycaster()
raycaster.far = 220
const colliders: Collider[] = []
const shotTargets: THREE.Object3D[] = []
const zombies: Zombie[] = []
const animatedFires: Array<{ flame: THREE.Mesh; glow: THREE.PointLight; phase: number }> = []
const spawnPoints: THREE.Vector3[] = []
const keys = new Set<string>()

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
  ATLAS_TILES.bottomLeft,
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
  void margin
  return expandedWorld.isWalkableAt(x, z)
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
  const visual = createRoundedZombieVisual({
    skin: mats.zombieSkin,
    cloth: mats.zombieCloth,
    clothAlt: mats.zombieClothAlt,
    rust: mats.rust,
    warning: mats.warning,
    ember: mats.ember,
  })
  const group = visual.group
  const scale = 0.9 + Math.random() * 0.2
  group.position.copy(position)
  group.scale.setScalar(scale)
  const runner = Math.random() < Math.min(0.52, 0.2 + state.wave * 0.025)

  const zombie: Zombie = {
    group,
    parts: visual.parts,
    head: visual.head,
    health: tuning.health,
    maxHealth: tuning.health,
    speed: tuning.speed * (0.94 + Math.random() * 0.24) * (runner ? 1.3 : 1),
    damage: tuning.damage,
    attackDelay: tuning.attackDelay,
    attackTimer: Math.random() * 0.4,
    phase: Math.random() * Math.PI * 2,
    flashTimer: 0,
    dead: false,
  }

  for (const part of visual.parts) {
    part.userData.zombie = zombie
    part.userData.headshot = visual.headshotParts.has(part)
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
  const base = pool[Math.floor(Math.random() * pool.length)]
  const tangent = new THREE.Vector3(-base.z, 0, base.x)
    .normalize()
    .multiplyScalar((Math.random() - 0.5) * 8)
  return base.clone().add(tangent)
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
    raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera)
    const hit = raycaster.intersectObjects(shotTargets, false)[0]
    if (!hit) continue
    const zombie = hit.object.userData.zombie as Zombie | undefined
    if (!zombie || zombie.dead) continue
    hitSomething = true
    const headshot = Boolean(hit.object.userData.headshot)
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
      zombie.group.rotation.z = (Math.random() - 0.5) * 0.55
      setTimeout(() => {
        if (zombies.includes(zombie)) removeZombie(zombie)
      }, 150)
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

function updateZombies(dt: number, elapsed: number): void {
  const cellSize = 3.1
  const buckets = new Map<string, Zombie[]>()
  for (const zombie of zombies) {
    if (zombie.dead) continue
    const cellX = Math.floor(zombie.group.position.x / cellSize)
    const cellZ = Math.floor(zombie.group.position.z / cellSize)
    const key = `${cellX}:${cellZ}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(zombie)
    else buckets.set(key, [zombie])
  }

  for (const zombie of zombies) {
    if (zombie.dead) continue
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
      let separationX = 0
      let separationZ = 0
      const cellX = Math.floor(zombie.group.position.x / cellSize)
      const cellZ = Math.floor(zombie.group.position.z / cellSize)
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
          const nearby = buckets.get(`${cellX + offsetX}:${cellZ + offsetZ}`)
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
      const sway = Math.sin(elapsed * 1.6 + zombie.phase) * 0.12
      const desiredX = directionX + separationX * 0.18 - directionZ * sway
      const desiredZ = directionZ + separationZ * 0.18 + directionX * sway
      const desiredLength = Math.hypot(desiredX, desiredZ) || 1
      moveZombie(
        zombie,
        (desiredX / desiredLength) * zombie.speed * dt,
        (desiredZ / desiredLength) * zombie.speed * dt,
      )
      zombie.group.lookAt(player.position.x, zombie.group.position.y, player.position.z)
    } else if (!state.elevatedTower && zombie.attackTimer <= 0) {
      zombie.attackTimer = zombie.attackDelay
      soundscape.zombieAttack()
      damagePlayer(zombie.damage)
    }

    const walk = elapsed * zombie.speed * 4.1 + zombie.phase
    zombie.group.position.y =
      expandedWorld.heightAt(zombie.group.position.x, zombie.group.position.z) +
      Math.abs(Math.sin(walk)) * 0.035
    const leftArm = zombie.parts[3]
    const rightArm = zombie.parts[4]
    const leftLeg = zombie.parts[5]
    const rightLeg = zombie.parts[6]
    leftArm.rotation.x = -0.78 + Math.sin(walk) * 0.28
    rightArm.rotation.x = -0.84 - Math.sin(walk) * 0.28
    leftLeg.rotation.x = Math.sin(walk) * 0.24
    rightLeg.rotation.x = -Math.sin(walk) * 0.24

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
})
function endLook(event: PointerEvent): void {
  if (event.pointerId === lookPointer) lookPointer = null
}
ui.lookPad.addEventListener('pointerup', endLook)
ui.lookPad.addEventListener('pointercancel', endLook)

ui.sprintButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  performInteraction()
})

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
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 0.95 : 1.55))
  renderer.setSize(innerWidth, innerHeight)
}
addEventListener('resize', onResize)

let elapsed = 0
let atmosphereFrame = 0
function animate(): void {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.04)
  elapsed += dt
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
