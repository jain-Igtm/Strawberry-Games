import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const mainPath = resolve(root, 'src/main.ts')
const zombieModelPath = resolve(root, 'src/zombie-model.ts')
const marker = '// DEADWATER_PERSISTENT_ZOMBIE_OVERHAUL_V31'

const zombieModel = `import * as THREE from 'three'

export type ZombieAnimationState = 'walk' | 'run' | 'attack' | 'death'

export const ZOMBIE_DISPLAY_HEIGHT = 2.16
export const ZOMBIE_FORWARD_YAW = -Math.PI / 2
export const ZOMBIE_MESHES_PER_VISUAL = 1

export type ZombieVisual = {
  group: THREE.Group
  parts: THREE.Mesh[]
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  animationState: ZombieAnimationState
  animationTime: number
  deathProgress: number
  fallDirection: number
  disposed: boolean
}

let sharedGeometry: THREE.BufferGeometry | null = null
let sharedBaseMaterial: THREE.MeshStandardMaterial | null = null

function addPiece(
  positions: number[],
  normals: number[],
  colors: number[],
  geometry: THREE.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  scaleX = 1,
  scaleY = 1,
  scaleZ = 1,
): void {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, rotationY, rotationZ)),
    new THREE.Vector3(scaleX, scaleY, scaleZ),
  )
  source.applyMatrix4(matrix)
  source.computeVertexNormals()
  const position = source.getAttribute('position')
  const normal = source.getAttribute('normal')
  const tint = new THREE.Color(color)
  for (let index = 0; index < position.count; index += 1) {
    positions.push(position.getX(index), position.getY(index), position.getZ(index))
    normals.push(normal.getX(index), normal.getY(index), normal.getZ(index))
    colors.push(tint.r, tint.g, tint.b)
  }
  source.dispose()
  geometry.dispose()
}

function buildSharedGeometry(): THREE.BufferGeometry {
  if (sharedGeometry) return sharedGeometry

  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const add = (
    geometry: THREE.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0,
    scaleX = 1,
    scaleY = 1,
    scaleZ = 1,
  ): void => addPiece(
    positions,
    normals,
    colors,
    geometry,
    color,
    x,
    y,
    z,
    rotationX,
    rotationY,
    rotationZ,
    scaleX,
    scaleY,
    scaleZ,
  )

  // One merged low-poly silhouette: a hunched hooded infected rather than a
  // rigid mannequin. The asymmetric arms read clearly while remaining one draw call.
  add(new THREE.CylinderGeometry(0.29, 0.62, 1.34, 7, 1, false), 0x303638, 0, 0.67, 0)
  add(new THREE.CylinderGeometry(0.43, 0.33, 0.38, 7, 1, false), 0x292f31, 0, 1.39, -0.03, -0.12)
  add(new THREE.DodecahedronGeometry(0.46, 0), 0x343a3c, 0, 1.43, 0.03, -0.13, 0, 0, 0.9, 0.76, 0.7)
  add(new THREE.SphereGeometry(0.4, 7, 5), 0x292f31, 0, 1.84, -0.08, -0.12, 0, 0, 1.02, 1.15, 0.98)
  add(new THREE.CircleGeometry(0.225, 10), 0x030404, 0, 1.83, -0.445, 0, Math.PI, 0, 0.88, 1.16, 1)

  // Left arm reaches lower and farther; the right arm is bent and closer.
  add(new THREE.SphereGeometry(0.19, 6, 4), 0x303638, -0.34, 1.47, -0.08, 0, 0, 0, 1, 0.9, 1)
  add(new THREE.CylinderGeometry(0.095, 0.17, 0.86, 6, 1, false), 0x343a3c, -0.42, 1.31, -0.43, -1.17, 0, -0.22)
  add(new THREE.SphereGeometry(0.115, 6, 4), 0x545859, -0.49, 1.08, -0.8, 0, 0, 0, 0.82, 0.9, 1.18)

  add(new THREE.SphereGeometry(0.2, 6, 4), 0x2d3335, 0.35, 1.5, -0.06, 0, 0, 0, 1, 0.92, 1)
  add(new THREE.CylinderGeometry(0.1, 0.175, 0.76, 6, 1, false), 0x303638, 0.4, 1.39, -0.38, -1.36, 0, 0.16)
  add(new THREE.SphereGeometry(0.112, 6, 4), 0x505556, 0.45, 1.25, -0.72, 0, 0, 0, 0.82, 0.9, 1.16)

  // Ragged hem and torn shoulder break the clean geometric outline.
  add(new THREE.PlaneGeometry(0.3, 0.34), 0x252b2d, -0.35, 0.18, -0.22, -0.08, -0.18, -0.08)
  add(new THREE.PlaneGeometry(0.34, 0.4), 0x2c3234, -0.08, 0.16, -0.31, -0.06, -0.04, 0.04)
  add(new THREE.PlaneGeometry(0.3, 0.36), 0x252b2d, 0.23, 0.17, -0.28, -0.07, 0.11, 0.08)
  add(new THREE.PlaneGeometry(0.22, 0.3), 0x202527, 0.45, 0.2, -0.12, -0.05, 0.2, 0.14)
  add(new THREE.PlaneGeometry(0.22, 0.28), 0x202527, -0.47, 1.48, -0.02, 0.08, -0.12, -0.35)

  sharedGeometry = new THREE.BufferGeometry()
  sharedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  sharedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  sharedGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  sharedGeometry.computeBoundingBox()
  sharedGeometry.computeBoundingSphere()
  return sharedGeometry
}

function makeMaterial(): THREE.MeshStandardMaterial {
  if (!sharedBaseMaterial) {
    sharedBaseMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      emissive: 0x080a0a,
      emissiveIntensity: 0.13,
    })
  }
  const material = sharedBaseMaterial.clone()
  material.userData.baseEmissive = 0x080a0a
  material.userData.baseEmissiveIntensity = 0.13
  return material
}

export const zombieAssetReady: Promise<boolean> = Promise.resolve(true)

export function isZombieAssetReady(): boolean {
  return true
}

export function didZombieAssetFail(): boolean {
  return false
}

export function createTexturedZombieVisual(): ZombieVisual {
  const group = new THREE.Group()
  group.name = 'optimized-hunched-hooded-infected'
  group.userData.flashActive = false

  const mesh = new THREE.Mesh(buildSharedGeometry(), makeMaterial())
  mesh.name = 'single-mesh-infected'
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = true
  group.add(mesh)
  group.rotation.y = ZOMBIE_FORWARD_YAW

  return {
    group,
    parts: [mesh],
    mesh,
    animationState: Math.random() < 0.32 ? 'run' : 'walk',
    animationTime: Math.random() * Math.PI * 2,
    deathProgress: 0,
    fallDirection: Math.random() < 0.5 ? -1 : 1,
    disposed: false,
  }
}

export function setZombieAnimation(
  visual: ZombieVisual,
  next: ZombieAnimationState,
  _playbackRate = 1,
): void {
  if (visual.disposed || visual.animationState === 'death') return
  visual.animationState = next
}

export function beginZombieDeath(visual: ZombieVisual): void {
  if (visual.disposed) return
  visual.animationState = 'death'
  visual.deathProgress = 0
  visual.mesh.material.color.setHex(0x786864)
  visual.mesh.material.emissive.setHex(0x6f140d)
  visual.mesh.material.emissiveIntensity = 0.9
}

export function advanceZombieAnimation(
  visual: ZombieVisual,
  dt: number,
  _distanceToPlayer: number,
): void {
  if (visual.disposed) return
  const mesh = visual.mesh
  visual.animationTime += dt

  if (visual.animationState === 'death') {
    visual.deathProgress = Math.min(1, visual.deathProgress + dt / 0.48)
    const fall = 1 - Math.pow(1 - visual.deathProgress, 3)
    mesh.rotation.x = -0.12 - fall * 1.38
    mesh.rotation.z = fall * visual.fallDirection * 0.3
    mesh.position.y = -fall * 0.23
    mesh.position.z = -fall * 0.08
    mesh.scale.set(1, 1 - fall * 0.09, 1)
    mesh.material.emissiveIntensity = Math.max(0.04, (1 - visual.deathProgress) * 0.9)
    if (visual.deathProgress >= 1) {
      mesh.material.color.setHex(0x4b4746)
      mesh.material.emissive.setHex(0x000000)
      mesh.material.emissiveIntensity = 0
    }
    return
  }

  const running = visual.animationState === 'run'
  const attacking = visual.animationState === 'attack'
  const rate = running ? 8.4 : attacking ? 5.2 : 5.8
  const sway = Math.sin(visual.animationTime * rate)
  mesh.rotation.x = attacking ? -0.22 : -0.11 + sway * 0.018
  mesh.rotation.z = sway * (running ? 0.026 : 0.018)
  mesh.position.y = Math.abs(sway) * (running ? 0.018 : 0.011)
  mesh.position.z = attacking ? -0.055 : 0
  mesh.scale.set(1, 1, 1)
}

export function disposeZombieVisual(visual: ZombieVisual): void {
  if (visual.disposed) return
  visual.disposed = true
  visual.mesh.material.dispose()
  // Geometry is shared by every infected and remains alive for the game session.
}
`

