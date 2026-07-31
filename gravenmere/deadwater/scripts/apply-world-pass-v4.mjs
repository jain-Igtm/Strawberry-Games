import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/main.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_WORLD_PASS_V4'

if (source.includes(marker)) {
  console.log('Deadwater world pass v4 already applied.')
  process.exit(0)
}

function replaceRequired(label, search, replacement) {
  const next = source.replace(search, replacement)
  if (next === source) throw new Error(`Could not apply world pass v4: ${label}`)
  source = next
}

replaceRequired(
  'imports',
  "import './styles.css'",
  `import { buildExpandedInfrastructure, type WeaponPickup } from './environment'
import { DeadwaterSoundscape } from './soundscape'
import { WEAPONS, type WeaponId } from './weapons'
import { createRoundedZombieVisual } from './zombie-model'
import './styles.css'`,
)

replaceRequired(
  'marker',
  '// DEADWATER_CONTROLS_V3',
  `// DEADWATER_CONTROLS_V3\n${marker}`,
)

replaceRequired(
  'weapon label',
  '}\n\nconst isTouch =',
  `}

const weaponLabel = ui.ammoPanel.querySelector<HTMLElement>('span')!

const isTouch =`,
)

replaceRequired(
  'weapon state',
  '  score: 0,\n  bannerTimer: 0,',
  `  score: 0,
  weaponId: 'carbine' as WeaponId,
  weaponPickupCooldown: 0,
  bannerTimer: 0,`,
)

replaceRequired(
  'concrete polygon offset',
  "concrete: new THREE.MeshStandardMaterial({ color: 0x45413b, roughness: 0.96 }),",
  `concrete: new THREE.MeshStandardMaterial({
    color: 0x45413b,
    roughness: 0.96,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }),`,
)
replaceRequired(
  'cracked polygon offset',
  "cracked: new THREE.MeshStandardMaterial({ color: 0x292823, roughness: 1 }),",
  `cracked: new THREE.MeshStandardMaterial({
    color: 0x292823,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  }),`,
)
replaceRequired(
  'ring polygon offset',
  "new THREE.MeshStandardMaterial({ color: 0x34302b, roughness: 1, side: THREE.DoubleSide }),",
  `new THREE.MeshStandardMaterial({
      color: 0x34302b,
      roughness: 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),`,
)

replaceRequired(
  'central slab elevation',
  'const central = cylinder(21, 21, 0.18, 24, mats.concrete, 0, 0.04, 0)',
  'const central = cylinder(21, 21, 0.16, 24, mats.concrete, 0, 0.08, 0)',
)
replaceRequired(
  'north road elevation',
  'const roadNorth = box(12, 0.16, 72, mats.cracked, 0, 0.05, -3)',
  'const roadNorth = box(12, 0.12, 72, mats.cracked, 0, 0.16, -3)',
)
replaceRequired(
  'east road elevation',
  'const roadEast = box(74, 0.16, 12, mats.cracked, 3, 0.06, 0)',
  'const roadEast = box(74, 0.12, 12, mats.cracked, 3, 0.16, 0)',
)
replaceRequired(
  'diagonal a elevation',
  'const diagonalA = box(10, 0.15, 58, mats.concrete, -1, 0.055, 0)',
  'const diagonalA = box(10, 0.1, 58, mats.concrete, -1, 0.235, 0)',
)
replaceRequired(
  'diagonal b elevation',
  'const diagonalB = box(10, 0.15, 58, mats.concrete, 1, 0.055, 0)',
  'const diagonalB = box(10, 0.1, 58, mats.concrete, 1, 0.235, 0)',
)
replaceRequired('ring elevation', 'ring.position.y = 0.065', 'ring.position.y = 0.115')

replaceRequired(
  'expanded infrastructure',
  'buildIsland()\n\nconst emberCount',
  `buildIsland()

const weaponPickups: WeaponPickup[] = buildExpandedInfrastructure({
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

const emberCount`,
)

replaceRequired(
  'weapon visual and pickup logic',
  'camera.add(gun)\n\nfunction circleHitsCollider',
  `camera.add(gun)

const weaponAccentMaterial = mats.warning.clone()
sidePlate.material = weaponAccentMaterial
const weaponViewBase = new THREE.Vector3(0.34, -0.29, -0.61)

function applyWeaponVisual(): void {
  const definition = WEAPONS[state.weaponId]
  gun.scale.set(...definition.viewScale)
  weaponViewBase.set(...definition.viewPosition)
  weaponAccentMaterial.color.setHex(definition.accent)
  weaponAccentMaterial.emissive.setHex(definition.accent)
  weaponAccentMaterial.emissiveIntensity = 0.16
  weaponLabel.textContent = definition.name
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
    state.weaponId = pickup.weaponId
    const definition = WEAPONS[state.weaponId]
    state.ammo = definition.magazineSize
    state.reserve = definition.startingReserve
    state.reloading = false
    state.reloadTimer = 0
    applyWeaponVisual()
    soundscape.pickup()
    showToast(`${definition.name} ACQUIRED`, 2.1)
    updateHud()
  }
}

applyWeaponVisual()

function circleHitsCollider`,
)

replaceRequired(
  'rounded zombie model',
  /function createZombie\(position: THREE\.Vector3\): Zombie \{[\s\S]*?\n\}\n\nfunction removeZombie/,
  `function createZombie(position: THREE.Vector3): Zombie {
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
  const runner = Math.random() < Math.min(0.3, 0.12 + state.wave * 0.012)

  const zombie: Zombie = {
    group,
    parts: visual.parts,
    head: visual.head,
    health: tuning.health,
    maxHealth: tuning.health,
    speed: tuning.speed * (0.92 + Math.random() * 0.24) * (runner ? 1.22 : 1),
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

function removeZombie`,
)

