import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import {
  PIXELHOUSE_ZOMBIE_ATTACK_GLB_V18,
  PIXELHOUSE_ZOMBIE_DEATH_GLB_V18,
  PIXELHOUSE_ZOMBIE_WALK_GLB_V18,
} from './generated-assets-v18'
import { MUTED_ZOMBIE_DIFFUSE_WEBP_V19 } from './generated-visual-assets-v19'

export type ZombieAnimationState = 'walk' | 'run' | 'attack' | 'death'

export const ZOMBIE_DISPLAY_HEIGHT = 2.02
export const ZOMBIE_FORWARD_YAW = -Math.PI / 2

export type ZombieVisual = {
  group: THREE.Group
  mixerRoot: THREE.Group
  parts: THREE.Mesh[]
  mixer: THREE.AnimationMixer
  actions: Record<ZombieAnimationState, THREE.AnimationAction>
  animationState: ZombieAnimationState
  animationAccumulator: number
  disposed: boolean
}

type ZombieAsset = {
  scene: THREE.Group
  texture: THREE.Texture
  clips: Record<ZombieAnimationState, THREE.AnimationClip>
  modelCenter: THREE.Vector3
  modelScale: number
}

let zombieAsset: ZombieAsset | null = null
let zombieAssetFailed = false

function removeRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const clean = clip.clone()
  clean.tracks = clean.tracks.filter((track) => {
    const rootPosition =
      track.name === 'Root.position' ||
      track.name === 'CharacterArmature.position' ||
      track.name === 'Bip01.position' ||
      track.name === 'Bip01_Footsteps.position'
    return !rootPosition
  })
  clean.resetDuration()
  return clean
}

function animationFrom(gltf: GLTF, name: string): THREE.AnimationClip {
  const source = gltf.animations[0]
  if (!source) throw new Error(`Missing Pixelhouse zombie animation: ${name}`)
  const clip = removeRootMotion(source)
  clip.name = name
  return clip
}

function loadGltf(loader: GLTFLoader, source: string): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    loader.load(source, resolve, undefined, reject)
  })
}

function loadZombieTexture(): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      MUTED_ZOMBIE_DIFFUSE_WEBP_V19,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = true
        resolve(texture)
      },
      undefined,
      reject,
    )
  })
}

function prepareZombieAsset(
  walk: GLTF,
  attack: GLTF,
  death: GLTF,
  texture: THREE.Texture,
): ZombieAsset {
  const bounds = new THREE.Box3().setFromObject(walk.scene)
  const size = bounds.getSize(new THREE.Vector3())
  const modelScale =
    Number.isFinite(size.y) && size.y > 0.01
      ? ZOMBIE_DISPLAY_HEIGHT / size.y
      : 1
  const modelCenter = bounds.getCenter(new THREE.Vector3())
  modelCenter.y = bounds.min.y
  const walkClip = animationFrom(walk, 'Walk')
  const runClip = walkClip.clone()
  runClip.name = 'Run'
  return {
    scene: walk.scene,
    texture,
    modelCenter,
    modelScale,
    clips: {
      walk: walkClip,
      run: runClip,
      attack: animationFrom(attack, 'Attack'),
      death: animationFrom(death, 'Death'),
    },
  }
}

export const zombieAssetReady: Promise<boolean> =
  typeof window === 'undefined'
    ? Promise.resolve(false)
    : new Promise((resolve) => {
        const loader = new GLTFLoader()
        void Promise.all([
          loadGltf(loader, PIXELHOUSE_ZOMBIE_WALK_GLB_V18),
          loadGltf(loader, PIXELHOUSE_ZOMBIE_ATTACK_GLB_V18),
          loadGltf(loader, PIXELHOUSE_ZOMBIE_DEATH_GLB_V18),
          loadZombieTexture(),
        ]).then(
          ([walk, attack, death, texture]) => {
            try {
              zombieAsset = prepareZombieAsset(
                walk,
                attack,
                death,
                texture,
              )
              resolve(true)
            } catch {
              zombieAssetFailed = true
              resolve(false)
            }
          },
          () => {
            zombieAssetFailed = true
            resolve(false)
          },
        )
      })

export function isZombieAssetReady(): boolean {
  return zombieAsset !== null
}

export function didZombieAssetFail(): boolean {
  return zombieAssetFailed
}

function cloneZombieMaterial(
  source: THREE.Material,
  texture: THREE.Texture,
  tint: number,
): THREE.Material {
  const material = source.clone()
  if (material instanceof THREE.MeshStandardMaterial) {
    material.map = texture
    material.color.setHSL(
      0.08 + tint * 0.008,
      0.025,
      0.9 + tint * 0.025,
    )
    material.emissive.setHex(0x171615)
    material.emissiveMap = null
    material.emissiveIntensity = 0.24
    material.userData.baseEmissive = 0x171615
    material.userData.baseEmissiveIntensity = 0.24
    material.roughness = 1
    material.metalness = 0
    // Smooth normals keep the already modest mesh from turning into a field of
    // high-contrast facets; the intentionally tiny diffuse supplies the simple
    // shape/color breakup instead.
    material.flatShading = false
    material.dithering = true
    material.needsUpdate = true
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
      ? object.material.map((material) =>
          cloneZombieMaterial(material, asset.texture, tint))
      : cloneZombieMaterial(object.material, asset.texture, tint)
    object.castShadow = false
    object.receiveShadow = false
    object.frustumCulled = true
    parts.push(object)
  })

  // Preserve the authored adult proportions. Center and normalize once with a
  // uniform scale; non-uniform scaling is what made the previous character read
  // as a waddling mascot.
  model.scale.setScalar(asset.modelScale)
  model.position.set(
    -asset.modelCenter.x * asset.modelScale,
    -asset.modelCenter.y * asset.modelScale,
    -asset.modelCenter.z * asset.modelScale,
  )
  const facing = new THREE.Group()
  // Pixelhouse's visible front points along -X. Three.js agents travel along
  // local -Z, so this quarter turn makes the chest and face lead the movement.
  facing.rotation.y = ZOMBIE_FORWARD_YAW
  facing.add(model)

  const group = new THREE.Group()
  group.name = 'muted-low-detail-zombie'
  group.userData.flashActive = false
  group.add(facing)

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
    mixerRoot: model,
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
  visual.mixer.uncacheRoot(visual.mixerRoot)
  for (const part of visual.parts) {
    const materials = Array.isArray(part.material)
      ? part.material
      : [part.material]
    for (const material of materials) material.dispose()
  }
}
