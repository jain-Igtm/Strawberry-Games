import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ATLAS_TILES,
  mapGeometryToAtlas,
  zombieAtlasTexture,
  type AtlasTile,
} from './texture-atlas'

export type ZombieModelMaterials = {
  skin: THREE.MeshStandardMaterial
  cloth: THREE.MeshStandardMaterial
  clothAlt: THREE.MeshStandardMaterial
  rust: THREE.MeshStandardMaterial
  warning: THREE.MeshStandardMaterial
  ember: THREE.MeshBasicMaterial
}

export type ZombieRig = {
  head: THREE.Bone
  leftArm: THREE.Bone
  rightArm: THREE.Bone
  leftLeg: THREE.Bone
  rightLeg: THREE.Bone
}

export type ZombieVisual = {
  group: THREE.Group
  parts: THREE.Mesh[]
  mesh: THREE.SkinnedMesh
  rig: ZombieRig
}

type PartTransform = {
  position: THREE.Vector3
  rotation?: THREE.Euler
  scale?: THREE.Vector3
}

function skinGeometry(
  geometry: THREE.BufferGeometry,
  tile: AtlasTile,
  boneIndex: number,
  transform: PartTransform,
): THREE.BufferGeometry {
  mapGeometryToAtlas(geometry, tile)
  const quaternion = new THREE.Quaternion().setFromEuler(
    transform.rotation ?? new THREE.Euler(),
  )
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    transform.position,
    quaternion,
    transform.scale ?? new THREE.Vector3(1, 1, 1),
  ))

  const vertexCount = geometry.getAttribute('position').count
  const indices = new Uint16Array(vertexCount * 4)
  const weights = new Float32Array(vertexCount * 4)
  for (let index = 0; index < vertexCount; index += 1) {
    indices[index * 4] = boneIndex
    weights[index * 4] = 1
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
  return geometry
}

function buildSharedZombieGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    skinGeometry(
      new THREE.CylinderGeometry(0.31, 0.4, 0.86, 7, 1),
      ATLAS_TILES.topRight,
      0,
      {
        position: new THREE.Vector3(0, 1.38, 0.02),
        rotation: new THREE.Euler(0.1, 0, 0),
        scale: new THREE.Vector3(1, 1, 0.78),
      },
    ),
    skinGeometry(
      new THREE.IcosahedronGeometry(0.31, 1),
      ATLAS_TILES.bottomLeft,
      0,
      {
        position: new THREE.Vector3(0, 0.94, 0),
        scale: new THREE.Vector3(1, 0.62, 0.76),
      },
    ),
    skinGeometry(
      new THREE.CylinderGeometry(0.09, 0.13, 0.28, 7),
      ATLAS_TILES.topLeft,
      1,
      {
        position: new THREE.Vector3(0.015, 1.84, 0.08),
        rotation: new THREE.Euler(0.18, 0, 0),
      },
    ),
    skinGeometry(
      new THREE.IcosahedronGeometry(0.255, 1),
      ATLAS_TILES.topLeft,
      1,
      {
        position: new THREE.Vector3(0.025, 2.08, 0.12),
        rotation: new THREE.Euler(-0.08, 0, 0.04),
        scale: new THREE.Vector3(0.92, 1.08, 0.9),
      },
    ),
    skinGeometry(
      new THREE.IcosahedronGeometry(0.16, 0),
      ATLAS_TILES.topLeft,
      1,
      {
        position: new THREE.Vector3(0.035, 1.9, 0.18),
        rotation: new THREE.Euler(-0.08, 0, 0.05),
        scale: new THREE.Vector3(1, 0.58, 0.82),
      },
    ),
    skinGeometry(
      new THREE.IcosahedronGeometry(0.09, 0),
      ATLAS_TILES.bottomRight,
      1,
      {
        position: new THREE.Vector3(-0.12, 2.14, 0.31),
        scale: new THREE.Vector3(1.35, 0.72, 0.24),
      },
    ),
    skinGeometry(
      new THREE.IcosahedronGeometry(0.105, 0),
      ATLAS_TILES.bottomRight,
      0,
      {
        position: new THREE.Vector3(0.15, 1.45, 0.3),
        scale: new THREE.Vector3(1, 1.5, 0.24),
      },
    ),
    skinGeometry(
      new THREE.CapsuleGeometry(0.105, 0.68, 2, 6),
      ATLAS_TILES.topLeft,
      2,
      {
        position: new THREE.Vector3(-0.43, 1.28, 0.08),
        rotation: new THREE.Euler(-0.46, 0, -0.11),
      },
    ),
    skinGeometry(
      new THREE.IcosahedronGeometry(0.115, 0),
      ATLAS_TILES.topLeft,
      2,
      {
        position: new THREE.Vector3(-0.5, 0.82, 0.28),
        scale: new THREE.Vector3(0.72, 1.08, 0.58),
      },
    ),
    skinGeometry(
      new THREE.CapsuleGeometry(0.105, 0.7, 2, 6),
      ATLAS_TILES.topLeft,
      3,
      {
        position: new THREE.Vector3(0.43, 1.27, 0.09),
        rotation: new THREE.Euler(-0.52, 0, 0.11),
      },
    ),
    skinGeometry(
      new THREE.IcosahedronGeometry(0.115, 0),
      ATLAS_TILES.topLeft,
      3,
      {
        position: new THREE.Vector3(0.5, 0.81, 0.3),
        scale: new THREE.Vector3(0.72, 1.08, 0.58),
      },
    ),
    skinGeometry(
      new THREE.CapsuleGeometry(0.12, 0.7, 2, 6),
      ATLAS_TILES.bottomLeft,
      4,
      {
        position: new THREE.Vector3(-0.16, 0.54, 0),
        rotation: new THREE.Euler(0, 0, -0.025),
      },
    ),
    skinGeometry(
      new THREE.CapsuleGeometry(0.105, 0.22, 2, 5),
      ATLAS_TILES.bottomLeft,
      4,
      {
        position: new THREE.Vector3(-0.16, 0.105, -0.14),
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      },
    ),
    skinGeometry(
      new THREE.CapsuleGeometry(0.12, 0.7, 2, 6),
      ATLAS_TILES.bottomLeft,
      5,
      {
        position: new THREE.Vector3(0.16, 0.54, 0.01),
        rotation: new THREE.Euler(0, 0, 0.035),
      },
    ),
    skinGeometry(
      new THREE.CapsuleGeometry(0.105, 0.22, 2, 5),
      ATLAS_TILES.bottomLeft,
      5,
      {
        position: new THREE.Vector3(0.16, 0.105, -0.14),
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      },
    ),
  ]

  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  if (!merged) throw new Error('Unable to merge the shared zombie geometry')
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  merged.userData.sharedZombieGeometry = true
  return merged
}

