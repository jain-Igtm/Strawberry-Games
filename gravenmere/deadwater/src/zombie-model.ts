import * as THREE from 'three'

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

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material)
  result.castShadow = false
  result.receiveShadow = false
  return result
}

export function createRoundedZombieVisual(base: ZombieModelMaterials): ZombieVisual {
  const group = new THREE.Group()
  group.userData.flashActive = false

  const skin = base.skin.clone()
  skin.color.offsetHSL((Math.random() - 0.5) * 0.045, -0.08, (Math.random() - 0.5) * 0.09)
  const cloth = (Math.random() > 0.46 ? base.cloth : base.clothAlt).clone()
  cloth.color.offsetHSL((Math.random() - 0.5) * 0.035, -0.05, (Math.random() - 0.5) * 0.055)
  const darkCloth = cloth.clone()
  darkCloth.color.multiplyScalar(0.62)
  const wound = base.rust.clone()
  wound.color.setHex(0x4f120f)
  wound.roughness = 0.86
  const accent = base.warning.clone()
  accent.color.offsetHSL((Math.random() - 0.5) * 0.05, -0.25, -0.2)
  const eyeMaterial = base.ember.clone()
  eyeMaterial.opacity = 0.82

  const parts: THREE.Mesh[] = []
  const headshotParts = new Set<THREE.Mesh>()

  const body = mesh(new THREE.CapsuleGeometry(0.34, 0.42, 4, 8), cloth)
  body.position.set(0, 1.19, 0)
  body.scale.set(1.03, 1, 0.72)
  body.rotation.x = 0.09

  const head = mesh(new THREE.SphereGeometry(0.3, 10, 8), skin)
  head.position.set(0.035, 1.94, 0.08)
  head.scale.set(0.92, 1.08, 0.95)
  head.rotation.z = (Math.random() - 0.5) * 0.22

  const jaw = mesh(new THREE.SphereGeometry(0.19, 8, 6), skin)
  jaw.position.set(0.045, 1.72, 0.145)
  jaw.scale.set(1.05, 0.58, 0.78)
  jaw.rotation.z = 0.07 + (Math.random() - 0.5) * 0.08

  const leftArm = mesh(new THREE.CapsuleGeometry(0.115, 0.63, 3, 7), skin)
  leftArm.position.set(-0.48, 1.18, 0.04)
  leftArm.rotation.x = -0.78
  leftArm.rotation.z = -0.13

  const rightArm = mesh(new THREE.CapsuleGeometry(0.115, 0.63, 3, 7), skin)
  rightArm.position.set(0.48, 1.18, 0.04)
  rightArm.rotation.x = -0.84
  rightArm.rotation.z = 0.11

  const leftLeg = mesh(new THREE.CapsuleGeometry(0.135, 0.62, 3, 7), darkCloth)
  leftLeg.position.set(-0.19, 0.47, 0.01)
  leftLeg.rotation.z = -0.035

  const rightLeg = mesh(new THREE.CapsuleGeometry(0.135, 0.62, 3, 7), darkCloth)
  rightLeg.position.set(0.19, 0.47, 0.01)
  rightLeg.rotation.z = 0.04

  const shoulders = mesh(new THREE.CapsuleGeometry(0.13, 0.56, 3, 8), cloth)
  shoulders.position.set(0, 1.49, -0.005)
  shoulders.rotation.z = Math.PI / 2
  shoulders.scale.z = 0.72

  const pelvis = mesh(new THREE.SphereGeometry(0.34, 8, 6), darkCloth)
  pelvis.position.set(0, 0.78, 0.02)
  pelvis.scale.set(1, 0.62, 0.72)

  const neck = mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.28, 8), skin)
  neck.position.set(0.02, 1.65, 0.03)
  neck.rotation.x = 0.16

  const shirtShell = mesh(
    new THREE.CylinderGeometry(0.35, 0.42, 0.75, 8, 1, true),
    accent,
  )
  shirtShell.position.set(0, 1.18, 0)
  shirtShell.scale.z = 0.74
  shirtShell.rotation.x = 0.09

  const leftFoot = mesh(new THREE.CapsuleGeometry(0.12, 0.22, 3, 7), darkCloth)
  leftFoot.position.set(-0.19, 0.095, -0.13)
  leftFoot.rotation.x = Math.PI / 2

  const rightFoot = mesh(new THREE.CapsuleGeometry(0.12, 0.22, 3, 7), darkCloth)
  rightFoot.position.set(0.19, 0.095, -0.13)
  rightFoot.rotation.x = Math.PI / 2

  const chestWound = mesh(new THREE.SphereGeometry(0.13, 7, 5), wound)
  chestWound.position.set(-0.16, 1.23, 0.275)
  chestWound.scale.set(1, 1.35, 0.32)

  const headWound = mesh(new THREE.SphereGeometry(0.11, 7, 5), wound)
  headWound.position.set(-0.16, 2.04, 0.275)
  headWound.scale.set(1.25, 0.8, 0.28)

  const leftEye = mesh(new THREE.SphereGeometry(0.035, 6, 4), eyeMaterial)
  leftEye.position.set(-0.072, 2.0, 0.35)
  const rightEye = mesh(new THREE.SphereGeometry(0.035, 6, 4), eyeMaterial)
  rightEye.position.set(0.13, 2.0, 0.35)
  if (Math.random() < 0.42) rightEye.visible = false

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
    leftFoot,
    rightFoot,
    chestWound,
    headWound,
    leftEye,
    rightEye,
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
    leftFoot,
    rightFoot,
    chestWound,
    headWound,
    leftEye,
    rightEye,
  )
  headshotParts.add(head)
  headshotParts.add(jaw)
  headshotParts.add(headWound)
  headshotParts.add(leftEye)
  headshotParts.add(rightEye)

  group.rotation.x = 0.02 + Math.random() * 0.055
  return { group, parts, head, headshotParts }
}
