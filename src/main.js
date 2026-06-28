import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { loadModel, cloneModel } from "./assets/loader.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91b8d9);
scene.fog = new THREE.FogExp2(0x91b8d9, 0.008);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 820);
camera.position.set(0, 4, 10);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcfe7ff, 0x33442e, 1.45));
const sun = new THREE.DirectionalLight(0xffe0a3, 2.35);
sun.position.set(-95, 135, 75);
scene.add(sun);
scene.add(sun.target);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(500, 16, 8),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x7fb2df) }, bottom: { value: new THREE.Color(0xdce9ef) } },
    vertexShader: `varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 v;uniform vec3 top;uniform vec3 bottom;void main(){float h=smoothstep(-.18,.82,v.y);gl_FragColor=vec4(mix(bottom,top,h),1.0);}`
  })
);
scene.add(sky);

let pineModel = null;
loadModel("assets/models/trees/pine_tall.gltf").then(model => {
  pineModel = model;
  if (pineModel) pineModel.traverse(obj => { obj.frustumCulled = true; });
});

const chunkSize = 76;
const chunkRadius = 2;
const seg = 12;
const chunks = new Map();
const queue = [];
const temp = new THREE.Object3D();

const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 });
const pathMat = new THREE.MeshStandardMaterial({ color: 0x77644b, roughness: 1 });
const waterMat = new THREE.MeshStandardMaterial({ color: 0x477f94, roughness: 0.45, transparent: true, opacity: 0.62 });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.95 });
const rockMat = new THREE.MeshStandardMaterial({ color: 0x787b76, roughness: 1 });
const grassMat = new THREE.MeshStandardMaterial({ color: 0x2f5f27, roughness: 1 });
const fallbackNeedle = new THREE.MeshStandardMaterial({ color: 0x183b25, roughness: 0.98 });

const trunkGeo = new THREE.CylinderGeometry(0.32, 0.68, 9.2, 7);
const pineLowGeo = new THREE.ConeGeometry(3.35, 7.4, 9);
const pineMidGeo = new THREE.ConeGeometry(2.5, 6.2, 9);
const pineTopGeo = new THREE.ConeGeometry(1.5, 4.1, 8);
const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
const grassGeo = new THREE.ConeGeometry(0.045, 0.62, 5);
const cloudGeo = new THREE.SphereGeometry(1, 10, 7);

