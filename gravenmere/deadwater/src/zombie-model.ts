import * as THREE from 'three'
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

export type ZombieVisual = {
  group: THREE.Group
  parts: THREE.Mesh[]
  head: THREE.Mesh
  headshotParts: Set<THREE.Mesh>
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  tile?: AtlasTile,
): THREE.Mesh {
  if (tile) mapGeometryToAtlas(geometry, tile)
  const result = new THREE.Mesh(geometry, material)
  result.castShadow = false
  result.receiveShadow = false
  return result
}

function capsule(
  radius: number,
  length: number,
  material: THREE.Material,
  segments = 6,
  tile?: AtlasTile,
): THREE.Mesh {
  return mesh(new THREE.CapsuleGeometry(radius, length, 3, segments), material, tile)
}

export function createRoundedZombieVisual(base: ZombieModelMaterials): ZombieVisual {
  const group = new THREE.Group()
  group.userData.flashActive = false

  const skin = base.skin.clone()
  skin.map = zombieAtlasTexture
  skin.color.setHex(0xd2d0c9)
  skin.color.offsetHSL((Math.random() - 0.5) * 0.05, -0.12, (Math.random() - 0.5) * 0.1)
  const cloth = (Math.random() > 0.48 ? base.cloth : base.clothAlt).clone()
  cloth.map = zombieAtlasTexture
  cloth.color.setHex(0xc2bbb0)
  cloth.color.offsetHSL((Math.random() - 0.5) * 0.04, -0.08, (Math.random() - 0.5) * 0.06)
  const darkCloth = cloth.clone()
  darkCloth.color.setHex(0xa49a8c)
  const wound = base.rust.clone()
  wound.map = zombieAtlasTexture
  wound.color.setHex(0xc0a7a2)
  wound.roughness = 0.94
  const accent = base.warning.clone()
  accent.map = zombieAtlasTexture
  accent.color.setHex(0xaaa198)
  accent.color.offsetHSL((Math.random() - 0.5) * 0.05, -0.34, -0.24)
  const eyeMaterial = base.ember.clone()
  eyeMaterial.opacity = 0.5

  const parts: THREE.Mesh[] = []
  const headshotParts = new Set<THREE.Mesh>()
  const variant = Math.floor(Math.random() * 3)
  const lean = 0.11 + Math.random() * 0.11
  const shoulderTilt = (Math.random() - 0.5) * 0.18

  // Keep the first five entries stable: the animation loop expects arms at 3 and 4.
  const body = mesh(
    new THREE.CylinderGeometry(0.28, 0.38, 0.92, 7),
    cloth,
    ATLAS_TILES.topRight,
  )
  body.position.set(0, 1.36, 0.02)
  body.scale.z = 0.76
  body.rotation.x = lean
  body.rotation.z = shoulderTilt * 0.35

  const head = mesh(new THREE.IcosahedronGeometry(0.225, 1), skin, ATLAS_TILES.topLeft)
  head.position.set(0.035, 2.1, 0.15)
  head.scale.set(0.9, 1.06, 0.92)
  head.rotation.x = -0.1
  head.rotation.z = (Math.random() - 0.5) * 0.22

  const jaw = mesh(new THREE.IcosahedronGeometry(0.145, 1), skin, ATLAS_TILES.topLeft)
  jaw.position.set(0.045, 1.91, 0.2)
  jaw.scale.set(1.02, 0.58, 0.8)
  jaw.rotation.x = -0.08
  jaw.rotation.z = 0.05 + (Math.random() - 0.5) * 0.08

  const leftArm = capsule(0.09, 0.76, skin, 6, ATLAS_TILES.topLeft)
  leftArm.position.set(-0.42, 1.28, 0.08)
  leftArm.rotation.x = variant === 1 ? -0.32 : -0.64
  leftArm.rotation.z = -0.12 - Math.random() * 0.1

  const rightArm = capsule(0.09, 0.79, skin, 6, ATLAS_TILES.topLeft)
  rightArm.position.set(0.42, 1.26, 0.1)
  rightArm.rotation.x = variant === 2 ? -0.2 : -0.72
  rightArm.rotation.z = 0.1 + Math.random() * 0.12

  const leftLeg = capsule(0.105, 0.84, darkCloth, 6, ATLAS_TILES.bottomLeft)
  leftLeg.position.set(-0.16, 0.55, 0)
  leftLeg.rotation.z = -0.025

  const rightLeg = capsule(0.105, 0.84, darkCloth, 6, ATLAS_TILES.bottomLeft)
  rightLeg.position.set(0.16, 0.55, 0.015)
  rightLeg.rotation.z = 0.035

  const shoulders = capsule(0.105, 0.62, cloth, 6, ATLAS_TILES.topRight)
  shoulders.position.set(0, 1.67, 0)
  shoulders.rotation.z = Math.PI / 2 + shoulderTilt
  shoulders.rotation.x = lean * 0.45
  shoulders.scale.z = 0.72

  const pelvis = mesh(new THREE.IcosahedronGeometry(0.28, 1), darkCloth, ATLAS_TILES.bottomLeft)
  pelvis.position.set(0, 0.93, 0.015)
  pelvis.scale.set(1, 0.58, 0.72)
  pelvis.rotation.x = lean * 0.25

  const neck = mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 0.28, 7),
    skin,
    ATLAS_TILES.topLeft,
  )
  neck.position.set(0.02, 1.83, 0.09)
  neck.rotation.x = 0.28

  const shirtShell = mesh(
    new THREE.CylinderGeometry(0.29, 0.4, 0.78, 7, 1, true),
    accent,
    ATLAS_TILES.topRight,
  )
  shirtShell.position.set(0, 1.34, 0.025)
  shirtShell.scale.z = 0.77
  shirtShell.rotation.x = lean
  shirtShell.rotation.z = shoulderTilt * 0.35
  shirtShell.visible = variant !== 2

  const leftHand = mesh(new THREE.IcosahedronGeometry(0.105, 0), skin, ATLAS_TILES.topLeft)
  leftHand.position.set(-0.49, 0.84, 0.31)
  leftHand.scale.set(0.72, 1.08, 0.58)

  const rightHand = mesh(new THREE.IcosahedronGeometry(0.105, 0), skin, ATLAS_TILES.topLeft)
  rightHand.position.set(0.5, 0.82, 0.33)
  rightHand.scale.set(0.72, 1.08, 0.58)

  const leftFoot = capsule(0.095, 0.23, darkCloth, 5, ATLAS_TILES.bottomLeft)
  leftFoot.position.set(-0.16, 0.095, -0.13)
  leftFoot.rotation.x = Math.PI / 2

  const rightFoot = capsule(0.095, 0.23, darkCloth, 5, ATLAS_TILES.bottomLeft)
  rightFoot.position.set(0.16, 0.095, -0.13)
  rightFoot.rotation.x = Math.PI / 2

  const chestWound = mesh(
    new THREE.IcosahedronGeometry(0.105, 0),
    wound,
    ATLAS_TILES.bottomRight,
  )
  chestWound.position.set(variant === 0 ? -0.15 : 0.16, 1.42, 0.29)
  chestWound.scale.set(1, 1.55, 0.28)

  const headWound = mesh(
    new THREE.IcosahedronGeometry(0.085, 0),
    wound,
    ATLAS_TILES.bottomRight,
  )
  headWound.position.set(-0.13, 2.16, 0.31)
  headWound.scale.set(1.35, 0.75, 0.25)
  headWound.visible = variant !== 1

  const leftEye = mesh(new THREE.SphereGeometry(0.024, 5, 3), eyeMaterial)
  leftEye.position.set(-0.06, 2.12, 0.355)
  const rightEye = mesh(new THREE.SphereGeometry(0.024, 5, 3), eyeMaterial)
  rightEye.position.set(0.095, 2.12, 0.355)
  if (Math.random() < 0.62) rightEye.visible = false
  if (Math.random() < 0.18) leftEye.visible = false

  const tornSleeve = mesh(
    new THREE.CylinderGeometry(0.13, 0.115, 0.3, 6, 1, true),
    cloth,
    ATLAS_TILES.topRight,
  )
  tornSleeve.position.set(variant === 1 ? -0.42 : 0.42, 1.55, 0.07)
  tornSleeve.rotation.z = variant === 1 ? -0.15 : 0.15
  tornSleeve.rotation.x = -0.2

  group.add(
    body,
    head,
    jaw,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shoulders,
    pelvis,
    neck,
    shirtShell,
    leftHand,
    rightHand,
    leftFoot,
    rightFoot,
    chestWound,
    headWound,
    leftEye,
    rightEye,
    tornSleeve,
  )

  parts.push(
    body,
    head,
    jaw,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shoulders,
    pelvis,
    neck,
    shirtShell,
    leftHand,
    rightHand,
    leftFoot,
    rightFoot,
    chestWound,
    headWound,
    leftEye,
    rightEye,
    tornSleeve,
  )

  headshotParts.add(head)
  headshotParts.add(jaw)
  headshotParts.add(headWound)
  headshotParts.add(leftEye)
  headshotParts.add(rightEye)

  group.scale.y = 0.98 + Math.random() * 0.09
  return { group, parts, head, headshotParts }
}
