import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const mainPath = resolve(root, 'src/main.ts')
const zombieModelPath = resolve(root, 'src/zombie-model.ts')
const marker = '// DEADWATER_STATIC_ZOMBIE_THERMAL_BUDGET_V33'

const zombieModel = `import * as THREE from 'three'
import { ZOMBIE_SPRITE_ATLAS_WEBP_V32 } from './generated-zombie-sprites-v32'

export type ZombieAnimationState = 'walk' | 'run' | 'attack' | 'death'

export const ZOMBIE_DISPLAY_HEIGHT = 2.34
export const ZOMBIE_FORWARD_YAW = -Math.PI / 2
export const ZOMBIE_MESHES_PER_VISUAL = 1

export type ZombieVisual = {
  group: THREE.Group
  parts: THREE.Mesh[]
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  billboard: THREE.Group
  animationState: ZombieAnimationState
  deathProgress: number
  fallDirection: number
  disposed: boolean
}

let sharedAtlas: THREE.Texture | null = null
let sharedGeometry: THREE.PlaneGeometry | null = null
let assetFailed = false

function ensureAtlas(): THREE.Texture {
  if (sharedAtlas) return sharedAtlas
  const loader = new THREE.TextureLoader()
  sharedAtlas = loader.load(
    ZOMBIE_SPRITE_ATLAS_WEBP_V32,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = true
      texture.anisotropy = 2
      texture.needsUpdate = true
    },
    undefined,
    () => { assetFailed = true },
  )
  sharedAtlas.colorSpace = THREE.SRGBColorSpace
  sharedAtlas.minFilter = THREE.LinearMipmapLinearFilter
  sharedAtlas.magFilter = THREE.LinearFilter
  sharedAtlas.generateMipmaps = true
  return sharedAtlas
}

function ensureGeometry(): THREE.PlaneGeometry {
  if (sharedGeometry) return sharedGeometry
  sharedGeometry = new THREE.PlaneGeometry(1, 1)
  const uv = sharedGeometry.getAttribute('uv')
  const u0 = 0
  const u1 = 1 / 3
  const v0 = 1 / 2
  const v1 = 1
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(
      index,
      THREE.MathUtils.lerp(u0, u1, uv.getX(index)),
      THREE.MathUtils.lerp(v0, v1, uv.getY(index)),
    )
  }
  uv.needsUpdate = true
  sharedGeometry.computeBoundingBox()
  sharedGeometry.computeBoundingSphere()
  return sharedGeometry
}

function makeMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: ensureAtlas(),
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.16,
    depthWrite: true,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: false,
  })
}

export const zombieAssetReady: Promise<boolean> = Promise.resolve(true)

export function isZombieAssetReady(): boolean {
  return true
}

export function didZombieAssetFail(): boolean {
  return assetFailed
}

export function createTexturedZombieVisual(): ZombieVisual {
  const group = new THREE.Group()
  group.name = 'grounded-static-character-sprite-v33'
  group.userData.flashActive = false

  const billboard = new THREE.Group()
  billboard.name = 'cylindrical-zombie-billboard'
  group.add(billboard)

  const mesh = new THREE.Mesh(ensureGeometry(), makeMaterial())
  mesh.name = 'static-character-sprite'
  mesh.scale.set(1.46, ZOMBIE_DISPLAY_HEIGHT, 1)
  mesh.position.y = ZOMBIE_DISPLAY_HEIGHT * 0.5
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = true
  mesh.renderOrder = 4
  billboard.add(mesh)

  // Only yaw toward the camera. Keeping the sprite vertical makes the feet stay
  // planted instead of tilting like a card whenever the player looks up or down.
  const cameraWorld = new THREE.Vector3()
  const zombieWorld = new THREE.Vector3()
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldPosition(cameraWorld)
    group.getWorldPosition(zombieWorld)
    const worldYaw = Math.atan2(
      cameraWorld.x - zombieWorld.x,
      cameraWorld.z - zombieWorld.z,
    )
    billboard.rotation.y = worldYaw - group.rotation.y
  }

  group.rotation.y = ZOMBIE_FORWARD_YAW
  return {
    group,
    parts: [mesh],
    mesh,
    billboard,
    animationState: Math.random() < 0.32 ? 'run' : 'walk',
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
  if (visual.disposed || visual.animationState === 'death' || visual.animationState === next) return
  visual.animationState = next
}

export function beginZombieDeath(visual: ZombieVisual): void {
  if (visual.disposed) return
  visual.animationState = 'death'
  visual.deathProgress = 0
  visual.mesh.material.color.setHex(0xd5aaa1)
}

export function advanceZombieAnimation(
  visual: ZombieVisual,
  dt: number,
  _distanceToPlayer: number,
): void {
  if (visual.disposed || visual.animationState !== 'death') return
  visual.deathProgress = Math.min(1, visual.deathProgress + dt / 0.62)
  const fall = 1 - Math.pow(1 - visual.deathProgress, 3)
  visual.mesh.rotation.z = fall * visual.fallDirection * 1.33
  visual.mesh.position.y = ZOMBIE_DISPLAY_HEIGHT * 0.5 - fall * 0.76
  visual.mesh.position.x = fall * visual.fallDirection * 0.24
  visual.mesh.scale.set(
    1.46 * (1 + fall * 0.12),
    ZOMBIE_DISPLAY_HEIGHT * (1 - fall * 0.12),
    1,
  )
  visual.mesh.material.opacity = 1
}

export function disposeZombieVisual(visual: ZombieVisual): void {
  if (visual.disposed) return
  visual.disposed = true
  visual.mesh.onBeforeRender = () => undefined
  visual.mesh.material.dispose()
  // The atlas and geometry are shared for the full session.
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
    '  lastValidX: number\n  lastValidZ: number\n}',
    '  lastValidX: number\n  lastValidZ: number\n  validationTimer: number\n  groundTimer: number\n  targetGroundY: number\n}',
    'zombie thermal fields',
  )

  replaceOnce(
    'let zombieMoanTimer = 0\n',
    'let zombieMoanTimer = 0\nlet zombieBucketTimer = 0\n' + marker + '\n',
    'zombie runtime budget marker',
  )

  replaceOnce(
    '    lastValidX: position.x,\n    lastValidZ: position.z,\n',
    '    lastValidX: position.x,\n    lastValidZ: position.z,\n    validationTimer: Math.random() * 0.16,\n    groundTimer: Math.random() * 0.08,\n    targetGroundY: expandedWorld.heightAt(position.x, position.z),\n',
    'zombie runtime budget initialization',
  )

  const updatePattern = /function updateZombies\(dt: number, _elapsed: number\): void \{[\s\S]*?\n\}\n\nfunction updateWave/
  if (!updatePattern.test(main)) throw new Error('Could not patch the zombie update budget')
  main = main.replace(updatePattern, `function updateZombies(dt: number, _elapsed: number): void {
  rebuildNavigationFlow()
  zombieMoanTimer = Math.max(0, zombieMoanTimer - dt)
  zombieBucketTimer -= dt
  const cellSize = 3.1

  // Separation buckets do not need to be rebuilt at display refresh rate. The
  // zombies continue moving every frame; only their neighbour lookup is cached.
  if (zombieBucketTimer <= 0) {
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
    zombieBucketTimer = 0.08
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

    zombie.attackTimer -= dt
    zombie.flashTimer = Math.max(0, zombie.flashTimer - dt)
    const deltaX = player.position.x - zombie.group.position.x
    const deltaZ = player.position.z - zombie.group.position.z
    const distanceSquared = deltaX * deltaX + deltaZ * deltaZ
    const distance = Math.sqrt(Math.max(distanceSquared, 0.000001))
    nearestMoanDistance = Math.min(nearestMoanDistance, distance)

    // Full island/collider validation is expensive and redundant while a zombie
    // is moving normally. Run it periodically, or immediately when it is stuck.
    zombie.validationTimer -= dt
    if (zombie.validationTimer <= 0 || zombie.stuckTimer > 0.62) {
      recoverZombieOutsideWalls(zombie)
      zombie.validationTimer = (
        distanceSquared > 55 * 55 ? 0.48 : distanceSquared > 28 * 28 ? 0.26 : 0.13
      ) + zombie.aiPhase * 0.035
    }

    if (distanceSquared > 1.22 * 1.22) {
      zombie.steerTimer -= dt
      if (zombie.steerTimer <= 0) {
        const inverseDistance = 1 / distance
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

        // Far-away silhouettes cannot visually overlap on screen enough to justify
        // nine-bucket neighbour separation. Their pathfinding and pursuit remain.
        if (distanceSquared < 42 * 42) {
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
                const otherDistanceSquared = otherX * otherX + otherZ * otherZ
                if (otherDistanceSquared > 0.001 && otherDistanceSquared < 1.35 * 1.35) {
                  separationX += otherX / otherDistanceSquared
                  separationZ += otherZ / otherDistanceSquared
                }
              }
            }
          }
        }

        const separationLengthSquared = separationX * separationX + separationZ * separationZ
        if (separationLengthSquared > 1.2 * 1.2) {
          const separationScale = 1.2 / Math.sqrt(separationLengthSquared)
          separationX *= separationScale
          separationZ *= separationScale
        }
        const desiredX = flowX + separationX * 0.16
        const desiredZ = flowZ + separationZ * 0.16
        const desiredLength = Math.sqrt(desiredX * desiredX + desiredZ * desiredZ) || 1
        const targetX = desiredX / desiredLength
        const targetZ = desiredZ / desiredLength
        const steering = 1 - Math.exp(-Math.max(0.045, zombie.steerTimer + 0.08) * 8)
        const velocityLengthSquared =
          zombie.velocityX * zombie.velocityX + zombie.velocityZ * zombie.velocityZ
        if (velocityLengthSquared < 0.0001) {
          zombie.velocityX = targetX
          zombie.velocityZ = targetZ
        } else {
          zombie.velocityX += (targetX - zombie.velocityX) * steering
          zombie.velocityZ += (targetZ - zombie.velocityZ) * steering
          const velocityLength = Math.sqrt(
            zombie.velocityX * zombie.velocityX + zombie.velocityZ * zombie.velocityZ,
          ) || 1
          zombie.velocityX /= velocityLength
          zombie.velocityZ /= velocityLength
        }
        zombie.steerTimer = (
          distanceSquared > 55 * 55 ? 0.13 : distanceSquared > 28 * 28 ? 0.082 : 0.05
        ) + zombie.aiPhase * 0.014
      }

      const previousX = zombie.group.position.x
      const previousZ = zombie.group.position.z
      const pursuitBoost = 1 + THREE.MathUtils.clamp((distance - 58) / 150, 0, 0.42)
      const moved = moveZombie(
        zombie,
        zombie.velocityX * zombie.speed * pursuitBoost * dt,
        zombie.velocityZ * zombie.speed * pursuitBoost * dt,
      )
      const movementX = zombie.group.position.x - previousX
      const movementZ = zombie.group.position.z - previousZ
      let movementSquared = movementX * movementX + movementZ * movementZ
      const minimumMovement = zombie.speed * dt * 0.1
      if (!moved || movementSquared < minimumMovement * minimumMovement) {
        zombie.stuckTimer += dt
      } else {
        zombie.stuckTimer = Math.max(0, zombie.stuckTimer - dt * 2.2)
      }
      if (zombie.stuckTimer > 0.62) {
        const inverseDistance = 1 / distance
        nudgeZombieAlongWall(zombie, deltaX * inverseDistance, deltaZ * inverseDistance)
        const nudgedX = zombie.group.position.x - previousX
        const nudgedZ = zombie.group.position.z - previousZ
        movementSquared = nudgedX * nudgedX + nudgedZ * nudgedZ
      }
      if (movementSquared > 0.000001) {
        const targetYaw = Math.atan2(
          -(zombie.group.position.x - previousX),
          -(zombie.group.position.z - previousZ),
        )
        zombie.group.rotation.y = lerpRadians(
          zombie.group.rotation.y,
          targetYaw,
          1 - Math.exp(-dt * 10),
        )
      }
      setZombieAnimation(zombie.visual, zombie.runner ? 'run' : 'walk')
    } else if (!state.elevatedTower && zombie.attackTimer <= 0) {
      zombie.attackTimer = zombie.attackDelay
      soundscape.zombieAttack()
      damagePlayer(zombie.damage)
    }

    if (distanceSquared <= 1.22 * 1.22) setZombieAnimation(zombie.visual, 'attack')

    // Terrain is sampled at a distance-aware cadence, then visually smoothed each
    // frame. This preserves ground contact without repeating the same lookup 60x/s.
    zombie.groundTimer -= dt
    if (zombie.groundTimer <= 0) {
      zombie.targetGroundY = expandedWorld.heightAt(
        zombie.group.position.x,
        zombie.group.position.z,
      )
      zombie.groundTimer = (
        distanceSquared > 55 * 55 ? 0.22 : distanceSquared > 28 * 28 ? 0.13 : 0.065
      ) + zombie.aiPhase * 0.025
    }
    zombie.group.position.y = THREE.MathUtils.damp(
      zombie.group.position.y,
      zombie.targetGroundY,
      22,
      dt,
    )

    const flashing = zombie.flashTimer > 0
    if (Boolean(zombie.group.userData.flashActive) !== flashing) {
      zombie.group.userData.flashActive = flashing
      zombie.visual.mesh.material.color.setHex(flashing ? 0xff6f61 : 0xffffff)
    }
  }

  if (zombieMoanTimer <= 0 && nearestMoanDistance < 68) {
    playZombieMoan(nearestMoanDistance)
    zombieMoanTimer = 0.22
  }
}