function hash2(x, z) {
  let n = (Math.floor(x) * 374761393 + Math.floor(z) * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function rnd(x, z, s, a, b) { return a + hash2(x + s * 1013, z - s * 917) * (b - a); }
function sm(t) { return t * t * (3 - 2 * t); }
function nse(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  const u = sm(xf), v = sm(zf);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v);
}
function pathZ(x) { return Math.sin(x * 0.018) * 18 + Math.sin(x * 0.006 + 1.3) * 32; }
function pathBlend(x, z) { return THREE.MathUtils.clamp(1 - Math.abs(z - pathZ(x)) / 10, 0, 1); }
function waterBlend(x, z) {
  const v = nse(x * 0.012 + 220, z * 0.012 - 70);
  return v > 0.82 ? THREE.MathUtils.clamp((v - 0.82) / 0.08, 0, 1) : 0;
}
function baseHeight(x, z) {
  return (nse(x * 0.012, z * 0.012) - 0.5) * 18 + (nse(x * 0.04 + 81, z * 0.04 - 23) - 0.5) * 5.5 + (nse(x * 0.11, z * 0.11) - 0.5) * 1.5;
}
function heightAt(x, z) {
  let y = baseHeight(x, z);
  y = THREE.MathUtils.lerp(y, 0.35, pathBlend(x, z));
  if (waterBlend(x, z) > 0.28) y = Math.min(y, -1.2);
  return y;
}
function colorAt(x, z, y) {
  let c = new THREE.Color(0x496f34);
  if (y > 4) c.set(0x526b40);
  if (y < -0.7) c.set(0x425c34);
  c.lerp(new THREE.Color(0x5d7741), nse(x * 0.18, z * 0.18) * 0.22);
  c.lerp(new THREE.Color(0x7b6447), pathBlend(x, z) * 0.95);
  return c;
}

function makeTerrain(cx, cz) {
  const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < p.count; i++) {
    const wx = cx * chunkSize + chunkSize / 2 + p.getX(i);
    const wz = cz * chunkSize + chunkSize / 2 + p.getZ(i);
    const y = heightAt(wx, wz);
    p.setY(i, y);
    const c = colorAt(wx, wz, y);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, terrainMat);
  mesh.position.set(cx * chunkSize + chunkSize / 2, 0, cz * chunkSize + chunkSize / 2);
  return mesh;
}
function makePath(cx, cz) {
  const geo = new THREE.PlaneGeometry(chunkSize, 7.4, 14, 1);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const wx = cx * chunkSize + chunkSize / 2 + p.getX(i);
    const lat = p.getZ(i);
    const wz = pathZ(wx) + lat;
    p.setZ(i, wz - (cz * chunkSize + chunkSize / 2));
    p.setY(i, heightAt(wx, wz) + 0.045);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, pathMat);
  mesh.position.set(cx * chunkSize + chunkSize / 2, 0, cz * chunkSize + chunkSize / 2);
  return mesh;
}
function makeWater(cx, cz) {
  const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, waterMat);
  mesh.position.set(cx * chunkSize + chunkSize / 2, -1.05, cz * chunkSize + chunkSize / 2);
  return mesh;
}
function place(mesh, i, x, y, z, scale, ry = 0, sx = 1, sy = 1, sz = 1) {
  temp.position.set(x, y, z);
  temp.rotation.set(0, ry, 0);
  temp.scale.set(scale * sx, scale * sy, scale * sz);
  temp.updateMatrix();
  mesh.setMatrixAt(i, temp.matrix);
}
function tooClose(x, z, spots, d) {
  for (const p of spots) {
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz < d * d) return true;
  }
  return false;
}
function fallbackPine(x, z, sx, sz) {
  const g = new THREE.Group();
  const y = heightAt(x, z);
  const s = rnd(sx, sz, 1, 0.95, 1.55);
  const r = rnd(sx, sz, 3, 0, Math.PI * 2);
  g.position.set(x, y, z);
  g.rotation.y = r;
  g.scale.setScalar(s);
  const t = new THREE.Mesh(trunkGeo, trunkMat); t.position.y = 4.6; g.add(t);
  const a = new THREE.Mesh(pineLowGeo, fallbackNeedle); a.position.y = 7.8; g.add(a);
  const b = new THREE.Mesh(pineMidGeo, fallbackNeedle); b.position.y = 10.5; g.add(b);
  const c = new THREE.Mesh(pineTopGeo, fallbackNeedle); c.position.y = 12.95; g.add(c);
  return g;
}
function addTree(group, x, z, sx, sz) {
  if (pineModel) {
    const model = cloneModel(pineModel);
    model.position.set(x, heightAt(x, z), z);
    model.rotation.y = rnd(sx, sz, 3, 0, Math.PI * 2);
    model.scale.setScalar(rnd(sx, sz, 1, 0.95, 1.55));
    group.add(model);
  } else {
    group.add(fallbackPine(x, z, sx, sz));
  }
}