const sharedZombieGeometry = buildSharedZombieGeometry()

function createRig(): { root: THREE.Bone; bones: THREE.Bone[]; rig: ZombieRig } {
  const root = new THREE.Bone()
  root.name = 'zombie-root'

  const head = new THREE.Bone()
  head.name = 'head'
  head.position.set(0, 1.84, 0.08)

  const leftArm = new THREE.Bone()
  leftArm.name = 'left-arm'
  leftArm.position.set(-0.34, 1.62, 0.03)

  const rightArm = new THREE.Bone()
  rightArm.name = 'right-arm'
  rightArm.position.set(0.34, 1.62, 0.03)

  const leftLeg = new THREE.Bone()
  leftLeg.name = 'left-leg'
  leftLeg.position.set(-0.16, 0.96, 0)

  const rightLeg = new THREE.Bone()
  rightLeg.name = 'right-leg'
  rightLeg.position.set(0.16, 0.96, 0)

  root.add(head, leftArm, rightArm, leftLeg, rightLeg)
  return {
    root,
    bones: [root, head, leftArm, rightArm, leftLeg, rightLeg],
    rig: { head, leftArm, rightArm, leftLeg, rightLeg },
  }
}

export function createRoundedZombieVisual(base: ZombieModelMaterials): ZombieVisual {
  const material = (Math.random() > 0.5 ? base.cloth : base.clothAlt).clone()
  material.map = zombieAtlasTexture
  material.color.setHex(0xd2cec5)
  material.color.offsetHSL(
    (Math.random() - 0.5) * 0.025,
    -0.08,
    (Math.random() - 0.5) * 0.055,
  )
  material.roughness = 0.98
  material.metalness = 0
  material.flatShading = false

  const { root, bones, rig } = createRig()
  const mesh = new THREE.SkinnedMesh(sharedZombieGeometry, material)
  mesh.name = 'textured-zombie'
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = true
  mesh.add(root)
  mesh.bind(new THREE.Skeleton(bones))
  mesh.normalizeSkinWeights()
  mesh.userData.sharedGeometry = true

  const group = new THREE.Group()
  group.userData.flashActive = false
  group.add(mesh)
  group.rotation.x = 0.025 + Math.random() * 0.055
  group.rotation.z = (Math.random() - 0.5) * 0.055

  return {
    group,
    parts: [mesh],
    mesh,
    rig,
  }
}