function updateWave`)

  const adaptivePattern = /function updateAdaptiveResolution\(rawDelta: number\): void \{[\s\S]*?\n\}/
  if (!adaptivePattern.test(main)) throw new Error('Could not lock the visual resolution')
  main = main.replace(adaptivePattern, `function updateAdaptiveResolution(_rawDelta: number): void {
  // Keep the authored pixel ratio fixed. Thermal savings come from avoiding work,
  // never from silently lowering image quality during play.
}`)

  replaceOnce(
    'let adaptiveFrames = 0\n\nfunction updateAdaptiveResolution',
    'let adaptiveFrames = 0\nlet renderBudgetMilliseconds = 0\nlet previousAnimationTimestamp = 0\n\nfunction updateAdaptiveResolution',
    'render cadence state',
  )

  const animatePattern = /function animate\(\): void \{[\s\S]*?\n\}\n\nupdateQuestStrip\(\)/
  if (!animatePattern.test(main)) throw new Error('Could not cap runaway high-refresh rendering')
  main = main.replace(animatePattern, `function animate(timestamp = performance.now()): void {
  requestAnimationFrame(animate)

  if (previousAnimationTimestamp === 0) previousAnimationTimestamp = timestamp
  const animationDelta = Math.min(100, timestamp - previousAnimationTimestamp)
  previousAnimationTimestamp = timestamp

  if (document.hidden) {
    renderBudgetMilliseconds = 0
    clock.getDelta()
    return
  }

  // A 90/120/144 Hz display otherwise makes the WebView render the complete game
  // 90/120/144 times per second. The authored target is 60; an accumulator keeps
  // that target accurately even when the display refresh is not a multiple of 60.
  renderBudgetMilliseconds += animationDelta
  const targetFrameMilliseconds = 1000 / 60
  if (renderBudgetMilliseconds + 0.15 < targetFrameMilliseconds) return
  renderBudgetMilliseconds %= targetFrameMilliseconds

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
  if (!state.paused && !state.gameOver) {
    atmosphereFrame += 1
    if (!isTouch || atmosphereFrame % 2 === 0) {
      updateAtmosphere(isTouch ? dt * 2 : dt, elapsed)
    }
  }
  soundscape.update(dt)
  renderer.render(scene, camera)
}

