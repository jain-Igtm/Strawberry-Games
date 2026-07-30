import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve(import.meta.dirname, '../src/main.ts')
let source = readFileSync(sourcePath, 'utf8')
const marker = '// DEADWATER_FEEDBACK_PASS_V2'

if (source.includes(marker)) {
  console.log('Deadwater feedback pass already applied.')
  process.exit(0)
}

function replaceRequired(label, search, replacement) {
  const next = typeof search === 'string'
    ? source.replace(search, replacement)
    : source.replace(search, replacement)
  if (next === source) throw new Error(`Could not apply feedback patch: ${label}`)
  source = next
}

replaceRequired(
  'marker',
  "import './styles.css'",
  "import './styles.css'\n\n${marker}",
)

replaceRequired(
  'touch render scale',
  /isTouch \? 1\.15 : 1\.55/g,
  'isTouch ? 0.95 : 1.55',
)

replaceRequired('ember count', 'const emberCount = isTouch ? 130 : 220', 'const emberCount = isTouch ? 82 : 180')
replaceRequired('ash count', 'const ashCount = isTouch ? 100 : 170', 'const ashCount = isTouch ? 64 : 140')
replaceRequired('mobile zombie cap', "zombies.length < (isTouch ? 38 : 48)", "zombies.length < (isTouch ? 30 : 46)")

replaceRequired(
  'weapon model',
  /const gun = new THREE\.Group\(\)[\s\S]*?camera\.add\(gun\)/,
  `const gun = new THREE.Group()
const gunBody = box(0.22, 0.2, 0.72, mats.blackMetal, 0, 0, -0.02)
const upperReceiver = box(0.16, 0.11, 0.58, mats.rust, 0, 0.145, -0.08)
const handguard = box(0.18, 0.16, 0.46, mats.darkRust, 0, -0.005, -0.55)
const stock = box(0.2, 0.19, 0.38, mats.blackMetal, 0, -0.015, 0.48)
stock.rotation.x = 0.05
const cheekRest = box(0.14, 0.08, 0.28, mats.metal, 0, 0.12, 0.45)
const gunGrip = box(0.14, 0.36, 0.17, mats.darkRust, 0, -0.24, 0.18)
gunGrip.rotation.x = -0.24
const magazine = box(0.15, 0.39, 0.2, mats.blackMetal, 0, -0.25, -0.12)
magazine.rotation.x = 0.16
const barrelSleeve = cylinder(0.055, 0.055, 0.42, 10, mats.blackMetal, 0, 0.01, -0.77)
barrelSleeve.rotation.x = Math.PI / 2
const gunBarrel = cylinder(0.03, 0.03, 0.38, 10, mats.metal, 0, 0.01, -1.04)
gunBarrel.rotation.x = Math.PI / 2
const frontSight = box(0.055, 0.16, 0.055, mats.metal, 0, 0.16, -0.85)
const rearSight = box(0.075, 0.12, 0.06, mats.metal, 0, 0.19, 0.08)
const sidePlate = box(0.235, 0.075, 0.3, mats.warning, 0, -0.02, -0.2)
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
  muzzle,
  muzzleLight,
)
gun.rotation.y = -0.035
gun.position.set(0.35, -0.3, -0.55)
camera.add(gun)`,
)

