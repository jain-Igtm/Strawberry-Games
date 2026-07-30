import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/main.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_EXPANSION_V5'

if (source.includes(marker)) {
  console.log('Deadwater expansion v5 already applied.')
  process.exit(0)
}

function replaceRequired(label, search, replacement) {
  const next = source.replace(search, replacement)
  if (next === source) throw new Error(`Could not apply expansion v5: ${label}`)
  source = next
}

replaceRequired(
  'soundscape and expansion imports',
  "import { DeadwaterSoundscape } from './soundscape'",
  `import { DeadwaterSoundscapeV5 } from './soundscape-v5'
import {
  LOOK_SENSITIVITIES,
  canRepairBoat,
  nextSensitivityIndex,
  upgradeCost,
  weaponDamageMultiplier,
} from './expansion-rules'
import { buildWorldExpansion } from './world-expansion'
import type { Driveable, TowerAccess } from './world-objects-v5'`,
)

replaceRequired(
  'expansion stylesheet',
  "import './styles.css'",
  `import './styles.css'
import './expansion-v5.css'`,
)

replaceRequired(
  'expansion marker',
  '// DEADWATER_WORLD_PASS_V4',
  `// DEADWATER_WORLD_PASS_V4
${marker}`,
)

replaceRequired('larger sky', 'new THREE.SphereGeometry(160, 24, 12)', 'new THREE.SphereGeometry(420, 24, 12)')
replaceRequired('larger ocean', 'new THREE.PlaneGeometry(330, 330)', 'new THREE.PlaneGeometry(720, 720)')
replaceRequired('expanded fog', 'scene.fog = new THREE.FogExp2(0x2a130d, 0.0125)', 'scene.fog = new THREE.FogExp2(0x2a130d, 0.0092)')
replaceRequired(
  'expanded camera range',
  'const camera = new THREE.PerspectiveCamera(69, innerWidth / innerHeight, 0.06, 190)',
  'const camera = new THREE.PerspectiveCamera(69, innerWidth / innerHeight, 0.06, 360)',
)
replaceRequired('expanded weapon range', 'raycaster.far = 80', 'raycaster.far = 170')
replaceRequired('v5 soundscape', 'const soundscape = new DeadwaterSoundscape()', 'const soundscape = new DeadwaterSoundscapeV5()')
replaceRequired('faster walk speed', '  walkSpeed: 5.35,', '  walkSpeed: 7.45,')
replaceRequired('remove sprint speed difference', '  sprintSpeed: 8.15,', '  sprintSpeed: 7.45,')

replaceRequired(
  'expanded run state',
  `  weaponId: 'carbine' as WeaponId,
  weaponPickupCooldown: 0,
  bannerTimer: 0,`,
  `  weaponId: 'carbine' as WeaponId,
  weaponPickupCooldown: 0,
  weaponSlots: ['carbine'] as WeaponId[],
  weaponIndex: 0,
  weaponAmmo: {} as Partial<Record<WeaponId, { ammo: number; reserve: number }>>,
  weaponLevels: {} as Partial<Record<WeaponId, number>>,
  lookSensitivityIndex: 1,
  scoped: false,
  vehicle: null as Driveable | null,
  elevatedTower: null as TowerAccess | null,
  collectedParts: new Set<string>(),
  interactionCooldown: 0,
  bannerTimer: 0,`,
)

replaceRequired(
  'expanded hud controls',
  `const weaponLabel = ui.ammoPanel.querySelector<HTMLElement>('span')!

const isTouch =`,
  `const weaponLabel = ui.ammoPanel.querySelector<HTMLElement>('span')!
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
const scopeButton = createHudButton('scope-button', 'SCP', 'round-action--scope')
const sensitivityButton = createHudButton('sensitivity-button', 'LOOK', 'round-action--sense')
const scopeOverlay = document.createElement('div')
scopeOverlay.id = 'scope-overlay'
ui.hud.append(scopeOverlay)
const interactionPrompt = document.createElement('div')
interactionPrompt.id = 'interaction-prompt'
ui.hud.append(interactionPrompt)
const questStrip = document.createElement('div')
questStrip.id = 'quest-strip'
ui.hud.append(questStrip)
const vehicleStatus = document.createElement('div')
vehicleStatus.id = 'vehicle-status'
ui.hud.append(vehicleStatus)

const isTouch =`,
)