updateQuestStrip()`)

  const districtWrite = '  ui.district.textContent = expandedWorld.districtAt(player.position.x, player.position.z)\n'
  const districtCached = `  const districtName = expandedWorld.districtAt(player.position.x, player.position.z)
  if (ui.district.textContent !== districtName) ui.district.textContent = districtName
`
  if (!main.includes(districtWrite)) throw new Error('Could not cache district text')
  main = main.replaceAll(districtWrite, districtCached)

  const vehicleStatusPattern = /function updateVehicleStatus\(vehicle: Driveable\): void \{[\s\S]*?\n\}/
  if (!vehicleStatusPattern.test(main)) throw new Error('Could not cache vehicle status text')
  main = main.replace(vehicleStatusPattern, `function updateVehicleStatus(vehicle: Driveable): void {
  const text = vehicle.label + ' · FUEL ' + vehicleFuelPercent(vehicle) + '% · USE TO EXIT'
  if (vehicleStatus.textContent !== text) vehicleStatus.textContent = text
}`)

  replaceOnce(
    'function updateInteractionPrompt(): void {\n',
    'let nextInteractionPromptAt = 0\nfunction updateInteractionPrompt(): void {\n  if (elapsed < nextInteractionPromptAt) return\n  nextInteractionPromptAt = elapsed + 0.1\n',
    'interaction prompt cadence',
  )
  replaceOnce(
    "  interactionPrompt.textContent = text\n  interactionPrompt.classList.toggle('visible', text.length > 0)\n",
    "  if (interactionPrompt.textContent !== text) interactionPrompt.textContent = text\n  const visible = text.length > 0\n  if (interactionPrompt.classList.contains('visible') !== visible) {\n    interactionPrompt.classList.toggle('visible', visible)\n  }\n",
    'interaction prompt DOM cache',
  )

  writeFileSync(mainPath, main)
  console.log('Applied a grounded static character sprite and no-quality-loss thermal budgets.')
} else {
  console.log('The static zombie and thermal budget pass is already applied.')
}
