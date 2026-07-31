import { buildWorld, PLAYER_START } from './map.js'
import { createTextureSet } from './textures.js'
import { RaycastEngine } from './engine.js'

const canvas = document.querySelector('#game')
const startOverlay = document.querySelector('#start-overlay')
const startButton = document.querySelector('#start-button')
const statusLine = document.querySelector('#status-line')
const healthText = document.querySelector('#health')
const ammoText = document.querySelector('#ammo')
const districtText = document.querySelector('#district')
const interactionText = document.querySelector('#interaction-text')
const fireButton = document.querySelector('#fire-button')
const interactButton = document.querySelector('#interact-button')
const fpsText = document.querySelector('#fps')
const damageOverlay = document.querySelector('#damage-overlay')

const world = buildWorld()
const textures = createTextureSet()
const renderer = new RaycastEngine(canvas, world, textures)

const player = {
  x: PLAYER_START.x,
  z: PLAYER_START.z,
  angle: PLAYER_START.angle,
  level: 0,
  health: 100,
  ammo: 48,
  velocityX: 0,
  velocityZ: 0,
  fireCooldown: 0,
  hurtCooldown: 0,
  alive: true,
}

const keys = new Set()
const touchState = {
  movePointer: null,
  lookPointer: null,
  moveStartX: 0,
  moveStartY: 0,
  moveX: 0,
  moveY: 0,
  lookLastX: 0,
  lookLastY: 0,
}

let running = false
let lastTime = performance.now()
let elapsed = 0
let sirenContext = null
let sirenGain = null
let wave = 1
let kills = 0
let spawnClock = 0
let lastInteraction = null
const zombies = []

function makeZombie(x, z, index = 0) {
  return {
    id: `zombie-${Date.now()}-${Math.random()}`,
    x,
    z,
    level: 0,
    health: 70 + wave * 7,
    speed: 1.15 + Math.min(1.5, wave * 0.08) + (index % 3) * 0.08,
    attackCooldown: 0,
    dead: false,
    scale: 0.84 + (index % 4) * 0.035,
    texture: textures.zombies[index % textures.zombies.length],
    phase: index * 1.31,
    type: 'zombie',
  }
}

function seedZombies() {
  zombies.length = 0
  const preferred = [
    [112, 63], [130, 66], [149, 67], [169, 68], [190, 67], [148, 106],
    [176, 124], [209, 181], [66, 187], [1, 182], [3, 49], [43, 6],
  ]
  preferred.forEach(([x, z], index) => {
    if (!world.isBlocked(x, z, 0)) zombies.push(makeZombie(x, z, index))
  })
  renderer.setEntities(zombies)
}

function districtAt(x, z) {
  if (player.level === 1) return 'DEADWATER BAR — UPPER FLOOR'
  if (Math.abs(z - 72) <= 6.5) return 'MAIN STREET'
  if (z < 68 && x < 100) return 'SOUTH NEIGHBORHOOD'
  if (z < 70 && x >= 100) return 'BURNING TREELINE'
  if (x >= 137 && z >= 80 && z < 133) return 'ST. AGNES HOSPITAL'
  if (x >= 94 && x < 130 && z >= 74 && z < 133) return 'BAR DISTRICT'
  if (Math.hypot(x - 66, z - 108) < 17) return 'WATER TOWER'
  if (z >= 134 && x >= 137) return 'SHOPPING DISTRICT'
  if (z >= 118 && x < 83) return 'SMALL FACTORIES'
  if (z >= 110 && x < 94) return 'SHIPYARD ROAD'
  return 'MAIN STREET'
}