replaceRequired(
  'expanded world creation',
  `const emberCount = isTouch ? 82 : 180`,
  `const expandedWorld = buildWorldExpansion({
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
  },
  shotTargets,
  addCollider,
})
weaponPickups.push(...expandedWorld.weaponPickups)
spawnPoints.length = 0
spawnPoints.push(...expandedWorld.spawnPoints)

const emberCount = isTouch ? 82 : 180`,
)

replaceRequired(
  'expanded walkable island',
  /function insideIsland\(x: number, z: number, margin = 0\): boolean \{[\s\S]*?\n\}/,
  `function insideIsland(x: number, z: number, margin = 0): boolean {
  void margin
  return expandedWorld.isWalkableAt(x, z)
}`,
)

replaceRequired(
  'nearby spawn selection',
  /function nearestSpawnPoint\(\): THREE\.Vector3 \{[\s\S]*?\n\}/,
  `function nearestSpawnPoint(): THREE.Vector3 {
  const preferred = spawnPoints.filter((point) => {
    const distanceSquared = point.distanceToSquared(player.position)
    return distanceSquared > 34 * 34 && distanceSquared < 82 * 82
  })
  const distant = spawnPoints.filter((point) => point.distanceToSquared(player.position) > 30 * 30)
  const pool = preferred.length > 0 ? preferred : distant.length > 0 ? distant : spawnPoints
  const base = pool[Math.floor(Math.random() * pool.length)]
  const tangent = new THREE.Vector3(-base.z, 0, base.x)
    .normalize()
    .multiplyScalar((Math.random() - 0.5) * 8)
  return base.clone().add(tangent)
}`,
)

replaceRequired(
  'inventory and interaction systems',
  'function resetWeaponPickups(): void {',
  `function currentUpgradeLevel(): number {
  return state.weaponLevels[state.weaponId] ?? 0
}

function ensureWeaponAmmo(id: WeaponId): { ammo: number; reserve: number } {
  let record = state.weaponAmmo[id]
  if (!record) {
    const definition = WEAPONS[id]
    record = { ammo: definition.magazineSize, reserve: definition.startingReserve }
    state.weaponAmmo[id] = record
  }
  return record
}

function syncCurrentWeaponAmmo(): void {
  state.weaponAmmo[state.weaponId] = { ammo: state.ammo, reserve: state.reserve }
}

function setScoped(enabled: boolean): void {
  const definition = WEAPONS[state.weaponId]
  state.scoped = enabled && Boolean(definition.scopeFov) && !state.vehicle
  camera.fov = state.scoped ? definition.scopeFov ?? 28 : 69
  camera.updateProjectionMatrix()
  scopeOverlay.classList.toggle('visible', state.scoped)
  ui.hud.classList.toggle('scoped', state.scoped)
  gun.visible = !state.scoped && !state.vehicle
}

function toggleScope(): void {
  if (!WEAPONS[state.weaponId].scopeFov) {
    showToast('THIS WEAPON HAS NO SCOPE', 1.4)
    return
  }
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
    record.ammo = Math.max(record.ammo, definition.magazineSize)
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
  state.interactionCooldown = 0
  setScoped(false)
  soundscape.stopVehicle()
  vehicleStatus.classList.remove('visible')
  for (const pickup of expandedWorld.questPickups) {
    pickup.active = true
    pickup.group.visible = true
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
  state.elevatedTower = null
  state.fireHeld = false
  setScoped(false)
  soundscape.enterVehicle(vehicle.kind)
  vehicleStatus.textContent = vehicle.label + ' · USE TO EXIT'
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
  state.vehicle = null
  soundscape.stopVehicle()
  vehicleStatus.classList.remove('visible')
  gun.visible = !state.scoped
}

function performInteraction(): void {
  if (state.interactionCooldown > 0 || state.gameOver) return
  state.interactionCooldown = 0.25
  if (state.vehicle) {
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
    state.ammo = definition.magazineSize
    state.reserve = Math.max(state.reserve, definition.startingReserve)
    syncCurrentWeaponAmmo()
    soundscape.upgrade()
    applyWeaponVisual()
    showToast(definition.name + ' FORGED +' + (level + 1), 2.1)
    updateHud()
  }
}

function updateInteractionPrompt(): void {
  let text = ''
  if (state.vehicle) {
    text = 'USE · EXIT ' + state.vehicle.label
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

function resetWeaponPickups(): void {`,
)

