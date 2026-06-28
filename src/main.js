import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const BUILD = "1-N 18";
const NEXT_VERSION = "v0.0.1";
const hudTitle = document.getElementById("title");
const hint = document.getElementById("hint");
const coords = document.getElementById("coords");
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");

if (hudTitle) hudTitle.textContent = "STRAWBERRY FOREST — Update " + BUILD;
if (hint) hint.textContent = "Update " + BUILD + " loaded. Terrain texture pass. Next public version: " + NEXT_VERSION + ".";
if (startBtn) startBtn.textContent = "Start";

window.addEventListener("error", event => {
  if (hint) hint.textContent = "Runtime error: " + event.message;
});

let started = false;
if (startBtn) {
  startBtn.onclick = () => {
    started = true;
    startOverlay.style.display = "none";
    if (hint) setTimeout(() => { hint.style.opacity = "0"; }, 4200);
  };
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x86b5dc);
scene.fog = new THREE.FogExp2(0x86b5dc, 0.0068);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 950);
camera.position.set(0, 4, 10);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdcefff, 0x2d432c, 1.5));
const sun = new THREE.DirectionalLight(0xffdda7, 2.55);
sun.position.set(-95, 135, 75);
scene.add(sun);
scene.add(sun.target);

function makeStripeTexture(base, mid, dark) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 7) {
    g.fillStyle = y % 21 === 0 ? dark : mid;
    g.globalAlpha = 0.22 + ((y * 13) % 17) / 100;
    g.fillRect(0, y, 128, 2 + (y % 5));
  }
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    g.globalAlpha = 0.08 + Math.random() * 0.18;
    g.fillStyle = Math.random() > 0.5 ? dark : mid;
    g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipMapNearestFilter;
  return tex;
}

const terrainTexture = makeStripeTexture("#486f35", "#66814a", "#263e28");
const mountainTexture = makeStripeTexture("#66706c", "#8a948f", "#3d4746");