function startSiren() {
  if (sirenContext) return
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return
  sirenContext = new AudioContextClass()
  const oscillatorA = sirenContext.createOscillator()
  const oscillatorB = sirenContext.createOscillator()
  sirenGain = sirenContext.createGain()
  const filter = sirenContext.createBiquadFilter()
  oscillatorA.type = 'sawtooth'
  oscillatorB.type = 'square'
  oscillatorA.frequency.value = 420
  oscillatorB.frequency.value = 210
  filter.type = 'lowpass'
  filter.frequency.value = 1200
  sirenGain.gain.value = 0.018
  oscillatorA.connect(filter)
  oscillatorB.connect(filter)
  filter.connect(sirenGain)
  sirenGain.connect(sirenContext.destination)
  oscillatorA.start()
  oscillatorB.start()
  const modulate = () => {
    if (!sirenContext) return
    const now = sirenContext.currentTime
    oscillatorA.frequency.cancelScheduledValues(now)
    oscillatorA.frequency.setValueAtTime(385, now)
    oscillatorA.frequency.linearRampToValueAtTime(610, now + 1.05)
    oscillatorA.frequency.linearRampToValueAtTime(385, now + 2.1)
    oscillatorB.frequency.cancelScheduledValues(now)
    oscillatorB.frequency.setValueAtTime(192, now)
    oscillatorB.frequency.linearRampToValueAtTime(305, now + 1.05)
    oscillatorB.frequency.linearRampToValueAtTime(192, now + 2.1)
    window.setTimeout(modulate, 2050)
  }
  modulate()
}

function begin() {
  if (running) return
  running = true
  startOverlay.hidden = true
  startSiren()
  seedZombies()
  lastTime = performance.now()
  statusLine.textContent = 'READY'
  window.__ASHFALL_READY__ = true
  requestAnimationFrame(loop)
}

function canMoveTo(x, z, level = player.level) {
  return world.canStand(x, z, 0.31, level)
}

function moveWithCollision(dx, dz) {
  const targetX = player.x + dx
  const targetZ = player.z + dz
  if (canMoveTo(targetX, player.z)) player.x = targetX
  else player.velocityX *= 0.18
  if (canMoveTo(player.x, targetZ)) player.z = targetZ
  else player.velocityZ *= 0.18
}

function updatePlayer(dt) {
  const forwardInput = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
  const strafeInput = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
  const turnInput = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)
  player.angle += turnInput * dt * 1.75

  const touchForward = -touchState.moveY
  const touchStrafe = touchState.moveX
  const forward = Math.max(-1, Math.min(1, forwardInput + touchForward))
  const strafe = Math.max(-1, Math.min(1, strafeInput + touchStrafe))
  const length = Math.hypot(forward, strafe) || 1
  const normalizedForward = forward / Math.max(1, length)
  const normalizedStrafe = strafe / Math.max(1, length)
  const speed = player.level === 1 ? 3.75 : 4.25
  const targetVX = (Math.cos(player.angle) * normalizedForward + Math.cos(player.angle + Math.PI * 0.5) * normalizedStrafe) * speed
  const targetVZ = (Math.sin(player.angle) * normalizedForward + Math.sin(player.angle + Math.PI * 0.5) * normalizedStrafe) * speed
  const response = 1 - Math.exp(-dt * 10)
  player.velocityX += (targetVX - player.velocityX) * response
  player.velocityZ += (targetVZ - player.velocityZ) * response
  if (Math.abs(forward) < 0.01 && Math.abs(strafe) < 0.01) {
    player.velocityX *= Math.exp(-dt * 9)
    player.velocityZ *= Math.exp(-dt * 9)
  }
  moveWithCollision(player.velocityX * dt, player.velocityZ * dt)
  player.fireCooldown = Math.max(0, player.fireCooldown - dt)
  player.hurtCooldown = Math.max(0, player.hurtCooldown - dt)
  lastInteraction = world.interactionAt(player.x, player.z, player.level)
}