function makeChunk(cx, cz) {
  const key = cx + "," + cz;
  if (chunks.has(key)) return;
  const group = new THREE.Group();
  group.add(makeTerrain(cx, cz));
  group.add(makePath(cx, cz));

  let hasWater = false;
  for (let i = 0; i < 3; i++) {
    const x = cx * chunkSize + rnd(cx * 41, cz * 41, i, 0, chunkSize);
    const z = cz * chunkSize + rnd(cx * 43, cz * 43, i, 0, chunkSize);
    if (waterBlend(x, z) > 0.2) hasWater = true;
  }
  if (hasWater) group.add(makeWater(cx, cz));

  const spots = [];
  let tries = 0;
  while (spots.length < 18 && tries < 160) {
    tries++;
    const sx = cx * 1000 + tries * 37;
    const sz = cz * 1000 - tries * 53;
    const x = cx * chunkSize + rnd(sx, sz, 1, 5, chunkSize - 5);
    const z = cz * chunkSize + rnd(sx, sz, 2, 5, chunkSize - 5);
    if (pathBlend(x, z) > 0.2 || waterBlend(x, z) > 0.15 || tooClose(x, z, spots, 14)) continue;
    spots.push({ x, z, sx, sz });
  }
  spots.forEach(p => addTree(group, p.x, p.z, p.sx, p.sz));

  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 5);
  for (let i = 0; i < 5; i++) {
    const sx = cx * 700 + i * 97, sz = cz * 700 - i * 29;
    const x = cx * chunkSize + rnd(sx, sz, 7, 3, chunkSize - 3);
    const z = cz * chunkSize + rnd(sx, sz, 8, 3, chunkSize - 3);
    place(rocks, i, x, heightAt(x, z) + 0.35, z, rnd(sx, sz, 12, 0.7, 1.8), rnd(sx, sz, 10, 0, Math.PI * 2), 1, rnd(sx, sz, 13, 0.3, 0.8), 1);
  }
  rocks.instanceMatrix.needsUpdate = true;
  group.add(rocks);

  const grass = new THREE.InstancedMesh(grassGeo, grassMat, 14);
  for (let i = 0; i < 14; i++) {
    const sx = cx * 501 + i * 19, sz = cz * 501 - i * 23;
    const x = cx * chunkSize + rnd(sx, sz, 1, 1, chunkSize - 1);
    const z = cz * chunkSize + rnd(sx, sz, 2, 1, chunkSize - 1);
    place(grass, i, x, heightAt(x, z) + 0.28, z, rnd(sx, sz, 3, 0.8, 1.3), rnd(sx, sz, 4, 0, Math.PI * 2));
  }
  grass.instanceMatrix.needsUpdate = true;
  group.add(grass);

  scene.add(group);
  chunks.set(key, group);
}
function enqueueChunks() {
  const pcx = Math.floor(camera.position.x / chunkSize), pcz = Math.floor(camera.position.z / chunkSize);
  for (let x = pcx - chunkRadius; x <= pcx + chunkRadius; x++) for (let z = pcz - chunkRadius; z <= pcz + chunkRadius; z++) {
    const k = x + "," + z;
    if (!chunks.has(k) && !queue.some(q => q[0] === x && q[1] === z)) queue.push([x, z]);
  }
  queue.sort((a, b) => (a[0] - pcx) ** 2 + (a[1] - pcz) ** 2 - ((b[0] - pcx) ** 2 + (b[1] - pcz) ** 2));
  for (const [key, g] of chunks) {
    const [cx, cz] = key.split(",").map(Number);
    if (Math.abs(cx - pcx) > chunkRadius + 1 || Math.abs(cz - pcz) > chunkRadius + 1) { scene.remove(g); chunks.delete(key); }
  }
}
function processQueue() { if (queue.length) { const q = queue.shift(); makeChunk(q[0], q[1]); } }

function makeMountains() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x69746f, roughness: 1 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xdde3de, roughness: 0.85 });
  const g = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, d = 320 + rnd(i, 9, 1, -20, 70), x = Math.sin(a) * d, z = Math.cos(a) * d;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(rnd(i, 2, 3, 24, 62), rnd(i, 3, 4, 45, 115), 5), mat);
    peak.position.set(x, rnd(i, 4, 5, -8, 8), z);
    peak.rotation.y = rnd(i, 6, 7, 0, Math.PI * 2);
    peak.scale.z = rnd(i, 8, 9, 0.65, 1.5);
    g.add(peak);
    if (i % 2 === 0) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(rnd(i, 12, 13, 7, 18), rnd(i, 14, 15, 8, 20), 5), snow);
      cap.position.set(x, peak.position.y + rnd(i, 16, 17, 22, 52), z);
      cap.rotation.y = peak.rotation.y;
      cap.scale.z = peak.scale.z;
      g.add(cap);
    }
  }
  scene.add(g);
}
function makeClouds() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.48, depthWrite: false });
  const g = new THREE.Group();
  for (let c = 0; c < 8; c++) {
    const cg = new THREE.Group();
    cg.position.set(rnd(c, 1, 2, -220, 220), rnd(c, 5, 6, 80, 130), rnd(c, 3, 4, -220, 220));
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(cloudGeo, mat);
      p.position.set(rnd(c * 7, i, 1, -8, 8), rnd(c * 7, i, 2, -2, 2), rnd(c * 7, i, 3, -3, 3));
      p.scale.set(rnd(c * 9, i, 4, 7, 17), rnd(c * 9, i, 5, 2, 5), rnd(c * 9, i, 6, 4, 10));
      cg.add(p);
    }
    g.add(cg);
  }
  scene.add(g);
}
makeMountains();
makeClouds();

