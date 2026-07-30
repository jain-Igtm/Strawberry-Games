import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { QUATERNIUS_ZOMBIE_GLB_V17 } from './generated-assets-v17'

export type ZombieAnimationState = 'walk' | 'run' | 'attack' | 'death'

export type ZombieVisual = {
  group: THREE.Group
  parts: THREE.Mesh[]
  mixer: THREE.AnimationMixer
  actions: Record<ZombieAnimationState, THREE.AnimationAction>
  animationState: ZombieAnimationState
  animationAccumulator: number
  disposed: boolean
}

type ZombieAsset = {
  scene: THREE.Group
  clips: Record<ZombieAnimationState, THREE.AnimationClip>
  groundOffset: number
}

let zombieAsset: ZombieAsset | null = null
let zombieAssetFailed = false

function findClip(
  animations: THREE.AnimationClip[],
  name: string,
): THREE.AnimationClip {
  const clip = THREE.AnimationClip.findByName(animations, name)
  if (!clip) throw new Error(`Missing zombie animation: ${name}`)
  return clip
}

function removeRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const clean = clip.clone()
  clean.tracks = clean.tracks.filter((track) => {
    const rootPosition =
      track.name === 'Root.position' ||
      track.name === 'CharacterArmature.position'
    return !rootPosition
  })
  clean.resetDuration()
  return clean
}

function prepareZombieAsset(gltf: GLTF): ZombieAsset {
  const bounds = new THREE.Box3().setFromObject(gltf.scene)
  const groundOffset = Number.isFinite(bounds.min.y) ? -bounds.min.y : 0
  return {
    scene: gltf.scene,
    groundOffset,
    clips: {
      walk: removeRootMotion(findClip(gltf.animations, 'Walk')),
      run: removeRootMotion(findClip(gltf.animations, 'Run')),
      attack: removeRootMotion(findClip(gltf.animations, 'Idle_Attack')),
      death: removeRootMotion(findClip(gltf.animations, 'Death')),
    },
  }
}

export const zombieAssetReady: Promise<boolean> =
  typeof window === 'undefined'
    ? Promise.resolve(false)
    : new Promise((resolve) => {
        const loader = new GLTFLoader()
        try {
          loader.load(
            QUATERNIUS_ZOMBIE_GLB_V17,
            (gltf) => {
              try {
                zombieAsset = prepareZombieAsset(gltf)
                resolve(true)
              } catch {
                zombieAssetFailed = true
                resolve(false)
              }
            },
            undefined,
            () => {
              zombieAssetFailed = true
              resolve(false)
            },
          )
        } catch {
          zombieAssetFailed = true
          resolve(false)
        }
      })

export function isZombieAssetReady(): boolean {
  return zombieAsset !== null
}

export function didZombieAssetFail(): boolean {
  return zombieAssetFailed
}

function cloneZombieMaterial(
  source: THREE.Material,
  tint: number,
): THREE.Material {
  const material = source.clone()
  if (material instanceof THREE.MeshStandardMaterial) {
    material.color.offsetHSL(
      tint * 0.015,
      -0.035 + Math.abs(tint) * 0.02,
      tint * 0.035,
    )
    material.roughness = 0.96
    material.metalness = 0
    material.flatShading = false
  }
  return material
}

export function createTexturedZombieVisual(): ZombieVisual | null {
  const asset = zombieAsset
  if (!asset) return null

  const model = cloneSkeleton(asset.scene) as THREE.Group
  const parts: THREE.Mesh[] = []
  const tint = Math.random() - 0.5
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => cloneZombieMaterial(material, tint))
      : cloneZombieMaterial(object.material, tint)
    object.castShadow = false
    object.receiveShadow = false
    object.frustumCulled = true
    parts.push(object)
  })

  // The source character is intentionally stocky. This non-uniform presentation
  // scale restores adult proportions without changing its authored mesh,
  // texture, rig, or animation.
  model.position.y = asset.groundOffset
  model.rotation.y = Math.PI
  model.scale.set(0.78, 1.55, 0.78)

  const group = new THREE.Group()
  group.name = 'cc0-textured-zombie'
  group.userData.flashActive = false
  group.add(model)

  const mixer = new THREE.AnimationMixer(model)
  const actions = {
    walk: mixer.clipAction(asset.clips.walk),
    run: mixer.clipAction(asset.clips.run),
    attack: mixer.clipAction(asset.clips.attack),
    death: mixer.clipAction(asset.clips.death),
  }
  actions.death.setLoop(THREE.LoopOnce, 1)
  actions.death.clampWhenFinished = true
  const animationState: ZombieAnimationState =
    Math.random() < 0.32 ? 'run' : 'walk'
  const initial = actions[animationState]
  initial.play()
  initial.time = Math.random() * Math.max(0.01, initial.getClip().duration)

  return {
    group,
    parts,
    mixer,
    actions,
    animationState,
    animationAccumulator: Math.random() * 0.035,
    disposed: false,
  }
}

export function setZombieAnimation(
  visual: ZombieVisual,
  next: ZombieAnimationState,
  playbackRate = 1,
): void {
  if (visual.disposed) return
  const nextAction = visual.actions[next]
  nextAction.setEffectiveTimeScale(playbackRate)
  if (visual.animationState === next) return

  const previous = visual.actions[visual.animationState]
  nextAction.reset().setEffectiveTimeScale(playbackRate).play()
  if (next === 'death') {
    previous.fadeOut(0.1)
    nextAction.fadeIn(0.08)
  } else {
    previous.crossFadeTo(nextAction, 0.16, true)
  }
  visual.animationState = next
}

export function advanceZombieAnimation(
  visual: ZombieVisual,
  dt: number,
  distanceToPlayer: number,
): void {
  if (visual.disposed) return
  visual.animationAccumulator += dt
  const interval =
    visual.animationState === 'death'
      ? 1 / 30
      : distanceToPlayer > 58
        ? 1 / 12
        : distanceToPlayer > 30
          ? 1 / 20
          : 1 / 30
  if (visual.animationAccumulator < interval) return
  visual.mixer.update(Math.min(0.12, visual.animationAccumulator))
  visual.animationAccumulator = 0
}

export function disposeZombieVisual(visual: ZombieVisual): void {
  if (visual.disposed) return
  visual.disposed = true
  visual.mixer.stopAllAction()
  visual.mixer.uncacheRoot(visual.group.children[0])
  for (const part of visual.parts) {
    const materials = Array.isArray(part.material)
      ? part.material
      : [part.material]
    for (const material of materials) material.dispose()
  }
}
