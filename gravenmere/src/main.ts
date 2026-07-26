import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { StatusBar } from '@capacitor/status-bar'
import * as THREE from 'three'
import { SchoolAudio } from './audio'
import { adaptivePixelRatio, circleIntersectsRect, clampPitch } from './math'
import { createWorld, type Interaction } from './world'
import './styles.css'

const SAVE_KEY = 'gravenmere-save-v1'
const PLAYER_HEIGHT = 1.68
const PLAYER_RADIUS = 0.42
const WALK_SPEED = 5.15

interface SaveData {
  started: boolean
  seals: string[]
  notes: string[]
  gateOpen: boolean
  endingSeen: boolean
  position: { x: number; z: number; yaw: number }
  sensitivity: number
  sound: boolean
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing interface element: ${id}`)
  return found as T
}

function defaultSave(): SaveData {
  return {
    started: false,
    seals: [],
    notes: [],
    gateOpen: false,
    endingSeen: false,
    position: { x: 0, z: 12.4, yaw: 0 },
    sensitivity: 1,
    sound: true,
  }
}

function loadSave(): SaveData {
  try {
    const stored = localStorage.getItem(SAVE_KEY)
    if (!stored) return defaultSave()
    const parsed = JSON.parse(stored) as Partial<SaveData>
    const fallback = defaultSave()
    return {
      ...fallback,
      ...parsed,
      seals: Array.isArray(parsed.seals) ? parsed.seals : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      position: { ...fallback.position, ...parsed.position },
    }
  } catch {
    return defaultSave()
  }
}

const ui = {
  startScreen: element<HTMLElement>('start-screen'),
  startButton: element<HTMLButtonElement>('start-button'),
  continueButton: element<HTMLButtonElement>('continue-button'),
  endingScreen: element<HTMLElement>('ending-screen'),
  endingClose: element<HTMLButtonElement>('ending-close'),
  endingNote: element<HTMLElement>('ending-note'),
  hud: element<HTMLElement>('hud'),
  placeKicker: element<HTMLElement>('place-kicker'),
  placeName: element<HTMLElement>('place-name'),
  objective: element<HTMLElement>('objective'),
  objectiveCopy: element<HTMLElement>('objective-copy'),
  sealPips: element<HTMLElement>('seal-pips'),
  prompt: element<HTMLElement>('interaction-prompt'),
  toast: element<HTMLElement>('toast'),
  joystick: element<HTMLElement>('joystick'),
  joystickKnob: element<HTMLElement>('joystick-knob'),
  lookPad: element<HTMLElement>('look-pad'),
  castButton: element<HTMLButtonElement>('cast-button'),
  interactButton: element<HTMLButtonElement>('interact-button'),
  spellCooldown: element<HTMLElement>('spell-cooldown'),
  journalButton: element<HTMLButtonElement>('journal-button'),
  journal: element<HTMLElement>('journal'),
  journalEntries: element<HTMLElement>('journal-entries'),
  journalSeals: element<HTMLElement>('journal-seals'),
  journalObjective: element<HTMLElement>('journal-objective'),
  sensitivity: element<HTMLInputElement>('sensitivity'),
  soundToggle: element<HTMLInputElement>('sound-toggle'),
  resetProgress: element<HTMLButtonElement>('reset-progress'),
}

let save = loadSave()
const audio = new SchoolAudio()

const canvas = element<HTMLCanvasElement>('world')
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
  depth: true,
  stencil: false,
})
let renderRatio = Math.min(window.devicePixelRatio || 1, 1.35)
renderer.setPixelRatio(renderRatio)
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.82

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x080a0a)
scene.fog = new THREE.FogExp2(0x080b0b, 0.018)

const camera = new THREE.PerspectiveCamera(
  68,
  window.innerWidth / window.innerHeight,
  0.06,
  145,
)
camera.rotation.order = 'YXZ'
const wandLight = new THREE.PointLight(0xb5ffe7, 1.25, 8.5, 2)
wandLight.position.set(0.25, -0.18, -0.2)
camera.add(wandLight)
scene.add(camera)

const world = createWorld(scene)
const player = {
  position: new THREE.Vector3(save.position.x, PLAYER_HEIGHT, save.position.z),
  yaw: save.position.yaw,
  pitch: -0.03,
  bob: 0,
  moving: false,
}

for (const sealId of save.seals) world.markSealCollected(sealId)
for (const noteId of save.notes) {
  const interaction = world.interactions.find((item) => item.id === noteId)
  if (interaction) interaction.complete = true
}
if (save.gateOpen) {
  world.gate.opened = true
  world.gate.progress = 1
  world.gate.object.position.y = 6.3
  world.gate.collider.enabled = false
  const gateInteraction = world.interactions.find((item) => item.kind === 'gate')
  if (gateInteraction) gateInteraction.complete = true
}

camera.position.copy(player.position)
camera.rotation.set(player.pitch, player.yaw, 0)

const keys = new Set<string>()
const moveInput = { x: 0, y: 0 }
let started = false
let sheetOpen = false
let endingOpen = false
let joyPointer: number | null = null
let lookPointer: number | null = null
let lookX = 0
let lookY = 0
let currentInteraction: Interaction | null = null
let toastTimer = 0
let revealRemaining = 0
let castCooldown = 0
let pulse: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null
let pulseAge = 0
let footstepTimer = 0
let saveTimer = 0
let currentRegion = ''
let frameAccumulator = 0
let frameCount = 0
let performanceTimer = 0

function persist(): void {
  save.position = {
    x: Number(player.position.x.toFixed(3)),
    z: Number(player.position.z.toFixed(3)),
    yaw: Number(player.yaw.toFixed(4)),
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(save))
}

function haptic(style: ImpactStyle): void {
  if (!Capacitor.isNativePlatform()) {
    navigator.vibrate?.(style === ImpactStyle.Heavy ? 45 : 18)
    return
  }
  void Haptics.impact({ style }).catch(() => undefined)
}

function setImmersiveMode(): void {
  if (!Capacitor.isNativePlatform()) return
  void StatusBar.hide().catch(() => undefined)
}

function showToast(title: string, text: string, duration = 6200): void {
  window.clearTimeout(toastTimer)
  ui.toast.replaceChildren()
  const strong = document.createElement('strong')
  strong.textContent = title
  const span = document.createElement('span')
  span.textContent = text
  ui.toast.append(strong, span)
  ui.toast.classList.add('toast--visible')
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('toast--visible'), duration)
}

function updateObjective(): void {
  const count = save.seals.length
  const pips = [...ui.sealPips.querySelectorAll('i')]
  pips.forEach((pip, index) => pip.classList.toggle('is-filled', index < count))
  ui.sealPips.setAttribute('aria-label', `${count} of 3 seals found`)
  ui.journalSeals.textContent = `${count} / 3`
  if (save.gateOpen) {
    ui.objectiveCopy.textContent = save.endingSeen
      ? 'The school is awake'
      : 'Enter the old observatory'
    ui.journalObjective.textContent = save.endingSeen
      ? 'The fourth chair accepted a new student.'
      : 'The observatory gate is open.'
  } else if (count === 3) {
    ui.objectiveCopy.textContent = 'Return to the north gate'
    ui.journalObjective.textContent = 'All three impressions can now be filled.'
  } else {
    ui.objectiveCopy.textContent =
      count === 0 ? 'Search the abandoned wings' : `${3 - count} seal${count === 2 ? '' : 's'} remain`
    ui.journalObjective.textContent = 'The observatory door bears three empty impressions.'
  }
}

function updateJournal(): void {
  const recorded = world.interactions.filter(
    (interaction) =>
      interaction.complete &&
      (interaction.kind === 'lore' ||
        interaction.kind === 'seal' ||
        interaction.kind === 'ending'),
  )
  ui.journalEntries.replaceChildren()
  if (recorded.length === 0) {
    const empty = document.createElement('article')
    empty.className = 'journal-empty'
    const title = document.createElement('span')
    title.textContent = 'Nothing recorded yet.'
    const hint = document.createElement('small')
    hint.textContent = 'Read plaques and inspect unusual objects.'
    empty.append(title, hint)
    ui.journalEntries.append(empty)
    return
  }
  for (const interaction of recorded) {
    const article = document.createElement('article')
    const marker = document.createElement('i')
    marker.textContent = interaction.kind === 'seal' ? '✦' : interaction.kind === 'ending' ? 'IV' : '—'
    const copy = document.createElement('div')
    const heading = document.createElement('strong')
    heading.textContent = interaction.title
    const text = document.createElement('p')
    text.textContent = interaction.text
    copy.append(heading, text)
    article.append(marker, copy)
    ui.journalEntries.append(article)
  }
}

function openJournal(): void {
  sheetOpen = true
  moveInput.x = 0
  moveInput.y = 0
  resetJoystick()
  updateJournal()
  ui.journal.classList.add('sheet--open')
  ui.journal.setAttribute('aria-hidden', 'false')
  haptic(ImpactStyle.Light)
}

function closeJournal(): void {
  sheetOpen = false
  ui.journal.classList.remove('sheet--open')
  ui.journal.setAttribute('aria-hidden', 'true')
}

function startGame(useSavedPosition = true): void {
  if (!useSavedPosition) {
    const settings = { sensitivity: save.sensitivity, sound: save.sound }
    localStorage.removeItem(SAVE_KEY)
    save = { ...defaultSave(), ...settings }
    player.position.set(0, PLAYER_HEIGHT, 12.4)
    player.yaw = 0
    player.pitch = -0.03
    window.location.reload()
    return
  }
  started = true
  save.started = true
  ui.startScreen.classList.remove('screen--visible')
  ui.startScreen.setAttribute('aria-hidden', 'true')
  ui.hud.setAttribute('aria-hidden', 'false')
  document.body.classList.add('game-started')
  setImmersiveMode()
  void audio.start()
  audio.setEnabled(save.sound)
  persist()
  showToast('West gate', 'It closes behind you without making a sound.', 4500)
}

function movePlayer(deltaX: number, deltaZ: number): void {
  const nextX = player.position.x + deltaX
  if (
    !world.colliders.some((collider) =>
      circleIntersectsRect(nextX, player.position.z, PLAYER_RADIUS, collider),
    )
  ) {
    player.position.x = nextX
  }
  const nextZ = player.position.z + deltaZ
  if (
    !world.colliders.some((collider) =>
      circleIntersectsRect(player.position.x, nextZ, PLAYER_RADIUS, collider),
    )
  ) {
    player.position.z = nextZ
  }
}

function updatePlayer(delta: number): void {
  let forward = -moveInput.y
  let strafe = moveInput.x
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1
  const magnitude = Math.hypot(forward, strafe)
  if (magnitude > 1) {
    forward /= magnitude
    strafe /= magnitude
  }
  player.moving = magnitude > 0.08
  if (player.moving) {
    const sin = Math.sin(player.yaw)
    const cos = Math.cos(player.yaw)
    const deltaX = (-sin * forward + cos * strafe) * WALK_SPEED * delta
    const deltaZ = (-cos * forward - sin * strafe) * WALK_SPEED * delta
    movePlayer(deltaX, deltaZ)
    player.bob += delta * 9.1
    footstepTimer -= delta
    if (footstepTimer <= 0) {
      audio.footstep(0.75 + Math.min(0.25, magnitude * 0.25))
      footstepTimer = 0.43
    }
  } else {
    footstepTimer = Math.min(footstepTimer, 0.15)
  }
  const bobAmount = player.moving ? 0.031 : 0
  camera.position.set(
    player.position.x + Math.cos(player.bob * 0.5) * bobAmount * 0.25,
    PLAYER_HEIGHT + Math.sin(player.bob) * bobAmount,
    player.position.z,
  )
  camera.rotation.set(player.pitch, player.yaw, 0)
}

function updateRegion(): void {
  const region = world.getRegion(player.position.x, player.position.z)
  if (region.name === currentRegion) return
  currentRegion = region.name
  ui.placeName.textContent = region.name
  ui.placeKicker.textContent = region.kicker
  ui.placeName.classList.remove('place-pulse')
  window.requestAnimationFrame(() => ui.placeName.classList.add('place-pulse'))
}

function cameraForward(): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1)
    .applyEuler(new THREE.Euler(0, player.yaw, 0, 'YXZ'))
    .setY(0)
    .normalize()
}

function findInteraction(): Interaction | null {
  const forward = cameraForward()
  let best: { interaction: Interaction; score: number } | null = null
  for (const interaction of world.interactions) {
    if (
      interaction.kind === 'seal' &&
      (interaction.complete || save.seals.includes(interaction.id))
    ) {
      continue
    }
    if (interaction.kind === 'gate' && save.gateOpen) continue
    const dx = interaction.position.x - player.position.x
    const dz = interaction.position.z - player.position.z
    const distance = Math.hypot(dx, dz)
    if (distance > interaction.radius) continue
    const direction = new THREE.Vector3(dx, 0, dz).normalize()
    const facing = forward.dot(direction)
    if (distance > 1.25 && facing < 0.16) continue
    const score = distance - facing * 0.55
    if (!best || score < best.score) best = { interaction, score }
  }
  return best?.interaction ?? null
}

function updateInteractionPrompt(): void {
  currentInteraction = findInteraction()
  if (!currentInteraction || sheetOpen || endingOpen) {
    ui.prompt.classList.remove('prompt--visible')
    ui.interactButton.classList.remove('action-button--ready')
    return
  }
  ui.prompt.textContent = currentInteraction.label
  ui.prompt.classList.add('prompt--visible')
  ui.interactButton.classList.add('action-button--ready')
}

function recordInteraction(interaction: Interaction): void {
  interaction.complete = true
  if (!save.notes.includes(interaction.id)) save.notes.push(interaction.id)
  audio.revealLore()
  haptic(ImpactStyle.Light)
  showToast(interaction.title, interaction.text)
  updateJournal()
  persist()
}

function performInteraction(): void {
  const interaction = currentInteraction ?? findInteraction()
  if (!interaction || sheetOpen || endingOpen) {
    haptic(ImpactStyle.Light)
    return
  }
  if (interaction.kind === 'seal') {
    if (!save.seals.includes(interaction.id)) save.seals.push(interaction.id)
    interaction.complete = true
    if (interaction.object) interaction.object.visible = false
    if (!save.notes.includes(interaction.id)) save.notes.push(interaction.id)
    audio.collect()
    haptic(ImpactStyle.Heavy)
    showToast(interaction.title, interaction.text, 7000)
    updateObjective()
    updateJournal()
    persist()
    currentInteraction = null
    return
  }
  if (interaction.kind === 'gate') {
    if (save.seals.length < 3) {
      haptic(ImpactStyle.Medium)
      showToast(
        'The gate does not move',
        `${3 - save.seals.length} empty impression${save.seals.length === 2 ? '' : 's'} remain in the lock.`,
        4200,
      )
      return
    }
    save.gateOpen = true
    interaction.complete = true
    world.gate.opened = true
    audio.gateOpen()
    haptic(ImpactStyle.Heavy)
    showToast('The observatory gate', 'The three seals turn together. The iron rises into the stone.', 6500)
    updateObjective()
    persist()
    return
  }
  if (interaction.kind === 'ending') {
    if (!save.gateOpen) return
    interaction.complete = true
    if (!save.notes.includes(interaction.id)) save.notes.push(interaction.id)
    save.endingSeen = true
    endingOpen = true
    audio.collect()
    haptic(ImpactStyle.Heavy)
    ui.endingNote.textContent = interaction.text
    ui.endingScreen.classList.add('screen--visible')
    ui.endingScreen.setAttribute('aria-hidden', 'false')
    updateObjective()
    updateJournal()
    persist()
    return
  }
  recordInteraction(interaction)
}

function castReveal(): void {
  if (!started || sheetOpen || endingOpen || castCooldown > 0) return
  castCooldown = 4.2
  revealRemaining = 3.8
  world.setReveal(true)
  audio.cast()
  haptic(ImpactStyle.Medium)

  const material = new THREE.MeshBasicMaterial({
    color: 0x8fffdc,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  })
  pulse = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 9), material)
  pulse.position.copy(player.position)
  pulse.position.y = 1.15
  pulse.scale.setScalar(0.2)
  scene.add(pulse)
  pulseAge = 0
  showToast('Revelare', 'Old magic leaves a shape in the air.', 2600)
}

function updateSpell(delta: number): void {
  if (castCooldown > 0) castCooldown = Math.max(0, castCooldown - delta)
  const ready = 1 - castCooldown / 4.2
  ui.spellCooldown.style.transform = `scaleX(${Math.max(0, Math.min(1, ready))})`
  ui.castButton.classList.toggle('action-button--cooling', castCooldown > 0)
  if (revealRemaining > 0) {
    revealRemaining = Math.max(0, revealRemaining - delta)
    if (revealRemaining === 0) world.setReveal(false)
  }
  if (pulse) {
    pulseAge += delta
    const progress = Math.min(1, pulseAge / 1.05)
    pulse.scale.setScalar(0.3 + progress * 18)
    pulse.material.opacity = (1 - progress) * 0.42
    if (progress >= 1) {
      scene.remove(pulse)
      pulse.geometry.dispose()
      pulse.material.dispose()
      pulse = null
    }
  }
}

function updateJoystick(event: PointerEvent): void {
  const bounds = ui.joystick.getBoundingClientRect()
  const centerX = bounds.left + bounds.width / 2
  const centerY = bounds.top + bounds.height / 2
  let x = event.clientX - centerX
  let y = event.clientY - centerY
  const limit = bounds.width * 0.31
  const length = Math.hypot(x, y)
  if (length > limit) {
    x = (x / length) * limit
    y = (y / length) * limit
  }
  moveInput.x = x / limit
  moveInput.y = y / limit
  ui.joystickKnob.style.transform = `translate3d(${x}px, ${y}px, 0)`
}

function resetJoystick(): void {
  joyPointer = null
  moveInput.x = 0
  moveInput.y = 0
  ui.joystickKnob.style.transform = 'translate3d(0,0,0)'
}

ui.joystick.addEventListener('pointerdown', (event) => {
  if (!started || sheetOpen) return
  joyPointer = event.pointerId
  ui.joystick.setPointerCapture(event.pointerId)
  updateJoystick(event)
})
ui.joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId === joyPointer) updateJoystick(event)
})
ui.joystick.addEventListener('pointerup', (event) => {
  if (event.pointerId === joyPointer) resetJoystick()
})
ui.joystick.addEventListener('pointercancel', resetJoystick)

ui.lookPad.addEventListener('pointerdown', (event) => {
  if (!started || sheetOpen) return
  lookPointer = event.pointerId
  lookX = event.clientX
  lookY = event.clientY
  ui.lookPad.setPointerCapture(event.pointerId)
})
ui.lookPad.addEventListener('pointermove', (event) => {
  if (event.pointerId !== lookPointer || sheetOpen) return
  const deltaX = event.clientX - lookX
  const deltaY = event.clientY - lookY
  lookX = event.clientX
  lookY = event.clientY
  player.yaw -= deltaX * 0.0043 * save.sensitivity
  player.pitch = clampPitch(player.pitch - deltaY * 0.0037 * save.sensitivity)
})
const finishLook = (event: PointerEvent) => {
  if (event.pointerId === lookPointer) lookPointer = null
}
ui.lookPad.addEventListener('pointerup', finishLook)
ui.lookPad.addEventListener('pointercancel', finishLook)

window.addEventListener('keydown', (event) => {
  keys.add(event.code)
  if (event.code === 'KeyE') performInteraction()
  if (event.code === 'KeyQ') castReveal()
  if (event.code === 'KeyJ') (sheetOpen ? closeJournal() : openJournal())
})
window.addEventListener('keyup', (event) => keys.delete(event.code))
canvas.addEventListener('click', () => {
  if (started && !matchMedia('(pointer: coarse)').matches && document.pointerLockElement !== canvas) {
    void canvas.requestPointerLock()
  }
})
window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas || sheetOpen) return
  player.yaw -= event.movementX * 0.0022 * save.sensitivity
  player.pitch = clampPitch(player.pitch - event.movementY * 0.0019 * save.sensitivity)
})

ui.startButton.addEventListener('click', () => startGame(true))
ui.continueButton.addEventListener('click', () => startGame(false))
ui.castButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  castReveal()
})
ui.interactButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  performInteraction()
})
ui.journalButton.addEventListener('click', openJournal)
document.querySelectorAll<HTMLElement>('[data-close-sheet]').forEach((button) => {
  button.addEventListener('click', closeJournal)
})
ui.endingClose.addEventListener('click', () => {
  endingOpen = false
  ui.endingScreen.classList.remove('screen--visible')
  ui.endingScreen.setAttribute('aria-hidden', 'true')
})

ui.sensitivity.value = String(save.sensitivity)
ui.soundToggle.checked = save.sound
ui.sensitivity.addEventListener('input', () => {
  save.sensitivity = Number(ui.sensitivity.value)
  persist()
})
ui.soundToggle.addEventListener('change', () => {
  save.sound = ui.soundToggle.checked
  audio.setEnabled(save.sound)
  persist()
})
ui.resetProgress.addEventListener('click', () => {
  if (!window.confirm('Erase every seal, note, and saved position?')) return
  localStorage.removeItem(SAVE_KEY)
  window.location.reload()
})

if (save.started) {
  ui.startButton.textContent = 'CONTINUE'
  ui.continueButton.textContent = 'START AGAIN'
  ui.continueButton.hidden = false
}

if (Capacitor.isNativePlatform()) {
  void App.addListener('backButton', () => {
    if (endingOpen) {
      endingOpen = false
      ui.endingScreen.classList.remove('screen--visible')
      return
    }
    if (sheetOpen) {
      closeJournal()
      return
    }
    openJournal()
  })
}

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight, false)
}
window.addEventListener('resize', onResize)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && started) persist()
})
window.addEventListener('pagehide', persist)

updateObjective()
updateJournal()

const clock = new THREE.Clock()
function animate(): void {
  window.requestAnimationFrame(animate)
  const rawDelta = clock.getDelta()
  const delta = Math.min(rawDelta, 0.045)

  if (started && !sheetOpen && !endingOpen) {
    updatePlayer(delta)
    updateRegion()
    updateInteractionPrompt()
    saveTimer += delta
    if (saveTimer > 4.5) {
      saveTimer = 0
      persist()
    }
  }
  updateSpell(delta)
  world.update(clock.elapsedTime, delta)
  renderer.render(scene, camera)

  frameAccumulator += rawDelta * 1000
  frameCount += 1
  performanceTimer += rawDelta
  if (performanceTimer > 2.5 && frameCount > 30) {
    const average = frameAccumulator / frameCount
    const adjusted = adaptivePixelRatio(renderRatio, average, window.devicePixelRatio || 1)
    if (Math.abs(adjusted - renderRatio) > 0.01) {
      renderRatio = adjusted
      renderer.setPixelRatio(renderRatio)
      renderer.setSize(window.innerWidth, window.innerHeight, false)
    }
    frameAccumulator = 0
    frameCount = 0
    performanceTimer = 0
  }
}
animate()