if (readFileSync(zombieModelPath, 'utf8') !== zombieModel) {
  writeFileSync(zombieModelPath, zombieModel)
}

let main = readFileSync(mainPath, 'utf8')
if (!main.includes(marker)) {
  const replaceOnce = (before, after, label) => {
    if (!main.includes(before)) throw new Error('Could not patch ' + label)
    main = main.replace(before, after)
  }

  replaceOnce(
    '  advanceZombieAnimation,\n  createTexturedZombieVisual,',
    '  advanceZombieAnimation,\n  beginZombieDeath,\n  createTexturedZombieVisual,',
    'zombie-model imports',
  )

  replaceOnce(
    '  runner: boolean\n  dead: boolean\n}',
    '  runner: boolean\n  dead: boolean\n  deathTimer: number\n  deathDuration: number\n  steerTimer: number\n  aiPhase: number\n  lastValidX: number\n  lastValidZ: number\n}',
    'Zombie lifecycle fields',
  )

  replaceOnce(
    'const activeZombieBuckets: Zombie[][] = []\n',
    'const activeZombieBuckets: Zombie[][] = []\nlet zombieMoanTimer = 0\n' + marker + '\n',
    'zombie runtime marker',
  )

  const recoveryPattern = /function recoverZombieOutsideWalls\(zombie: Zombie\): void \{[\s\S]*?\n\}\n\nfunction nudgeZombieAlongWall/
  if (!recoveryPattern.test(main)) throw new Error('Could not patch persistent zombie recovery')
  main = main.replace(recoveryPattern, `function recoverZombieOutsideWalls(zombie: Zombie): void {
  const { x, z } = zombie.group.position
  if (
    insideIsland(x, z, zombie.radius) &&
    !circleHitsCollider(x, z, zombie.radius)
  ) {
    zombie.lastValidX = x
    zombie.lastValidZ = z
    return
  }

  // Never delete or fling an evaded zombie to an unrelated map cell. Restore
  // its last valid position, preserving the wave and the player's pursuer.
  if (
    insideIsland(zombie.lastValidX, zombie.lastValidZ, zombie.radius) &&
    !circleHitsCollider(zombie.lastValidX, zombie.lastValidZ, zombie.radius)
  ) {
    zombie.group.position.x = zombie.lastValidX
    zombie.group.position.z = zombie.lastValidZ
    zombie.velocityX = 0
    zombie.velocityZ = 0
    zombie.stuckTimer = 0
    return
  }

  const open = nearestReachableNavigationCell(navigationCellAt(x, z), 10)
  if (open < 0) return
  navigationCellCenter(open, navDirection)
  if (circleHitsCollider(navDirection.x, navDirection.y, zombie.radius)) return
  zombie.group.position.x = navDirection.x
  zombie.group.position.z = navDirection.y
  zombie.lastValidX = navDirection.x
  zombie.lastValidZ = navDirection.y
  zombie.velocityX = 0
  zombie.velocityZ = 0
  zombie.stuckTimer = 0
}

function nudgeZombieAlongWall`)

  const creationPattern = /function createZombie\(position: THREE\.Vector3\): Zombie \| null \{[\s\S]*?\n\}\n\nfunction removeZombie\(zombie: Zombie\): void \{[\s\S]*?\n\}\n\nfunction clearZombies/
  if (!creationPattern.test(main)) throw new Error('Could not patch zombie creation and removal')
  main = main.replace(creationPattern, `function createZombie(position: THREE.Vector3): Zombie | null {
  const tuning = tuningForWave(state.wave)
  const visual = createTexturedZombieVisual()
  if (!visual) return null
  const group = visual.group
  const scale = 0.96 + Math.random() * 0.12
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
    deathTimer: 0,
    deathDuration: 1.35,
    steerTimer: Math.random() * 0.08,
    aiPhase: Math.random(),
    lastValidX: position.x,
    lastValidZ: position.z,
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

function detachZombieShotTargets(zombie: Zombie): void {
  for (const part of zombie.parts) {
    const targetIndex = shotTargets.indexOf(part)
    if (targetIndex >= 0) shotTargets.splice(targetIndex, 1)
  }
}

function removeZombie(zombie: Zombie): void {
  scene.remove(zombie.group)
  detachZombieShotTargets(zombie)
  disposeZombieVisual(zombie.visual)
  const zombieIndex = zombies.indexOf(zombie)
  if (zombieIndex >= 0) zombies.splice(zombieIndex, 1)
}

function clearZombies`)

  const oldDeath = `    if (killed) {
      zombie.dead = true
      killedSomething = true
      state.kills += 1
      soundscape.zombieDeath()
      setZombieAnimation(zombie.visual, 'death', 1)
      setTimeout(() => {
        if (zombies.includes(zombie)) removeZombie(zombie)
      }, 900)
    }`
  const newDeath = `    if (killed) {
      zombie.dead = true
      zombie.deathTimer = 0
      zombie.flashTimer = 0
      detachZombieShotTargets(zombie)
      beginZombieDeath(zombie.visual)
      killedSomething = true
      state.kills += 1
      soundscape.zombieDeath()
    }`
  replaceOnce(oldDeath, newDeath, 'readable zombie death')

  const updatePattern = /function updateZombies\(dt: number, _elapsed: number\): void \{[\s\S]*?\n\}\n\nfunction updateWave/
  if (!updatePattern.test(main)) throw new Error('Could not patch zombie update loop')
  main = main.replace(updatePattern, `function updateZombies(dt: number, _elapsed: number): void {
  rebuildNavigationFlow()
  zombieMoanTimer = Math.max(0, zombieMoanTimer - dt)
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

  let nearestMoanDistance = Number.POSITIVE_INFINITY
  for (let zombieIndex = zombies.length - 1; zombieIndex >= 0; zombieIndex -= 1) {
    const zombie = zombies[zombieIndex]
    if (zombie.dead) {
      zombie.deathTimer += dt
      advanceZombieAnimation(zombie.visual, dt, 0)
      if (zombie.deathTimer >= zombie.deathDuration) removeZombie(zombie)
      continue
    }

    zombie.group.visible = true
    recoverZombieOutsideWalls(zombie)
    zombie.attackTimer -= dt
    zombie.flashTimer = Math.max(0, zombie.flashTimer - dt)
    const deltaX = player.position.x - zombie.group.position.x
    const deltaZ = player.position.z - zombie.group.position.z
    const distance = Math.hypot(deltaX, deltaZ)
    nearestMoanDistance = Math.min(nearestMoanDistance, distance)

    if (distance > 1.22) {
      zombie.steerTimer -= dt
      if (zombie.steerTimer <= 0) {
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
              const otherX = zombie.group.position.x - other.group.position.x
              const otherZ = zombie.group.position.z - other.group.position.z
              const distanceSquared = otherX * otherX + otherZ * otherZ
              if (distanceSquared > 0.001 && distanceSquared < 1.35 * 1.35) {
                separationX += otherX / distanceSquared
                separationZ += otherZ / distanceSquared
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
        const steering = 1 - Math.exp(-Math.max(0.045, zombie.steerTimer + 0.08) * 8)
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
        zombie.steerTimer = (
          distance > 55 ? 0.12 : distance > 28 ? 0.078 : 0.048
        ) + zombie.aiPhase * 0.012
      }

      const previousX = zombie.group.position.x
      const previousZ = zombie.group.position.z
      // Distant pursuers accelerate modestly rather than despawning. A player can
      // create breathing room, but every living member of the wave remains real.
      const pursuitBoost = 1 + THREE.MathUtils.clamp((distance - 58) / 150, 0, 0.42)
      const moved = moveZombie(
        zombie,
        zombie.velocityX * zombie.speed * pursuitBoost * dt,
        zombie.velocityZ * zombie.speed * pursuitBoost * dt,
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
        const inverseDistance = 1 / Math.max(distance, 0.001)
        nudgeZombieAlongWall(zombie, deltaX * inverseDistance, deltaZ * inverseDistance)
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
    zombie.group.position.y = expandedWorld.heightAt(
      zombie.group.position.x,
      zombie.group.position.z,
    )
    advanceZombieAnimation(zombie.visual, dt, distance)

    const flashing = zombie.flashTimer > 0
    if (Boolean(zombie.group.userData.flashActive) !== flashing) {
      zombie.group.userData.flashActive = flashing
      const material = zombie.visual.mesh.material
      material.emissive.setHex(
        flashing
          ? 0x7d130b
          : Number(material.userData.baseEmissive ?? 0x000000),
      )
      material.emissiveIntensity = flashing
        ? 1.2
        : Number(material.userData.baseEmissiveIntensity ?? 0)
    }
  }

  // The soundscape already spaces samples internally; only submit the nearest
  // candidate a few times per second instead of calling AudioContext per zombie.
  if (zombieMoanTimer <= 0 && nearestMoanDistance < 68) {
    playZombieMoan(nearestMoanDistance)
    zombieMoanTimer = 0.22
  }
}

function updateWave`)

  writeFileSync(mainPath, main)
  console.log('Applied persistent single-mesh zombies, readable deaths, and thermal CPU reductions.')
} else {
  console.log('The persistent zombie overhaul is already applied.')
}
