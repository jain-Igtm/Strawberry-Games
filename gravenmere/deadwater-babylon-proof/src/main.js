import * as B from '@babylonjs/core'

const canvas = document.querySelector('#renderCanvas')
const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: false, antialias: true })
engine.setHardwareScalingLevel(1.15)
const scene = new B.Scene(engine)
scene.clearColor = new B.Color4(.18, .17, .16, 1)
scene.fogMode = B.Scene.FOGMODE_EXP2
scene.fogDensity = .0055
scene.fogColor = new B.Color3(.34, .32, .30)
scene.ambientColor = new B.Color3(.32, .29, .26)
scene.imageProcessingConfiguration.toneMappingEnabled = true
scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES
scene.imageProcessingConfiguration.exposure = 1.2
scene.imageProcessingConfiguration.contrast = 1.08

const camera = new B.UniversalCamera('camera', new B.Vector3(118, 3.1, 62), scene)
camera.minZ = .08
camera.maxZ = 1000
camera.fov = .94
camera.speed = .7
camera.keysUp = [87]
camera.keysDown = [83]
camera.keysLeft = [65]
camera.keysRight = [68]
camera.setTarget(new B.Vector3(174, 5.7, 101))
camera.attachControl(canvas, true)

const hemi = new B.HemisphericLight('hemi', new B.Vector3(.15, 1, -.2), scene)
hemi.intensity = 1.28
hemi.diffuse = new B.Color3(.9, .84, .75)
hemi.groundColor = new B.Color3(.15, .12, .10)
const sun = new B.DirectionalLight('sun', new B.Vector3(-.42, -.78, .34), scene)
sun.position = new B.Vector3(90, 120, -80)
sun.intensity = 1.05
const shadows = new B.ShadowGenerator(1024, sun)
shadows.useBlurExponentialShadowMap = true
shadows.blurKernel = 8

function rng(seed) {
  let n = seed >>> 0
  return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296)
}
function texture(name, size, draw) {
  const t = new B.DynamicTexture(name, { width: size, height: size }, scene, false)
  draw(t.getContext(), size)
  t.update(false)
  t.wrapU = t.wrapV = B.Texture.WRAP_ADDRESSMODE
  return t
}
function noisy(name, base, fleck, seed = 1, scale = 4) {
  const t = texture(name, 512, (c, s) => {
    const r = rng(seed)
    c.fillStyle = base
    c.fillRect(0, 0, s, s)
    for (let i = 0; i < 4200; i++) {
      c.fillStyle = fleck.replace('A', (.02 + r() * .12).toFixed(3))
      c.fillRect(r() * s, r() * s, 1 + r() * 5, 1 + r() * 4)
    }
  })
  t.uScale = t.vScale = scale
  return t
}
function mat(name, tex, color = B.Color3.White()) {
  const m = new B.StandardMaterial(name, scene)
  m.diffuseTexture = tex
  m.diffuseColor = color
  m.specularColor = new B.Color3(.035, .035, .035)
  return m
}

