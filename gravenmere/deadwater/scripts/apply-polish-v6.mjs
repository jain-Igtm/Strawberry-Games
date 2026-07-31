import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mainPath = resolve(import.meta.dirname, '../src/main.ts')
const terrainPath = resolve(import.meta.dirname, '../src/terrain-v5.ts')
let source = readFileSync(mainPath, 'utf8')
let terrain = readFileSync(terrainPath, 'utf8')
const marker = '// DEADWATER_POLISH_V6'

function replaceMain(label, search, replacement) {
  const next = source.replace(search, replacement)
  if (next === source) throw new Error(`Could not apply polish v6: ${label}`)
  source = next
}

function replaceTerrain(label, search, replacement) {
  const next = terrain.replace(search, replacement)
  if (next === terrain) throw new Error(`Could not apply terrain polish v6: ${label}`)
  terrain = next
}

if (!terrain.includes('// DEADWATER_NATURAL_TERRAIN_V6')) {
  replaceTerrain(
    'hill definitions',
    /type Hill = \{[\s\S]*?\n\]\n/,
    `// DEADWATER_NATURAL_TERRAIN_V6
type Hill = {
  x: number
  z: number
  radiusX: number
  radiusZ: number
  height: number
  rotation: number
  seed: number
}

type TerrainClearance = {
  x: number
  z: number
  radius: number
}

const hills: Hill[] = [
  { x: -103, z: 73, radiusX: 27, radiusZ: 19, height: 7.4, rotation: -0.28, seed: 1.7 },
  { x: -111, z: -49, radiusX: 24, radiusZ: 26, height: 7.0, rotation: 0.22, seed: 3.1 },
  { x: 76, z: 75, radiusX: 25, radiusZ: 18, height: 8.0, rotation: 0.36, seed: 4.8 },
  { x: 137, z: -66, radiusX: 25, radiusZ: 22, height: 6.8, rotation: -0.18, seed: 6.2 },
  { x: -29, z: -97, radiusX: 27, radiusZ: 18, height: 6.2, rotation: 0.15, seed: 8.4 },
  { x: 30, z: 119, radiusX: 19, radiusZ: 13, height: 4.8, rotation: -0.42, seed: 10.1 },
]

const terrainClearances: TerrainClearance[] = [
  { x: 62, z: 104, radius: 13 }, { x: -55, z: 91, radius: 12 },
  { x: -118, z: -4, radius: 13 }, { x: 111, z: -72, radius: 13 },
  { x: 20, z: -108, radius: 14 }, { x: 116, z: 34, radius: 13 },
  { x: 202, z: -58, radius: 13 }, { x: -72, z: 64, radius: 8 },
  { x: 92, z: -58, radius: 8 }, { x: 211, z: -48, radius: 8 },
  { x: 43, z: 69, radius: 8 }, { x: 70, z: 136, radius: 9 },
  { x: 184, z: -58, radius: 8 }, { x: -151, z: -18, radius: 8 },
  { x: -50, z: 72, radius: 6 }, { x: 105, z: 31, radius: 6 },
  { x: 58, z: 112, radius: 6 }, { x: 70, z: 145, radius: 7 },
  { x: -6, z: 32, radius: 8 }, { x: 39, z: -20, radius: 7 },
  { x: -44, z: 17, radius: 7 }, { x: 17, z: -37, radius: 8 },
  { x: 45, z: 22, radius: 7 },
]
`,
  )

  replaceTerrain(
    'height profile',
    /export function terrainHeightAt\(x: number, z: number\): number \{[\s\S]*?\n\}/,
    `function clearanceMultiplierAt(x: number, z: number): number {
  let multiplier = 1
  for (const zone of terrainClearances) {
    const distance = Math.hypot(x - zone.x, z - zone.z)
    if (distance <= zone.radius) return 0
    if (distance < zone.radius + 7) {
      const blend = (distance - zone.radius) / 7
      multiplier = Math.min(multiplier, blend * blend * (3 - 2 * blend))
    }
  }
  return multiplier
}

function hillHeightAt(hill: Hill, x: number, z: number): number {
  const dx = x - hill.x
  const dz = z - hill.z
  const cosine = Math.cos(hill.rotation)
  const sine = Math.sin(hill.rotation)
  const localX = dx * cosine + dz * sine
  const localZ = -dx * sine + dz * cosine
  const normalizedX = localX / hill.radiusX
  const normalizedZ = localZ / hill.radiusZ
  const angle = Math.atan2(normalizedZ, normalizedX)
  const edgeWobble =
    1 +
    Math.sin(angle * 3 + hill.seed) * 0.075 +
    Math.sin(angle * 5 - hill.seed * 0.63) * 0.038
  const distance = Math.hypot(normalizedX, normalizedZ) / edgeWobble
  if (distance >= 1) return 0
  const broadSlope = Math.pow(1 - distance * distance, 1.72)
  const erosion = 0.94 + Math.sin(angle * 2.2 + hill.seed) * 0.035
  return broadSlope * hill.height * erosion * clearanceMultiplierAt(x, z)
}

export function terrainHeightAt(x: number, z: number): number {
  if (!isLandAt(x, z)) return 0
  let height = 0
  for (const hill of hills) height = Math.max(height, hillHeightAt(hill, x, z))
  return height
}`,
  )

  replaceTerrain(
    'natural walkable hill meshes',
    /function addHillMeshes\(scene: THREE\.Scene, materials: [\s\S]*?\): void \{[\s\S]*?\n\}\n\nfunction addRoadNetwork/,
    `function addHillMeshes(scene: THREE.Scene, materials: TerrainBuildContext['materials']): void {
  const hillMaterial = materials.island.clone()
  hillMaterial.color.setHex(0x372b21)
  hillMaterial.flatShading = true
  hillMaterial.side = THREE.DoubleSide

  const rings = 7
  const segments = 16
  for (const hill of hills) {
    const positions: number[] = []
    const indices: number[] = []
    const cosine = Math.cos(hill.rotation)
    const sine = Math.sin(hill.rotation)

    positions.push(hill.x, terrainHeightAt(hill.x, hill.z) + 0.018, hill.z)
    for (let ring = 1; ring <= rings; ring += 1) {
      const radial = ring / rings
      for (let segment = 0; segment < segments; segment += 1) {
        const angle = (segment / segments) * Math.PI * 2
        const edgeWobble =
          1 +
          Math.sin(angle * 3 + hill.seed) * 0.075 +
          Math.sin(angle * 5 - hill.seed * 0.63) * 0.038
        const localX = Math.cos(angle) * hill.radiusX * radial * edgeWobble
        const localZ = Math.sin(angle) * hill.radiusZ * radial * edgeWobble
        const worldX = hill.x + localX * cosine - localZ * sine
        const worldZ = hill.z + localX * sine + localZ * cosine
        const surfaceY = terrainHeightAt(worldX, worldZ)
        positions.push(worldX, surfaceY + (ring === rings ? 0.012 : 0.018), worldZ)
      }
    }

    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments
      indices.push(0, 1 + segment, 1 + next)
    }
    for (let ring = 1; ring < rings; ring += 1) {
      const innerStart = 1 + (ring - 1) * segments
      const outerStart = 1 + ring * segments
      for (let segment = 0; segment < segments; segment += 1) {
        const next = (segment + 1) % segments
        const inner = innerStart + segment
        const innerNext = innerStart + next
        const outer = outerStart + segment
        const outerNext = outerStart + next
        indices.push(inner, outer, innerNext, innerNext, outer, outerNext)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, hillMaterial)
    mesh.renderOrder = 1
    scene.add(mesh)
  }
}

function addRoadNetwork`,
  )
  writeFileSync(terrainPath, terrain)
}