function updateZombies(dt) {
  for (const zombie of zombies) {
    if (zombie.dead || zombie.level !== player.level) continue
    const dx = player.x - zombie.x
    const dz = player.z - zombie.z
    const distance = Math.hypot(dx, dz)
    zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt)
    if (distance < 0.82) {
      if (zombie.attackCooldown <= 0 && player.hurtCooldown <= 0) {
        player.health = Math.max(0, player.health - (7 + Math.floor(wave * 0.7)))
        player.hurtCooldown = 0.28
        zombie.attackCooldown = 0.8
        renderer.showDamage()
        damageOverlay.classList.remove('pulse')
        void damageOverlay.offsetWidth
        damageOverlay.classList.add('pulse')
      }
      continue
    }
    if (distance > 75) continue
    const speed = zombie.speed * dt
    const moveX = dx / Math.max(0.001, distance) * speed
    const moveZ = dz / Math.max(0.001, distance) * speed
    const nextX = zombie.x + moveX
    const nextZ = zombie.z + moveZ
    if (world.canStand(nextX, zombie.z, 0.25, zombie.level)) zombie.x = nextX
    if (world.canStand(zombie.x, nextZ, 0.25, zombie.level)) zombie.z = nextZ
    zombie.x += Math.sin(elapsed * 5 + zombie.phase) * dt * 0.018
  }

  for (let i = 0; i < zombies.length; i += 1) {
    const a = zombies[i]
    if (a.dead) continue
    for (let j = i + 1; j < zombies.length; j += 1) {
      const b = zombies[j]
      if (b.dead || a.level !== b.level) continue
      const dx = b.x - a.x
      const dz = b.z - a.z
      const distance = Math.hypot(dx, dz)
      if (distance > 0 && distance < 0.55) {
        const push = (0.55 - distance) * 0.5
        const nx = dx / distance
        const nz = dz / distance
        if (world.canStand(a.x - nx * push, a.z - nz * push, 0.24, a.level)) {
          a.x -= nx * push
          a.z -= nz * push
        }
        if (world.canStand(b.x + nx * push, b.z + nz * push, 0.24, b.level)) {
          b.x += nx * push
          b.z += nz * push
        }
      }
    }
  }
}

function updateSpawns(dt) {
  if (player.level !== 0) return
  spawnClock += dt
  if (spawnClock < Math.max(4.5, 10.5 - wave * 0.35)) return
  spawnClock = 0
  const living = zombies.filter((zombie) => !zombie.dead).length
  if (living >= 26) return
  const candidates = world.spawnPoints
    .map((point) => ({ ...point, distance: Math.hypot(point.x - player.x, point.z - player.z) }))
    .filter((point) => point.distance > 18 && point.distance < 95)
  if (candidates.length === 0) return
  const point = candidates[Math.floor(Math.random() * candidates.length)]
  zombies.push(makeZombie(point.x, point.z, zombies.length + kills))
}

function shoot() {
  if (!running || !player.alive || player.fireCooldown > 0 || player.ammo <= 0) return
  player.fireCooldown = 0.18
  player.ammo -= 1
  player.angle += (Math.random() - 0.5) * 0.006
  renderer.muzzleFlash()
  const target = renderer.pickTarget(player, zombies)
  if (target) {
    target.health -= 42
    if (target.health <= 0) {
      target.dead = true
      kills += 1
      if (kills % 8 === 0) wave += 1
    }
  }
  if (navigator.vibrate) navigator.vibrate(16)
}

function interact() {
  if (!running || !lastInteraction) return
  player.level = lastInteraction.targetLevel
  player.x = lastInteraction.targetX
  player.z = lastInteraction.targetZ
  player.velocityX = 0
  player.velocityZ = 0
  lastInteraction = null
}

function reload() {
  if (player.ammo >= 48) return
  player.ammo = 48
}

function updateHud() {
  healthText.textContent = String(Math.ceil(player.health))
  ammoText.textContent = String(player.ammo)
  districtText.textContent = districtAt(player.x, player.z)
  fpsText.textContent = `${Math.round(renderer.fps)} FPS · WAVE ${wave} · ${kills} KILLS`
  if (lastInteraction) {
    interactionText.textContent = lastInteraction.label
    interactionText.hidden = false
    interactButton.hidden = false
  } else {
    interactionText.hidden = true
    interactButton.hidden = true
  }
  if (player.ammo === 0) {
    interactionText.textContent = 'TAP AMMO TO RELOAD'
    interactionText.hidden = false
  }
}