replaceRequired(
  'soundscape engine',
  /let audioContext: AudioContext \| null = null[\s\S]*?\n\}\n\nfunction showBanner/,
  `const soundscape = new DeadwaterSoundscape()

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

function showBanner`,
)

replaceRequired(
  'hud weapon name',
  "ui.ammoPanel.classList.toggle('reloading', state.reloading)",
  `ui.ammoPanel.classList.toggle('reloading', state.reloading)
  weaponLabel.textContent = WEAPONS[state.weaponId].name`,
)

replaceRequired(
  'finish wave magazine size',
  `  if (state.ammo < 30) {
    const needed = 30 - state.ammo
    const loaded = Math.min(needed, state.reserve)
    state.ammo += loaded
    state.reserve -= loaded
  }`,
  `  const weapon = WEAPONS[state.weaponId]
  if (state.ammo < weapon.magazineSize) {
    const needed = weapon.magazineSize - state.ammo
    const loaded = Math.min(needed, state.reserve)
    state.ammo += loaded
    state.reserve -= loaded
  }`,
)

replaceRequired(
  'reload functions',
  /function beginReload\(\): void \{[\s\S]*?\n\}\n\nfunction finishReload\(\): void \{[\s\S]*?\n\}/,
  `function beginReload(): void {
  const weapon = WEAPONS[state.weaponId]
  if (state.reloading || state.ammo >= weapon.magazineSize || state.reserve <= 0 || state.gameOver) return
  state.reloading = true
  state.reloadTimer = weapon.reloadTime
  soundscape.reload()
  showToast('RELOADING', 1.2)
  updateHud()
}

function finishReload(): void {
  const weapon = WEAPONS[state.weaponId]
  const needed = weapon.magazineSize - state.ammo
  const amount = Math.min(needed, state.reserve)
  state.ammo += amount
  state.reserve -= amount
  state.reloading = false
  updateHud()
}`,
)

replaceRequired(
  'weapon firing',
  /function fireWeapon\(\): void \{[\s\S]*?\n\}\n\nfunction endRun/,
  `function fireWeapon(): void {
  if (!state.started || state.gameOver || state.reloading || state.fireCooldown > 0) return
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
    const damage = (weapon.damage + waveBonus) * (headshot ? weapon.headshotMultiplier : 1)
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

function endRun`,
)

replaceRequired('game over sound', 'noiseBurst(0.5, 0.12, 280)', 'soundscape.gameOver()')

replaceRequired(
  'reset weapon state',
  `  state.ammo = 30
  state.reserve = 180`,
  `  state.weaponId = 'carbine'
  const startingWeapon = WEAPONS.carbine
  state.ammo = startingWeapon.magazineSize
  state.reserve = startingWeapon.startingReserve`,
)
replaceRequired(
  'reset pickups and view',
  `  ui.gameOverScreen.classList.remove('screen--visible')`,
  `  resetWeaponPickups()
  applyWeaponVisual()
  ui.gameOverScreen.classList.remove('screen--visible')`,
)
replaceRequired(
  'start soundscape',
  `  ensureAudio()
  void StatusBar.hide()`,
  `  soundscape.start()
  void StatusBar.hide()`,
)

replaceRequired(
  'gun camera-relative position',
  `gun.position.set(0.34 + gunBobX, -0.29 - gunBobY - state.recoil * 0.04, -0.62 + state.recoil * 0.08)`,
  `gun.position.set(
    weaponViewBase.x + gunBobX,
    weaponViewBase.y - gunBobY - state.recoil * 0.04,
    weaponViewBase.z + state.recoil * 0.08,
  )`,
)
replaceRequired(
  'pickup update',
  `  camera.rotation.set(player.pitch, player.yaw, 0)

  const gunBobX`,
  `  camera.rotation.set(player.pitch, player.yaw, 0)
  updateWeaponPickups(dt, elapsed)

  const gunBobX`,
)

replaceRequired(
  'limb animation',
  `    const leftArm = zombie.parts[3]
    const rightArm = zombie.parts[4]
    leftArm.rotation.x = -0.85 + Math.sin(walk) * 0.16
    rightArm.rotation.x = -0.85 - Math.sin(walk) * 0.16`,
  `    const leftArm = zombie.parts[3]
    const rightArm = zombie.parts[4]
    const leftLeg = zombie.parts[5]
    const rightLeg = zombie.parts[6]
    leftArm.rotation.x = -0.78 + Math.sin(walk) * 0.28
    rightArm.rotation.x = -0.84 - Math.sin(walk) * 0.28
    leftLeg.rotation.x = Math.sin(walk) * 0.24
    rightLeg.rotation.x = -Math.sin(walk) * 0.24`,
)
replaceRequired(
  'attack sound',
  `      zombie.attackTimer = zombie.attackDelay
      damagePlayer(zombie.damage)`,
  `      zombie.attackTimer = zombie.attackDelay
      soundscape.zombieAttack()
      damagePlayer(zombie.damage)`,
)

replaceRequired(
  'soundscape update',
  `  if (!isTouch || atmosphereFrame % 2 === 0) {
    updateAtmosphere(isTouch ? dt * 2 : dt, elapsed)
  }
  renderer.render(scene, camera)`,
  `  if (!isTouch || atmosphereFrame % 2 === 0) {
    updateAtmosphere(isTouch ? dt * 2 : dt, elapsed)
  }
  soundscape.update(dt)
  renderer.render(scene, camera)`,
)

writeFileSync(sourcePath, source)
console.log('Applied Deadwater world pass v4: infrastructure, weapons, rounded zombies, soundscape, and z-fighting fixes.')