replaceRequired(
  'zombie model',
  /function createZombie\(position: THREE\.Vector3\): Zombie \{[\s\S]*?\n\}\n\nfunction removeZombie/,
  `function createZombie(position: THREE.Vector3): Zombie {
  const tuning = tuningForWave(state.wave)
  const group = new THREE.Group()
  const scale = 0.9 + Math.random() * 0.22
  group.position.copy(position)
  group.scale.setScalar(scale)
  group.userData.flashActive = false

  const skin = mats.zombieSkin.clone()
  skin.color.offsetHSL((Math.random() - 0.5) * 0.04, -0.05, (Math.random() - 0.5) * 0.08)
  const cloth = (Math.random() > 0.45 ? mats.zombieCloth : mats.zombieClothAlt).clone()
  const accent = mats.warning.clone()
  accent.color.offsetHSL((Math.random() - 0.5) * 0.06, -0.16, -0.12)
  const wound = mats.rust.clone()
  wound.color.offsetHSL(0, 0.05, -0.12)
  const eyeMaterial = mats.ember.clone()
  eyeMaterial.opacity = 0.72
  const parts: THREE.Mesh[] = []

  const body = box(0.7, 1.0, 0.42, cloth, 0, 1.18, 0)
  body.rotation.z = (Math.random() - 0.5) * 0.08
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.31, 1), skin)
  head.position.set(0.025, 1.93, -0.02)
  head.rotation.z = (Math.random() - 0.5) * 0.2
  const jaw = box(0.29, 0.16, 0.25, skin, 0.03, 1.7, -0.085)
  jaw.rotation.z = 0.06
  const leftArm = box(0.22, 0.92, 0.22, skin, -0.49, 1.15, -0.05)
  const rightArm = box(0.22, 0.92, 0.22, skin, 0.49, 1.15, -0.05)
  leftArm.rotation.x = -0.85
  rightArm.rotation.x = -0.85
  leftArm.rotation.z = -0.08
  rightArm.rotation.z = 0.1
  const leftLeg = box(0.26, 0.95, 0.28, cloth, -0.2, 0.45, 0)
  const rightLeg = box(0.26, 0.95, 0.28, cloth, 0.2, 0.45, 0)

  const shoulder = box(0.86, 0.19, 0.48, accent, 0, 1.5, 0.015)
  shoulder.rotation.z = (Math.random() - 0.5) * 0.1
  const chestTear = box(0.25, 0.34, 0.025, wound, -0.15, 1.18, -0.225)
  chestTear.rotation.z = -0.18
  const headWound = box(0.18, 0.13, 0.04, wound, -0.17, 2.02, -0.255)
  headWound.rotation.z = 0.35
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 4), eyeMaterial)
  eye.position.set(0.105, 1.99, -0.285)

  group.add(
    body,
    head,
    jaw,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shoulder,
    chestTear,
    headWound,
    eye,
  )
  parts.push(
    body,
    head,
    jaw,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shoulder,
    chestTear,
    headWound,
    eye,
  )

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
    part.userData.headshot = part === head || part === headWound || part === eye
    shotTargets.push(part)
  }
  scene.add(group)
  zombies.push(zombie)
  return zombie
}

function removeZombie`,
)

replaceRequired(
  'audio synthesis',
  /function noiseBurst\(duration: number, volume: number, frequency: number\): void \{[\s\S]*?\n\}\n\nfunction playGunshot\(\): void \{[\s\S]*?\n\}/,
  `let sharedNoiseBuffer: AudioBuffer | null = null
let nextZombieMoanAt = 0

function noiseBurst(
  duration: number,
  volume: number,
  frequency: number,
  filterType: BiquadFilterType = 'lowpass',
  q = 0.7,
  delay = 0,
): void {
  const context = ensureAudio()
  if (!sharedNoiseBuffer || sharedNoiseBuffer.sampleRate !== context.sampleRate) {
    const frames = Math.floor(context.sampleRate * 0.65)
    sharedNoiseBuffer = context.createBuffer(1, frames, context.sampleRate)
    const data = sharedNoiseBuffer.getChannelData(0)
    let previous = 0
    for (let i = 0; i < frames; i += 1) {
      const white = Math.random() * 2 - 1
      previous = previous * 0.18 + white * 0.82
      data[i] = previous
    }
  }
  const sourceNode = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  const start = context.currentTime + delay
  filter.type = filterType
  filter.frequency.value = frequency
  filter.Q.value = q
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.004, duration * 0.2))
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  sourceNode.buffer = sharedNoiseBuffer
  sourceNode.connect(filter).connect(gain).connect(context.destination)
  sourceNode.start(start, Math.random() * 0.15, duration)
  sourceNode.stop(start + duration + 0.01)
}

function playTone(
  type: OscillatorType,
  startFrequency: number,
  endFrequency: number,
  duration: number,
  volume: number,
  delay = 0,
): void {
  const context = ensureAudio()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const start = context.currentTime + delay
  oscillator.type = type
  oscillator.frequency.setValueAtTime(startFrequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.01)
}

function playGunshot(): void {
  noiseBurst(0.018, 0.12, 2200, 'highpass', 0.45)
  noiseBurst(0.085, 0.105, 880, 'bandpass', 0.8)
  noiseBurst(0.15, 0.028, 430, 'lowpass', 0.6, 0.018)
  playTone('sine', 145, 58, 0.08, 0.1)
  playTone('triangle', 920, 310, 0.028, 0.026, 0.032)
}`,
)