const terrainMat = new THREE.MeshStandardMaterial({ map: terrainTexture, vertexColors: true, roughness: 0.98 });
const mountainMat = new THREE.MeshStandardMaterial({ map: mountainTexture, vertexColors: true, roughness: 1 });
const waterMat = new THREE.MeshStandardMaterial({ color: 0x3f7d93, roughness: 0.5, transparent: true, opacity: 0.62 });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x53331e, roughness: 1 });
const rockMat = new THREE.MeshStandardMaterial({ color: 0x777a73, roughness: 1 });
const leafMats = [0x17351f, 0x1e4528, 0x0f2c1a, 0x264d2e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
const pathMat = new THREE.MeshStandardMaterial({ color: 0x806a4d, roughness: 1 });

const trunkGeo = new THREE.CylinderGeometry(0.28, 0.62, 8.0, 7);
const pineLowGeo = new THREE.ConeGeometry(3.2, 6.4, 9);
const pineMidGeo = new THREE.ConeGeometry(2.35, 5.2, 9);
const pineTopGeo = new THREE.ConeGeometry(1.35, 3.7, 8);
const rockGeo = new THREE.DodecahedronGeometry(1, 0);

const chunkSize = 86;
const chunkRadius = 2;
const seg = 18;
const chunks = new Map();
const temp = new THREE.Object3D();

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
function pathZ(x) { return Math.sin(x * 0.016) * 20 + Math.sin(x * 0.005 + 1.3) * 35; }
function pathBlend(x, z) { return THREE.MathUtils.clamp(1 - Math.abs(z - pathZ(x)) / 10, 0, 1); }
function waterBlend(x, z) {
  const v = nse(x * 0.012 + 220, z * 0.012 - 70);
  return v > 0.825 ? THREE.MathUtils.clamp((v - 0.825) / 0.08, 0, 1) : 0;
}
function ridge(x, z) {
  const r1 = 1 - Math.abs(nse(x * 0.006 + 11, z * 0.006 - 42) * 2 - 1);
  const r2 = 1 - Math.abs(nse(x * 0.014 - 81, z * 0.014 + 9) * 2 - 1);
  return Math.pow(THREE.MathUtils.clamp(r1 * 0.75 + r2 * 0.45, 0, 1), 2.15);
}
function heightAt(x, z) {
  let y = (nse(x * 0.011, z * 0.011) - 0.5) * 15 + (nse(x * 0.04 + 81, z * 0.04 - 23) - 0.5) * 5.5;
  const far = THREE.MathUtils.clamp((Math.hypot(x + 115, z - 250) - 80) / 230, 0, 1);
  y += ridge(x + 60, z - 90) * 38 * far;
  y = THREE.MathUtils.lerp(y, 0.35, pathBlend(x, z));
  if (waterBlend(x, z) > 0.28) y = Math.min(y, -1.2);
  return y;
}
function colorAt(x, z, y) {
  const c = new THREE.Color(0x496f34);
  if (y > 10) c.set(0x68726b);
  else if (y > 5) c.set(0x526b40);
  if (y < -0.7) c.set(0x425c34);
  c.lerp(new THREE.Color(0x607a43), nse(x * 0.18, z * 0.18) * 0.25);
  c.lerp(new THREE.Color(0x80684a), pathBlend(x, z) * 0.95);
  return c;
}
function makeTerrain(cx, cz) {
  const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = [];
  let high = 0;
  for (let i = 0; i < p.count; i++) {
    const wx = cx * chunkSize + chunkSize / 2 + p.getX(i);
    const wz = cz * chunkSize + chunkSize / 2 + p.getZ(i);
    const y = heightAt(wx, wz);
    high += y > 8 ? 1 : 0;
    p.setY(i, y);
    const c = colorAt(wx, wz, y);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, high > p.count * 0.22 ? mountainMat : terrainMat);
  mesh.position.set(cx * chunkSize + chunkSize / 2, 0, cz * chunkSize + chunkSize / 2);
  return mesh;
}
function place(mesh, i, x, y, z, scale, ry = 0, sx = 1, sy = 1, sz = 1) {
  temp.position.set(x, y, z);
  temp.rotation.set(0, ry, 0);
  temp.scale.set(scale * sx, scale * sy, scale * sz);
  temp.updateMatrix();
  mesh.setMatrixAt(i, temp.matrix);
}
function makeChunk(cx, cz) {
  const key = cx + "," + cz;
  if (chunks.has(key)) return;
  const group = new THREE.Group();
  group.add(makeTerrain(cx, cz));

  const pathGeo = new THREE.PlaneGeometry(chunkSize, 7.6, 16, 1);
  pathGeo.rotateX(-Math.PI / 2);
  const pp = pathGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const wx = cx * chunkSize + chunkSize / 2 + pp.getX(i);
    const lat = pp.getZ(i);
    const wz = pathZ(wx) + lat;
    pp.setZ(i, wz - (cz * chunkSize + chunkSize / 2));
    pp.setY(i, heightAt(wx, wz) + 0.045);
  }
  group.add(new THREE.Mesh(pathGeo, pathMat));

  const wb = waterBlend(cx * chunkSize + chunkSize / 2, cz * chunkSize + chunkSize / 2);
  if (wb > 0.01) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(chunkSize, chunkSize), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx * chunkSize + chunkSize / 2, -1.05, cz * chunkSize + chunkSize / 2);
    group.add(water);
  }

  const count = 34;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const lows = new THREE.InstancedMesh(pineLowGeo, leafMats[Math.abs(cx + cz) % leafMats.length], count);
  const mids = new THREE.InstancedMesh(pineMidGeo, leafMats[Math.abs(cx * 2 + cz) % leafMats.length], count);
  const tops = new THREE.InstancedMesh(pineTopGeo, leafMats[Math.abs(cx + cz * 3) % leafMats.length], count);
  let ti = 0;
  for (let i = 0; i < count; i++) {
    const x = cx * chunkSize + rnd(cx, cz, i * 5 + 1, 4, chunkSize - 4);
    const z = cz * chunkSize + rnd(cx, cz, i * 5 + 2, 4, chunkSize - 4);
    const y = heightAt(x, z);
    if (pathBlend(x, z) > 0.25 || waterBlend(x, z) > 0.2 || y > 9 || Math.hypot(x, z) < 14) continue;
    const s = rnd(cx, cz, i * 5 + 3, 0.65, 1.45);
    const r = rnd(cx, cz, i * 5 + 4, 0, Math.PI * 2);
    place(trunks, ti, x, y + 4 * s, z, s, r);
    place(lows, ti, x, y + 8.2 * s, z, s, r);
    place(mids, ti, x, y + 11.0 * s, z, s, r + 0.4);
    place(tops, ti, x, y + 13.0 * s, z, s, r + 0.8);
    ti++;
  }
  trunks.count = lows.count = mids.count = tops.count = ti;
  group.add(trunks, lows, mids, tops);

  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 18);
  for (let i = 0; i < 18; i++) {
    const x = cx * chunkSize + rnd(cx, cz, i * 7 + 21, 3, chunkSize - 3);
    const z = cz * chunkSize + rnd(cx, cz, i * 7 + 22, 3, chunkSize - 3);
    const y = heightAt(x, z);
    const s = rnd(cx, cz, i * 7 + 23, 0.18, 0.75);
    place(rocks, i, x, y + s * 0.35, z, s, rnd(cx, cz, i * 7 + 24, 0, 6.28), 1.4, 0.6, 1.0);
  }
  group.add(rocks);

  scene.add(group);
  chunks.set(key, group);
}
function updateChunks() {
  const cx = Math.floor(player.x / chunkSize);
  const cz = Math.floor(player.z / chunkSize);
  for (let x = cx - chunkRadius; x <= cx + chunkRadius; x++) for (let z = cz - chunkRadius; z <= cz + chunkRadius; z++) makeChunk(x, z);
  for (const [key, group] of chunks) {
    const [x, z] = key.split(",").map(Number);
    if (Math.abs(x - cx) > chunkRadius + 1 || Math.abs(z - cz) > chunkRadius + 1) {
      scene.remove(group);
      group.traverse(o => { if (o.geometry) o.geometry.dispose?.(); });
      chunks.delete(key);
    }
  }
}