const joystick = document.getElementById("joystick"), stick = document.getElementById("stick"), look = document.getElementById("look"), coords = document.getElementById("coords"), hint = document.getElementById("hint"), startOverlay = document.getElementById("startOverlay"), startBtn = document.getElementById("startBtn");
const move = { x: 0, y: 0 };
let joyActive = false, joyTouchId = null, lookActive = false, lookTouchId = null, lx = 0, ly = 0, yaw = 0, pitch = -0.1, last = performance.now(), started = false, lastChunkCheck = 0;
const keys = new Set();

joystick.addEventListener("touchstart", e => { joyActive = true; joyTouchId = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
joystick.addEventListener("touchmove", e => {
  if (!joyActive) return;
  let t = null;
  for (let i = 0; i < e.touches.length; i++) if (e.touches[i].identifier === joyTouchId) { t = e.touches[i]; break; }
  if (!t) return;
  const r = joystick.getBoundingClientRect();
  let x = t.clientX - r.left - 65, y = t.clientY - r.top - 65, d = Math.hypot(x, y);
  if (d > 45) { x *= 45 / d; y *= 45 / d; }
  stick.style.left = 45 + x + "px";
  stick.style.top = 45 + y + "px";
  move.x = x / 45;
  move.y = y / 45;
  e.preventDefault();
}, { passive: false });
function resetJoy() { joyActive = false; joyTouchId = null; move.x = 0; move.y = 0; stick.style.left = "45px"; stick.style.top = "45px"; }
joystick.addEventListener("touchend", e => { for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === joyTouchId) resetJoy(); });
joystick.addEventListener("touchcancel", resetJoy);
look.addEventListener("touchstart", e => { if (e.target === joystick || joystick.contains(e.target)) return; lookActive = true; lookTouchId = e.changedTouches[0].identifier; lx = e.changedTouches[0].clientX; ly = e.changedTouches[0].clientY; });
look.addEventListener("touchmove", e => {
  if (!lookActive) return;
  let t = null;
  for (let i = 0; i < e.touches.length; i++) if (e.touches[i].identifier === lookTouchId) { t = e.touches[i]; break; }
  if (!t) return;
  const nx = t.clientX, ny = t.clientY;
  yaw += (nx - lx) * 0.005;
  pitch += (ny - ly) * 0.005;
  pitch = Math.max(-1.25, Math.min(1.05, pitch));
  lx = nx;
  ly = ny;
});
function resetLook() { lookActive = false; lookTouchId = null; }
look.addEventListener("touchend", resetLook);
look.addEventListener("touchcancel", resetLook);
window.addEventListener("keydown", e => keys.add(e.code));
window.addEventListener("keyup", e => keys.delete(e.code));
startBtn.addEventListener("click", () => { started = true; startOverlay.style.display = "none"; setTimeout(() => hint.style.opacity = "0", 4500); });
function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 120));

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (started) {
    let f = -move.y, s = move.x;
    if (keys.has("KeyW") || keys.has("ArrowUp")) f += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) f -= 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) s -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) s += 1;
    f = THREE.MathUtils.clamp(f, -1, 1);
    s = THREE.MathUtils.clamp(s, -1, 1);
    const speed = 14.5, sn = Math.sin(yaw), cs = Math.cos(yaw);
    camera.position.x += (-sn * f + cs * s) * speed * dt;
    camera.position.z += (-cs * f - sn * s) * speed * dt;
    const gy = heightAt(camera.position.x, camera.position.z);
    camera.position.y = gy + 3.15 + Math.sin(now * 0.007) * 0.035 * Math.abs(f);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }
  if (now - lastChunkCheck > 260) { enqueueChunks(); lastChunkCheck = now; }
  processQueue();
  sun.target.position.copy(camera.position);
  sun.target.updateMatrixWorld();
  coords.innerHTML = `x: ${camera.position.x.toFixed(1)}<br>z: ${camera.position.z.toFixed(1)}`;
  renderer.render(scene, camera);
}
enqueueChunks();
for (let i = 0; i < 6; i++) processQueue();
requestAnimationFrame(animate);