replaceRequired(
  'pickup weapon inventory',
  /    state\.weaponPickupCooldown = 1[\s\S]*?    updateHud\(\)\n  \}/,
  `    state.weaponPickupCooldown = 1
    equipWeapon(pickup.weaponId, true)
    soundscape.pickup()
  }`,
)

replaceRequired(
  'upgraded damage',
  'const damage = (weapon.damage + waveBonus) * (headshot ? weapon.headshotMultiplier : 1)',
  `const damage =
      (weapon.damage + waveBonus) *
      weaponDamageMultiplier(currentUpgradeLevel()) *
      (headshot ? weapon.headshotMultiplier : 1)`,
)

replaceRequired(
  'fire disabled in vehicles',
  'if (!state.started || state.gameOver || state.reloading || state.fireCooldown > 0) return',
  'if (!state.started || state.gameOver || state.reloading || state.fireCooldown > 0 || state.vehicle) return',
)

replaceRequired(
  'reset expansion progress',
  `  resetWeaponPickups()
  applyWeaponVisual()`,
  `  resetExpansionProgress()
  resetWeaponPickups()
  applyWeaponVisual()`,
)

replaceRequired(
  'no tower melee attacks',
  '} else if (zombie.attackTimer <= 0) {',
  '} else if (!state.elevatedTower && zombie.attackTimer <= 0) {',
)

replaceRequired(
  'zombie terrain height',
  'zombie.group.position.y = Math.abs(Math.sin(walk)) * 0.035',
  `zombie.group.position.y =
      expandedWorld.heightAt(zombie.group.position.x, zombie.group.position.z) +
      Math.abs(Math.sin(walk)) * 0.035`,
)

replaceRequired(
  'expanded player and vehicle movement',
  /function updatePlayer\(dt: number\): void \{[\s\S]*?\n\}\n\nfunction updateZombies/,
  `function updatePlayer(dt: number): void {
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
    const targetSpeed = forward * vehicle.maxSpeed
    vehicle.speed = THREE.MathUtils.damp(vehicle.speed, targetSpeed, 4.2, dt)
    if (Math.abs(forward) < 0.02) vehicle.speed = THREE.MathUtils.damp(vehicle.speed, 0, 2.7, dt)
    const steeringStrength = THREE.MathUtils.clamp(Math.abs(vehicle.speed) / Math.max(1, vehicle.maxSpeed), 0.18, 1)
    vehicle.yaw += strafe * vehicle.turnRate * dt * steeringStrength * (vehicle.speed < 0 ? -1 : 1)
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
    )
    soundscape.updateVehicle(vehicle.kind, vehicle.speed / vehicle.maxSpeed)
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
      player.position.y = expandedWorld.heightAt(player.position.x, player.position.z) + 1.7
    }
    player.bob += dt * 11.2
  } else if (!state.elevatedTower) {
    player.position.y = expandedWorld.heightAt(player.position.x, player.position.z) + 1.7
  }

  const bobY = moving && !state.scoped ? Math.sin(player.bob) * 0.04 : 0
  const bobX = moving && !state.scoped ? Math.cos(player.bob * 0.5) * 0.02 : 0
  camera.position.set(player.position.x + bobX, player.position.y + bobY, player.position.z)
  camera.rotation.set(player.pitch, player.yaw, 0)
  updateWeaponPickups(dt, elapsed)

  const gunBobX = moving ? Math.cos(player.bob * 0.5) * 0.018 : 0
  const gunBobY = moving ? Math.abs(Math.sin(player.bob)) * 0.018 : 0
  state.recoil = Math.max(0, state.recoil - dt * 7.8)
  gun.position.set(
    weaponViewBase.x + gunBobX,
    weaponViewBase.y - gunBobY - state.recoil * 0.04,
    weaponViewBase.z + state.recoil * 0.08,
  )
  gun.rotation.x = -state.recoil * 0.12
  gun.visible = !state.scoped

  ui.district.textContent = expandedWorld.districtAt(player.position.x, player.position.z)
  emberCloud.position.set(player.position.x, 0, player.position.z)
  ashCloud.position.set(player.position.x, 0, player.position.z)
  updateInteractionPrompt()
}

function updateZombies`,
)