function loop(now) {
  if (!running) return
  const frameDuration = Math.min(50, now - lastTime)
  const dt = frameDuration / 1000
  lastTime = now
  elapsed += dt
  updatePlayer(dt)
  updateZombies(dt)
  updateSpawns(dt)
  if (player.health <= 0 && player.alive) {
    player.alive = false
    statusLine.textContent = 'YOU DIED — TAP TO RESTART'
    startOverlay.hidden = false
    startButton.textContent = 'RESTART'
    running = false
    return
  }
  renderer.render(player, elapsed, frameDuration)
  updateHud()
  requestAnimationFrame(loop)
}

function resetGame() {
  player.x = PLAYER_START.x
  player.z = PLAYER_START.z
  player.angle = PLAYER_START.angle
  player.level = 0
  player.health = 100
  player.ammo = 48
  player.velocityX = 0
  player.velocityZ = 0
  player.alive = true
  wave = 1
  kills = 0
  spawnClock = 0
  startButton.textContent = 'ENTER DOCK TOWN'
  begin()
}

window.addEventListener('keydown', (event) => {
  keys.add(event.code)
  if (event.code === 'Space') shoot()
  if (event.code === 'KeyE') interact()
  if (event.code === 'KeyR') reload()
})
window.addEventListener('keyup', (event) => keys.delete(event.code))

canvas.addEventListener('click', () => {
  if (!running) return
  if (document.pointerLockElement !== canvas && !matchMedia('(pointer: coarse)').matches) canvas.requestPointerLock?.()
})
window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === canvas) player.angle += event.movementX * 0.0024
})
window.addEventListener('mousedown', (event) => {
  if (event.button === 0 && document.pointerLockElement === canvas) shoot()
})

function pointerDown(event) {
  if (!running) return
  const rect = canvas.getBoundingClientRect()
  const localX = event.clientX - rect.left
  if (localX < rect.width * 0.48 && touchState.movePointer === null) {
    touchState.movePointer = event.pointerId
    touchState.moveStartX = event.clientX
    touchState.moveStartY = event.clientY
    touchState.moveX = 0
    touchState.moveY = 0
  } else if (touchState.lookPointer === null) {
    touchState.lookPointer = event.pointerId
    touchState.lookLastX = event.clientX
    touchState.lookLastY = event.clientY
  }
  canvas.setPointerCapture?.(event.pointerId)
}

function pointerMove(event) {
  if (event.pointerId === touchState.movePointer) {
    const dx = event.clientX - touchState.moveStartX
    const dy = event.clientY - touchState.moveStartY
    touchState.moveX = Math.max(-1, Math.min(1, dx / 58))
    touchState.moveY = Math.max(-1, Math.min(1, dy / 58))
  } else if (event.pointerId === touchState.lookPointer) {
    const dx = event.clientX - touchState.lookLastX
    player.angle += dx * 0.007
    touchState.lookLastX = event.clientX
    touchState.lookLastY = event.clientY
  }
}

function pointerUp(event) {
  if (event.pointerId === touchState.movePointer) {
    touchState.movePointer = null
    touchState.moveX = 0
    touchState.moveY = 0
  }
  if (event.pointerId === touchState.lookPointer) touchState.lookPointer = null
}

canvas.addEventListener('pointerdown', pointerDown)
canvas.addEventListener('pointermove', pointerMove)
canvas.addEventListener('pointerup', pointerUp)
canvas.addEventListener('pointercancel', pointerUp)
fireButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  event.stopPropagation()
  shoot()
})
interactButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  event.stopPropagation()
  interact()
})
ammoText.parentElement.addEventListener('click', reload)
startButton.addEventListener('click', resetGame)

window.__ASHFALL_DEBUG__ = {
  world,
  player,
  zombies,
  renderer,
  teleport(x, z, level = 0) {
    if (!world.canStand(x, z, 0.31, level)) throw new Error('Blocked teleport target')
    player.x = x
    player.z = z
    player.level = level
  },
  shoot,
  interact,
}

const autostart = new URLSearchParams(location.search).get('autostart') === '1'
if (autostart) {
  window.setTimeout(resetGame, 20)
} else {
  statusLine.textContent = 'NO THREE.JS · TEXTURE RAYCASTER · MOBILE TEST'
}