replaceRequired(
  'spaced zombie voices',
  /function playZombieMoan\(distance: number\): void \{[\s\S]*?\n\}/,
  `function playZombieMoan(distance: number): void {
  if (!audioContext || distance > 34 || audioContext.currentTime < nextZombieMoanAt) return
  const context = ensureAudio()
  nextZombieMoanAt = context.currentTime + 0.6 + Math.random() * 1.05
  const oscillator = context.createOscillator()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  oscillator.type = 'sawtooth'
  oscillator.frequency.setValueAtTime(48 + Math.random() * 16, context.currentTime)
  oscillator.frequency.linearRampToValueAtTime(34, context.currentTime + 0.48)
  filter.type = 'lowpass'
  filter.frequency.value = 420
  const volume = THREE.MathUtils.clamp(0.032 * (1 - distance / 38), 0.003, 0.028)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.06)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5)
  oscillator.connect(filter).connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.52)
}`,
)

replaceRequired('body damage', 'const baseDamage = 42 + Math.floor((state.wave - 1) / 5) * 4', 'const baseDamage = 36 + Math.floor((state.wave - 1) / 5) * 4')
replaceRequired('headshot damage', 'const damage = headshot ? baseDamage * 2.05 : baseDamage', 'const damage = headshot ? baseDamage * 1.9 : baseDamage')

replaceRequired(
  'zombie update loop',
  /function updateZombies\(dt: number, elapsed: number\): void \{[\s\S]*?\n\}\n\nfunction updateWave/,
  `function updateZombies(dt: number, elapsed: number): void {
  const cellSize = 3.1
  const buckets = new Map<string, Zombie[]>()
  for (const zombie of zombies) {
    if (zombie.dead) continue
    const cellX = Math.floor(zombie.group.position.x / cellSize)
    const cellZ = Math.floor(zombie.group.position.z / cellSize)
    const key = \`${'${cellX}:${cellZ}'}\`
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
          const nearby = buckets.get(\`${'${cellX + offsetX}:${cellZ + offsetZ}'}\`)
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

function updateWave`,
)

replaceRequired('touch yaw direction', 'player.yaw -= dx * 0.0048', 'player.yaw += dx * 0.0048')
replaceRequired('touch pitch direction', 'player.pitch -= dy * 0.0042', 'player.pitch += dy * 0.0042')

replaceRequired(
  'atmosphere cadence declaration',
  'let elapsed = 0\nfunction animate(): void {',
  'let elapsed = 0\nlet atmosphereFrame = 0\nfunction animate(): void {',
)
replaceRequired(
  'atmosphere cadence',
  '  updateAtmosphere(dt, elapsed)\n  renderer.render(scene, camera)',
  `  atmosphereFrame += 1
  if (!isTouch || atmosphereFrame % 2 === 0) {
    updateAtmosphere(isTouch ? dt * 2 : dt, elapsed)
  }
  renderer.render(scene, camera)`,
)

writeFileSync(sourcePath, source)
console.log('Applied Deadwater feedback pass v2.')