replaceRequired(
  'faster sensitivity controls',
  `  player.yaw -= dx * 0.0048
  player.pitch -= dy * 0.0042`,
  `  const lookScale = LOOK_SENSITIVITIES[state.lookSensitivityIndex]
  player.yaw -= dx * 0.0048 * lookScale
  player.pitch -= dy * 0.0042 * lookScale`,
)

replaceRequired(
  'use button instead of sprint',
  /let sprintHeld = false[\s\S]*?ui\.sprintButton\.addEventListener\('pointercancel', endSprint\)/,
  `ui.sprintButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  performInteraction()
})`,
)

replaceRequired('remove stale sprint blur', '  sprintHeld = false\n', '')

replaceRequired(
  'new action button listeners',
  `ui.reloadButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  beginReload()
})`,
  `ui.reloadButton.addEventListener('pointerdown', (event) => {
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
sensitivityButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  state.lookSensitivityIndex = nextSensitivityIndex(state.lookSensitivityIndex)
  const labels = ['NORMAL', 'FAST', 'VERY FAST']
  showToast('LOOK: ' + labels[state.lookSensitivityIndex], 1.2)
})`,
)

replaceRequired(
  'keyboard actions',
  `  if (event.code === 'KeyR') beginReload()
  if (event.code === 'Escape') document.exitPointerLock?.()`,
  `  if (event.code === 'KeyR') beginReload()
  if (event.code === 'KeyQ') switchWeapon()
  if (event.code === 'KeyE') performInteraction()
  if (event.code === 'KeyC') toggleScope()
  if (event.code === 'Escape') document.exitPointerLock?.()`,
)

replaceRequired(
  'mouse sensitivity',
  `  player.yaw -= event.movementX * 0.0021
  player.pitch -= event.movementY * 0.0019`,
  `  const lookScale = LOOK_SENSITIVITIES[state.lookSensitivityIndex]
  player.yaw -= event.movementX * 0.0021 * lookScale
  player.pitch -= event.movementY * 0.0019 * lookScale`,
)

replaceRequired(
  'expansion update loop',
  `    state.fireCooldown = Math.max(0, state.fireCooldown - dt)
    if (state.fireHeld) fireWeapon()`,
  `    state.fireCooldown = Math.max(0, state.fireCooldown - dt)
    state.interactionCooldown = Math.max(0, state.interactionCooldown - dt)
    expandedWorld.update(dt, elapsed)
    if (state.fireHeld) fireWeapon()`,
)

replaceRequired(
  'sync ammo at reload end',
  /function finishReload\(\): void \{[\s\S]*?\n\}/,
  `function finishReload(): void {
  const weapon = WEAPONS[state.weaponId]
  const needed = weapon.magazineSize - state.ammo
  const amount = Math.min(needed, state.reserve)
  state.ammo += amount
  state.reserve -= amount
  state.reloading = false
  syncCurrentWeaponAmmo()
  updateHud()
}`,
)

replaceRequired(
  'v5 initialization',
  `updateHud()
camera.position.copy(player.position)`,
  `updateQuestStrip()
updateHud()
camera.position.copy(player.position)`,
)

writeFileSync(sourcePath, source)
console.log('Applied Deadwater expansion v5: larger island, hidden weapon inventory, scope, upgrades, towers, vehicles, and boat quest.')