const player = { x: 9, z: -3, yaw: 0, pitch: -0.05 };
let joyX = 0, joyY = 0, activeJoy = null, activeLook = null, lx = 0, ly = 0;
function moveStick(t) {
  const r = joystick.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const dx = t.clientX - cx, dy = t.clientY - cy;
  const len = Math.hypot(dx, dy), max = r.width * 0.34;
  const m = Math.min(max, len), nx = len ? dx / len : 0, ny = len ? dy / len : 0;
  joyX = nx * m / max; joyY = ny * m / max;
  stick.style.transform = `translate(${nx * m}px,${ny * m}px)`;
}
function resetStick() { joyX = joyY = 0; activeJoy = null; stick.style.transform = "translate(0,0)"; }
addEventListener("touchstart", e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.44 && activeJoy === null) { activeJoy = t.identifier; moveStick(t); }
    else if (activeLook === null) { activeLook = t.identifier; lx = t.clientX; ly = t.clientY; }
  }
}, { passive: false });
addEventListener("touchmove", e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === activeJoy) moveStick(t);
    if (t.identifier === activeLook) {
      const dx = t.clientX - lx, dy = t.clientY - ly; lx = t.clientX; ly = t.clientY;
      player.yaw += dx * 0.0037;
      player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.003, -1.05, 0.65);
    }
  }
}, { passive: false });
addEventListener("touchend", e => { for (const t of e.changedTouches) { if (t.identifier === activeJoy) resetStick(); if (t.identifier === activeLook) activeLook = null; } });
addEventListener("touchcancel", resetStick);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (started) {
    const speed = 18;
    const f = -joyY, s = joyX;
    const sn = Math.sin(player.yaw), cs = Math.cos(player.yaw);
    player.x += (s * cs + f * sn) * speed * dt;
    player.z += (s * -sn + f * cs) * speed * dt;
  }
  const y = heightAt(player.x, player.z) + 4.5;
  camera.position.set(player.x, y, player.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  sun.position.set(player.x - 95, y + 135, player.z + 75);
  sun.target.position.set(player.x, y, player.z);
  updateChunks();
  if (coords) coords.innerHTML = `x: ${player.x.toFixed(1)}<br>z: ${player.z.toFixed(1)}`;
  renderer.render(scene, camera);
}
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
updateChunks();
frame(performance.now());