const asphaltTex = noisy('asphaltTex', '#282725', 'rgba(150,145,138,A)', 11, 15)
const concreteTex = noisy('concreteTex', '#746f68', 'rgba(35,30,27,A)', 22, 3)
const soilTex = noisy('soilTex', '#40372c', 'rgba(145,120,88,A)', 33, 18)
const hospitalTex = texture('hospitalTex', 512, (c, s) => {
  const r = rng(44)
  c.fillStyle = '#c3bbaf'; c.fillRect(0, 0, s, s)
  for (let y = 0; y < s; y += 64) {
    c.fillStyle = y % 128 ? '#b8b1a7' : '#c8c0b4'; c.fillRect(0, y, s, 64)
    c.fillStyle = 'rgba(58,50,44,.25)'; c.fillRect(0, y, s, 2)
  }
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(45,37,31,${r() * .08})`
    c.fillRect(r() * s, r() * s, 1 + r() * 5, 1 + r() * 4)
  }
})
hospitalTex.uScale = 5; hospitalTex.vScale = 2.4
const clothTex = noisy('clothTex', '#171a18', 'rgba(140,105,72,A)', 55, 2)
const materials = {
  asphalt: mat('asphalt', asphaltTex),
  concrete: mat('concrete', concreteTex),
  soil: mat('soil', soilTex),
  hospital: mat('hospital', hospitalTex),
  cloth: mat('cloth', clothTex),
}
const roof = new B.StandardMaterial('roof', scene)
roof.diffuseColor = new B.Color3(.13, .13, .12)
roof.specularColor = new B.Color3(.06, .06, .06)
const glass = new B.StandardMaterial('glass', scene)
glass.diffuseColor = new B.Color3(.07, .10, .11)
glass.emissiveColor = new B.Color3(.12, .075, .045)
glass.specularColor = new B.Color3(.22, .22, .2)
const yellow = new B.StandardMaterial('yellow', scene)
yellow.diffuseColor = new B.Color3(.7, .54, .25)
yellow.emissiveColor = new B.Color3(.07, .05, .015)

function box(name, w, h, d, x, y, z, material, cast = true) {
  const mesh = B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
  mesh.position.set(x, y, z)
  mesh.material = material
  mesh.receiveShadows = true
  if (cast) shadows.addShadowCaster(mesh)
  return mesh
}

function addSky() {
  const t = texture('skyPanorama', 2048, (c, s) => {
    const h = s / 2
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#777773'); g.addColorStop(.52, '#a69f94'); g.addColorStop(1, '#81766a')
    c.fillStyle = g; c.fillRect(0, 0, s, h)
    const r = rng(66)
    for (let i = 0; i < 70; i++) {
      c.fillStyle = `rgba(50,50,49,${.02 + r() * .05})`
      c.beginPath(); c.ellipse(r() * s, 80 + r() * 520, 70 + r() * 250, 16 + r() * 50, 0, 0, Math.PI * 2); c.fill()
    }
    const hills = (color, base, amplitude, seed) => {
      const q = rng(seed); c.fillStyle = color; c.beginPath(); c.moveTo(0, base)
      let x = 0
      while (x < s) {
        const width = 115 + q() * 120
        const peak = amplitude * (.35 + q() * .65)
        c.bezierCurveTo(x + width * .22, base - peak * .45, x + width * .55, base - peak, x + width, base + q() * 9)
        x += width
      }
      c.lineTo(s, h); c.lineTo(0, h); c.closePath(); c.fill()
    }
    hills('#5b5043', 810, 135, 77)
    hills('#75614b', 850, 105, 88)
    const px = 1640
    c.fillStyle = '#393b3c'; c.beginPath(); c.moveTo(px - 34, 795)
    c.bezierCurveTo(px - 48, 660, px - 18, 545, px - 58, 460)
    c.bezierCurveTo(px - 90, 395, px - 50, 355, px - 5, 338)
    c.bezierCurveTo(px - 220, 315, px - 245, 225, px - 130, 180)
    c.bezierCurveTo(px - 20, 105, px + 150, 132, px + 225, 220)
    c.bezierCurveTo(px + 280, 290, px + 165, 340, px + 60, 348)
    c.bezierCurveTo(px + 115, 405, px + 72, 458, px + 35, 480)
    c.bezierCurveTo(px + 6, 580, px + 45, 690, px + 34, 795)
    c.closePath(); c.fill()
    c.fillStyle = '#302b27'; c.fillRect(0, h, s, h)
  })
  t.uScale = -1
  const m = new B.StandardMaterial('skyMat', scene)
  m.emissiveTexture = t
  m.disableLighting = true
  m.backFaceCulling = false
  const sky = B.MeshBuilder.CreateSphere('sky', { diameter: 900, segments: 40, sideOrientation: B.Mesh.BACKSIDE }, scene)
  sky.material = m
  sky.infiniteDistance = true
  sky.isPickable = false
}
addSky()

const ground = B.MeshBuilder.CreateGround('ground', { width: 245, height: 205 }, scene)
ground.position.set(104, 0, 99)
ground.material = materials.soil
ground.receiveShadows = true
box('mainStreet', 230, .12, 10.8, 104, .12, 72, materials.asphalt, false)
box('walkSouth', 230, .16, 3.2, 104, .1, 64.9, materials.concrete, false)
box('walkNorth', 230, .16, 3.2, 104, .1, 79.1, materials.concrete, false)
for (let x = -2; x < 218; x += 10) box(`dash${x}`, 4.4, .035, .24, x, .205, 72, yellow, false)

function addHospital() {
  const x = 176, z = 106, w = 76, d = 46, fh = 4.2, floors = 3, h = fh * floors, wall = .65, door = 8
  box('rear', w, h, wall, x, h / 2, z + d / 2, materials.hospital)
  box('west', wall, h, d, x - w / 2, h / 2, z, materials.hospital)
  box('east', wall, h, d, x + w / 2, h / 2, z, materials.hospital)
  const side = (w - door) / 2
  box('frontL', side, h, wall, x - door / 2 - side / 2, h / 2, z - d / 2, materials.hospital)
  box('frontR', side, h, wall, x + door / 2 + side / 2, h / 2, z - d / 2, materials.hospital)
  box('header', door, h - 3.6, wall, x, 3.6 + (h - 3.6) / 2, z - d / 2, materials.hospital)
  box('hospitalRoof', w + 1.2, .65, d + 1.2, x, h + .2, z, roof)
  for (let floor = 0; floor < floors; floor++) {
    const y = 2.15 + floor * fh
    for (let wx = x - w / 2 + 4; wx <= x + w / 2 - 3; wx += 5.7) {
      if (floor === 0 && Math.abs(wx - x) < 6) continue
      box(`window${floor}-${wx}`, 3, 1.7, .12, wx, y, z - d / 2 - .38, glass, false)
    }
  }
  box('canopy', 15, .5, 6.5, x, 4, z - d / 2 - 3.2, roof)
  for (const px of [x - 6.5, x + 6.5]) box(`post${px}`, .45, 4, .45, px, 2, z - d / 2 - 5.8, roof)
  const st = texture('sign', 1024, (c, s) => {
    c.fillStyle = '#252321'; c.fillRect(0, 0, s, 260)
    c.strokeStyle = '#8c342d'; c.lineWidth = 14; c.strokeRect(8, 8, s - 16, 244)
    c.fillStyle = '#ddd4c7'; c.font = '900 76px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('ST. AGNES HOSPITAL', s / 2, 130)
  })
  st.vScale = 4
  const sm = new B.StandardMaterial('signMat', scene); sm.diffuseTexture = sm.emissiveTexture = st; sm.specularColor = B.Color3.Black()
  const sign = B.MeshBuilder.CreatePlane('hospitalSign', { width: 28, height: 3.2 }, scene)
  sign.position.set(x, 7.4, z - d / 2 - .42); sign.rotation.y = Math.PI; sign.material = sm
  box('insideFloor', w - 1.5, .18, d - 1.5, x, .12, z, materials.concrete, false)
  for (const rx of [151, 163, 189, 201]) box(`roomWall${rx}`, .4, 3.6, 15.5, rx, 1.8, 114, materials.hospital)
  box('crossNorth', 46, 3.6, .4, 176, 1.8, 116, materials.hospital)
  box('crossSouth', 46, 3.6, .4, 176, 1.8, 96, materials.hospital)
}
addHospital()

function addWaterTower() {
  const metal = new B.StandardMaterial('metal', scene); metal.diffuseColor = new B.Color3(.33, .31, .28)
  for (const dx of [-4.2, 4.2]) for (const dz of [-4.2, 4.2]) {
    const leg = B.MeshBuilder.CreateCylinder(`leg${dx}${dz}`, { height: 19, diameter: .55, tessellation: 8 }, scene)
    leg.position.set(66 + dx, 9.5, 108 + dz); leg.material = metal; shadows.addShadowCaster(leg)
  }
  const tank = B.MeshBuilder.CreateCylinder('tank', { height: 6.2, diameter: 12, tessellation: 20 }, scene)
  tank.position.set(66, 21, 108); tank.material = metal; shadows.addShadowCaster(tank)
  const cap = B.MeshBuilder.CreateSphere('cap', { diameter: 12.2, segments: 18, slice: .5 }, scene)
  cap.position.set(66, 24.1, 108); cap.material = metal; shadows.addShadowCaster(cap)
}
addWaterTower()

const treeTex = texture('treeTex', 512, (c, s) => {
  c.clearRect(0, 0, s, s); c.fillStyle = '#17130f'; c.fillRect(235, 245, 42, 260)
  const colors = ['#111b14', '#18231a', '#202b21', '#293228']
  for (let tier = 0; tier < 7; tier++) {
    const y = 30 + tier * 52, width = 105 + tier * 35
    c.fillStyle = colors[tier % 4]; c.beginPath(); c.moveTo(256, y); c.lineTo(256 - width, y + 120); c.lineTo(256 + width, y + 120); c.closePath(); c.fill()
  }
})
treeTex.hasAlpha = true
const treeMat = new B.StandardMaterial('treeMat', scene)
treeMat.diffuseTexture = treeMat.opacityTexture = treeTex
treeMat.useAlphaFromDiffuseTexture = true; treeMat.backFaceCulling = false; treeMat.specularColor = B.Color3.Black()
const fr = rng(99)
for (let i = 0; i < 90; i++) {
  const scale = .75 + fr() * 1.35
  const tree = B.MeshBuilder.CreatePlane(`tree${i}`, { width: 9 * scale, height: 18 * scale }, scene)
  tree.position.set(108 + fr() * 110, 8.7 * scale, 5 + fr() * 62)
  tree.billboardMode = B.Mesh.BILLBOARDMODE_Y; tree.material = treeMat
}
const glow = new B.StandardMaterial('glow', scene); glow.emissiveColor = new B.Color3(1, .15, .02); glow.alpha = .42
for (const [x, z] of [[139, 31], [170, 24], [194, 43], [157, 52]]) {
  const f = B.MeshBuilder.CreatePlane(`fire${x}`, { width: 7, height: 4.5 }, scene)
  f.position.set(x, 2.4, z); f.billboardMode = B.Mesh.BILLBOARDMODE_ALL; f.material = glow
}

function zombie(x, z, yaw, scale = 1) {
  const root = new B.TransformNode(`zombie${x}`, scene); root.position.set(x, 0, z); root.rotation.y = yaw; root.scaling.setAll(scale)
  const robe = B.MeshBuilder.CreateCylinder(`robe${x}`, { height: 1.5, diameterTop: .7, diameterBottom: 1.05, tessellation: 8 }, scene)
  robe.position.y = .78; robe.material = materials.cloth; robe.parent = root
  box(`torso${x}`, .76, 1, .42, 0, 1.68, 0, materials.cloth).parent = root
  const hood = B.MeshBuilder.CreateSphere(`hood${x}`, { diameter: .74, segments: 10 }, scene)
  hood.position.y = 2.35; hood.scaling.z = .86; hood.material = materials.cloth; hood.parent = root
  const face = new B.StandardMaterial(`face${x}`, scene); face.diffuseColor = new B.Color3(.06, .05, .045)
  const voidFace = B.MeshBuilder.CreateDisc(`void${x}`, { radius: .25, tessellation: 16 }, scene)
  voidFace.position.set(0, 2.32, -.34); voidFace.rotation.x = Math.PI / 2; voidFace.material = face; voidFace.parent = root
  for (const side of [-1, 1]) {
    const arm = B.MeshBuilder.CreateCylinder(`arm${x}${side}`, { height: 1.38, diameter: .24, tessellation: 7 }, scene)
    arm.position.set(side * .78, 1.78, -.25); arm.rotation.z = Math.PI / 2 + side * .08; arm.rotation.x = .32; arm.material = materials.cloth; arm.parent = root
  }
  root.getChildMeshes().forEach(m => shadows.addShadowCaster(m))
}
zombie(143, 73, -Math.PI / 2, 1.04); zombie(151, 76, -Math.PI / 2 + .2, .94); zombie(132, 69, -Math.PI / 2 - .15, .9)

function setView(name) {
  if (name === 'interior') { camera.position.set(176, 1.78, 86.5); camera.setTarget(new B.Vector3(176, 1.7, 113)); scene.fogDensity = .003 }
  else if (name === 'forest') { camera.position.set(178, 2.4, 79); camera.setTarget(new B.Vector3(164, 4.5, 43)); scene.fogDensity = .006 }
  else { camera.position.set(118, 3.1, 62); camera.setTarget(new B.Vector3(174, 5.7, 101)); scene.fogDensity = .0055 }
}
window.setAshfallView = setView
window.__ASHFALL_READY__ = false
scene.executeWhenReady(() => {
  window.__ASHFALL_READY__ = true
  window.__ASHFALL_STATS__ = { meshes: scene.meshes.length, textures: scene.getActiveTextures().length, engine: B.Engine.Version }
})
engine.runRenderLoop(() => scene.render())
window.addEventListener('resize', () => engine.resize())