if (source.includes(marker)) {
  console.log('Deadwater polish v6 already applied.')
  process.exit(0)
}

replaceMain(
  'soundscape import',
  "import { DeadwaterSoundscapeV5 } from './soundscape-v5'",
  "import { DeadwaterSoundscapeV6 } from './soundscape-v6'",
)
replaceMain(
  'soundscape instance',
  'const soundscape = new DeadwaterSoundscapeV5()',
  'const soundscape = new DeadwaterSoundscapeV6()',
)
replaceMain(
  'polish stylesheet',
  "import './expansion-v5.css'",
  "import './expansion-v5.css'\nimport './polish-v6.css'",
)
replaceMain(
  'polish marker',
  '// DEADWATER_EXPANSION_V5',
  `// DEADWATER_EXPANSION_V5
${marker}`,
)
replaceMain(
  'remove enclosing sphere artifact',
  /  const sky = new THREE\.Mesh\([\s\S]*?\n  scene\.add\(sky\)\n/,
  `  // Background color and fog provide the sky. The enclosing sphere was removed
  // because some mobile GPUs intermittently exposed it as a dark circular obstruction.
`,
)

replaceMain(
  'camera and settings state',
  `  lookSensitivityIndex: 1,
  scoped: false,
  vehicle: null as Driveable | null,`,
  `  lookSensitivityIndex: 1,
  brightnessIndex: 1,
  scoped: false,
  vehicleLookYaw: 0,
  vehicleLookPitch: -0.18,
  vehicle: null as Driveable | null,`,
)

replaceMain(
  'pause menu controls',
  `const switchButton = createHudButton('switch-button', 'SWP', 'round-action--switch')
const scopeButton = createHudButton('scope-button', 'SCP', 'round-action--scope')
const sensitivityButton = createHudButton('sensitivity-button', 'LOOK', 'round-action--sense')
const scopeOverlay = document.createElement('div')`,
  `const switchButton = createHudButton('switch-button', 'SWP', 'round-action--switch')
const scopeButton = createHudButton('scope-button', 'ADS', 'round-action--scope')
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
const scopeOverlay = document.createElement('div')`,
)

replaceMain(
  'pause and settings functions',
  'function currentUpgradeLevel(): number {',
  `const BRIGHTNESS_LEVELS = [0.72, 0.92, 1.14, 1.34] as const
const BRIGHTNESS_LABELS = ['DARK', 'STANDARD', 'BRIGHT', 'VERY BRIGHT'] as const
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

function currentUpgradeLevel(): number {`,
)

replaceMain(
  'universal ads',
  /function setScoped\(enabled: boolean\): void \{[\s\S]*?\n\}\n\nfunction toggleScope\(\): void \{[\s\S]*?\n\}/,
  `function setScoped(enabled: boolean): void {
  const definition = WEAPONS[state.weaponId]
  const hasScope = Boolean(definition.scopeFov)
  state.scoped = enabled && !state.vehicle
  camera.fov = state.scoped ? definition.scopeFov ?? 54 : 69
  camera.updateProjectionMatrix()
  scopeOverlay.classList.toggle('visible', state.scoped && hasScope)
  ui.hud.classList.toggle('aiming', state.scoped)
  ui.hud.classList.toggle('scoped', state.scoped && hasScope)
  scopeButton.textContent = state.scoped ? 'HIP' : 'ADS'
  gun.visible = !state.vehicle && !(state.scoped && hasScope)
}

function toggleScope(): void {
  setScoped(!state.scoped)
}`,
)

replaceMain(
  'vehicle look reset on entry',
  `  state.vehicle = vehicle
  state.elevatedTower = null`,
  `  state.vehicle = vehicle
  state.vehicleLookYaw = 0
  state.vehicleLookPitch = -0.18
  state.elevatedTower = null`,
)
replaceMain(
  'vehicle look orientation on exit',
  `  player.position.y = expandedWorld.heightAt(sideX, sideZ) + 1.7
  state.vehicle = null
  soundscape.stopVehicle()`,
  `  player.position.y = expandedWorld.heightAt(sideX, sideZ) + 1.7
  player.yaw = vehicle.yaw + state.vehicleLookYaw
  player.pitch = state.vehicleLookPitch
  state.vehicle = null
  state.vehicleLookYaw = 0
  state.vehicleLookPitch = -0.18
  soundscape.stopVehicle()`,
)

replaceMain(
  'vehicle orbit camera',
  `    player.yaw = vehicle.yaw
    player.pitch = -0.2
    const behindX = Math.sin(vehicle.yaw) * 5.6
    const behindZ = Math.cos(vehicle.yaw) * 5.6
    camera.position.set(
      vehicle.group.position.x + behindX,
      vehicle.group.position.y + 3.6,
      vehicle.group.position.z + behindZ,
    )
    camera.lookAt(
      vehicle.group.position.x - Math.sin(vehicle.yaw) * 5.5,
      vehicle.group.position.y + 1.1,
      vehicle.group.position.z - Math.cos(vehicle.yaw) * 5.5,
    )`,
  `    player.yaw = vehicle.yaw
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
    )`,
)

replaceMain(
  'iron sight gun positioning',
  `  gun.position.set(
    weaponViewBase.x + gunBobX,
    weaponViewBase.y - gunBobY - state.recoil * 0.04,
    weaponViewBase.z + state.recoil * 0.08,
  )
  gun.rotation.x = -state.recoil * 0.12
  gun.visible = !state.scoped`,
  `  const hasOptic = Boolean(WEAPONS[state.weaponId].scopeFov)
  const ironSights = state.scoped && !hasOptic
  gun.position.set(
    ironSights ? 0.012 : weaponViewBase.x + gunBobX,
    ironSights ? -0.185 - state.recoil * 0.025 : weaponViewBase.y - gunBobY - state.recoil * 0.04,
    ironSights ? weaponViewBase.z - 0.08 + state.recoil * 0.045 : weaponViewBase.z + state.recoil * 0.08,
  )
  gun.rotation.x = -state.recoil * (ironSights ? 0.07 : 0.12)
  gun.rotation.y = ironSights ? 0 : -0.035
  gun.visible = !state.vehicle && !(state.scoped && hasOptic)`,
)

replaceMain(
  'touch look vehicle camera',
  `  const lookScale = LOOK_SENSITIVITIES[state.lookSensitivityIndex]
  player.yaw -= dx * 0.0048 * lookScale
  player.pitch -= dy * 0.0042 * lookScale
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.18, 1.04)`,
  `  const lookScale = LOOK_SENSITIVITIES[state.lookSensitivityIndex]
  if (state.vehicle) {
    state.vehicleLookYaw -= dx * 0.0048 * lookScale
    state.vehicleLookPitch -= dy * 0.0042 * lookScale
    state.vehicleLookPitch = THREE.MathUtils.clamp(state.vehicleLookPitch, -0.72, 0.62)
  } else {
    player.yaw -= dx * 0.0048 * lookScale
    player.pitch -= dy * 0.0042 * lookScale
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.18, 1.04)
  }`,
)

replaceMain(
  'pause action listeners',
  `sensitivityButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  state.lookSensitivityIndex = nextSensitivityIndex(state.lookSensitivityIndex)
  const labels = ['NORMAL', 'FAST', 'VERY FAST']
  showToast('LOOK: ' + labels[state.lookSensitivityIndex], 1.2)
})`,
  `pauseButton.addEventListener('pointerdown', (event) => {
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
})`,
)

replaceMain(
  'mouse vehicle camera',
  `  const lookScale = LOOK_SENSITIVITIES[state.lookSensitivityIndex]
  player.yaw -= event.movementX * 0.0021 * lookScale
  player.pitch -= event.movementY * 0.0019 * lookScale
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.18, 1.04)`,
  `  const lookScale = LOOK_SENSITIVITIES[state.lookSensitivityIndex]
  if (state.vehicle) {
    state.vehicleLookYaw -= event.movementX * 0.0021 * lookScale
    state.vehicleLookPitch -= event.movementY * 0.0019 * lookScale
    state.vehicleLookPitch = THREE.MathUtils.clamp(state.vehicleLookPitch, -0.72, 0.62)
  } else {
    player.yaw -= event.movementX * 0.0021 * lookScale
    player.pitch -= event.movementY * 0.0019 * lookScale
    player.pitch = THREE.MathUtils.clamp(player.pitch, -1.18, 1.04)
  }`,
)

replaceMain(
  'keyboard pause',
  `  if (event.code === 'KeyC') toggleScope()
  if (event.code === 'Escape') document.exitPointerLock?.()`,
  `  if (event.code === 'KeyC') toggleScope()
  if (event.code === 'Escape') {
    setPaused(!state.paused)
    if (state.paused) document.exitPointerLock?.()
  }`,
)

replaceMain(
  'android back pause',
  `void App.addListener('backButton', () => {
  if (state.gameOver || !state.started) return
  state.paused = !state.paused
  showToast(state.paused ? 'PAUSED' : 'RESUMED', 1)
})`,
  `void App.addListener('backButton', () => {
  if (state.gameOver || !state.started) return
  setPaused(!state.paused)
})`,
)

replaceMain(
  'start unpaused',
  `  state.started = true
  state.paused = false`,
  `  state.started = true
  setPaused(false)`,
)
replaceMain(
  'game over closes pause',
  `  state.gameOver = true
  state.fireHeld = false`,
  `  state.gameOver = true
  setPaused(false)
  state.fireHeld = false`,
)
replaceMain(
  'initialize pause settings',
  `updateQuestStrip()
updateHud()`,
  `updateQuestStrip()
refreshPauseSettings()
updateHud()`,
)

writeFileSync(mainPath, source)
console.log('Applied Deadwater polish v6: natural walkable hills, ADS, pause settings, free-look vehicles, audio, and circle fixes.')
