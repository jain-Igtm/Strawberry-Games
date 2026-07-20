import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const ui = {
  start: $('startScreen'), startBtn: $('startBtn'), zone: $('zone'), objective: $('objective'),
  status: $('topRight'), alarm: $('alarm'), prompt: $('prompt'), message: $('message'),
  damage: $('damage'), joy: $('joystick'), stick: $('stick'), lamp: $('lampBtn'), use: $('useBtn')
};

const scene = new THREE.Scene();
const SKY = new THREE.Color(0x9fc8dc);
const DARK = new THREE.Color(0x151b1a);
scene.background = SKY.clone();
scene.fog = new THREE.Fog(SKY.clone(), 24, 82);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.06, 110);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', precision: 'mediump' });
let renderScale = innerWidth * innerHeight > 1_200_000 ? 0.72 : 0.84;
function applyResolution() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25) * renderScale);
  renderer.setSize(innerWidth, innerHeight, false);
}
applyResolution();
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xdceaf0, 0x242821, 1.08);
const sun = new THREE.DirectionalLight(0xffe7bd, 0.92);
sun.position.set(-22, 36, -18);
scene.add(hemi, sun);

const flashlight = new THREE.SpotLight(0xf6fff2, 11, 28, 0.54, 0.6, 1.05);
flashlight.position.set(0, 0.03, 0.05);
flashlight.target.position.set(0, -0.08, -3);
camera.add(flashlight, flashlight.target);
scene.add(camera);

const BLOCK = { WALL: 1, FLOOR: 2, CEILING: 3, SERVICE: 4, STEP: 5 };
const materials = [
  null,
  new THREE.MeshLambertMaterial({ color: 0x676d65, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x393e39, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x505850, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x37423f, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x5e665f, flatShading: true })
];
const decorMaterials = {
  pipe: new THREE.MeshLambertMaterial({ color: 0x273230, flatShading: true }),
  metal: new THREE.MeshLambertMaterial({ color: 0x46504d, flatShading: true }),
  wood: new THREE.MeshLambertMaterial({ color: 0x6a5039, flatShading: true }),
  fabric: new THREE.MeshLambertMaterial({ color: 0x6d6258, flatShading: true }),
  door: new THREE.MeshLambertMaterial({ color: 0x42534f, flatShading: true }),
  glass: new THREE.MeshBasicMaterial({ color: 0xa8d7e7, transparent: true, opacity: 0.45, depthWrite: false }),
  warning: new THREE.MeshBasicMaterial({ color: 0x67151b }),
  warningLit: new THREE.MeshBasicMaterial({ color: 0xffe0d8 }),
  city: new THREE.MeshLambertMaterial({ color: 0x68716c, flatShading: true }),
  city2: new THREE.MeshLambertMaterial({ color: 0x7c847f, flatShading: true })
};
const BOX = new THREE.BoxGeometry(1, 1, 1);

const CHUNK = 16;
const HEIGHT = 9;
const VIEW = 2;
const UNLOAD = 3;
const chunks = new Map();
const buildQueue = [];
const queued = new Set();
const doorMeshes = [];
const activeDoors = new Set();
const activeShelters = new Set();
const activeWarnings = new Set();
const activeRamps = new Set();
const activeUpperZones = new Set();
const doorState = new Map();

function key(cx, cz) { return `${cx},${cz}`; }
function idx(x, y, z) { return x + CHUNK * (z + CHUNK * y); }
function hash(x, z, seed = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}
function voxel(data, x, y, z) {
  if (x < 0 || z < 0 || y < 0 || x >= CHUNK || z >= CHUNK || y >= HEIGHT) return 0;
  return data[idx(x, y, z)];
}
function setVoxel(data, x, y, z, value) {
  if (x < 0 || z < 0 || y < 0 || x >= CHUNK || z >= CHUNK || y >= HEIGHT) return;
  data[idx(x, y, z)] = value;
}
function fillRect(data, x0, z0, x1, z1, y0, y1, value) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) setVoxel(data, x, y, z, value);
}
function carveRect(data, x0, z0, x1, z1, y0 = 1, y1 = 3) {
  fillRect(data, x0, z0, x1, z1, y0, y1, 0);
}

function moduleType(cx, cz) {
  if (Math.abs(cx) + Math.abs(cz) < 2) return 'RESIDENTIAL';
  const r = hash(cx, cz, 17);
  if (r < 0.41) return 'RESIDENTIAL';
  if (r < 0.58) return 'SERVICE';
  if (r < 0.70) return 'ATRIUM';
  if (r < 0.84) return 'TUNNEL';
  return 'STAIRWELL';
}

function roomSpec(cx, cz, id, x0, z0, x1, z1, doorX, doorZ, axis, floor = 0) {
  return {
    id: `${cx},${cz}:${id}`,
    bounds: {
      minX: cx * CHUNK + x0 + 0.08, maxX: cx * CHUNK + x1 + 0.92,
      minZ: cz * CHUNK + z0 + 0.08, maxZ: cz * CHUNK + z1 + 0.92,
      floor
    },
    door: { x: cx * CHUNK + doorX, z: cz * CHUNK + doorZ, axis, floor }
  };
}

function makeChunkData(cx, cz) {
  const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  const type = moduleType(cx, cz);
  const rooms = [];
  const ramps = [];
  const upperZones = [];

  for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
    setVoxel(data, x, 0, z, BLOCK.FLOOR);
    setVoxel(data, x, 4, z, BLOCK.CEILING);
    for (let y = 1; y <= 3; y++) setVoxel(data, x, y, z, BLOCK.WALL);
  }

  carveRect(data, 6, 0, 9, 15);
  carveRect(data, 0, 6, 15, 9);

  const candidates = [
    { id: 'nw', x0: 1, z0: 1, x1: 4, z1: 5, dx: 5.5, dz: 3.5, axis: 'x', gapX: 5, gapZ: 3 },
    { id: 'ne', x0: 11, z0: 1, x1: 14, z1: 5, dx: 10.5, dz: 3.5, axis: 'x', gapX: 10, gapZ: 3 },
    { id: 'sw', x0: 1, z0: 10, x1: 4, z1: 14, dx: 5.5, dz: 12.5, axis: 'x', gapX: 5, gapZ: 12 },
    { id: 'se', x0: 11, z0: 10, x1: 14, z1: 14, dx: 10.5, dz: 12.5, axis: 'x', gapX: 10, gapZ: 12 }
  ];

  const roomCount = type === 'RESIDENTIAL' ? 3 : type === 'ATRIUM' ? 2 : type === 'SERVICE' ? 1 : 2;
  const offset = Math.floor(hash(cx, cz, 31) * candidates.length);
  for (let i = 0; i < roomCount; i++) {
    const c = candidates[(i + offset) % candidates.length];
    carveRect(data, c.x0, c.z0, c.x1, c.z1);
    carveRect(data, c.gapX, c.gapZ, c.gapX, c.gapZ, 1, 2);
    rooms.push(roomSpec(cx, cz, c.id, c.x0, c.z0, c.x1, c.z1, c.dx, c.dz, c.axis));
  }

  if (type === 'ATRIUM') {
    carveRect(data, 3, 3, 12, 12);
    fillRect(data, 5, 5, 10, 10, 4, 4, 0);
  }

  if (type === 'SERVICE') {
    fillRect(data, 1, 10, 5, 11, 1, 3, BLOCK.SERVICE);
    fillRect(data, 10, 4, 14, 5, 1, 3, BLOCK.SERVICE);
  }

  if (type === 'TUNNEL') {
    fillRect(data, 6, 0, 9, 15, 4, 4, BLOCK.SERVICE);
    fillRect(data, 0, 6, 15, 9, 4, 4, BLOCK.SERVICE);
  }

  if (type === 'STAIRWELL') {
    fillRect(data, 4, 0, 15, 15, 4, 4, BLOCK.FLOOR);
    fillRect(data, 4, 0, 15, 15, 8, 8, BLOCK.CEILING);
    fillRect(data, 4, 0, 15, 15, 5, 7, BLOCK.WALL);
    carveRect(data, 11, 0, 13, 14, 5, 7);
    carveRect(data, 5, 9, 9, 14, 5, 7);
    carveRect(data, 10, 11, 10, 11, 5, 6);
    rooms.push(roomSpec(cx, cz, 'upper', 5, 9, 9, 14, 10.5, 11.5, 'x', 4));

    carveRect(data, 10, 1, 14, 7, 1, 7);
    fillRect(data, 10, 1, 14, 7, 4, 4, 0);
    fillRect(data, 10, 1, 14, 1, 4, 4, BLOCK.FLOOR);
    fillRect(data, 11, 0, 13, 4, 8, 8, 0);

    ramps.push({
      minX: cx * CHUNK + 10.6, maxX: cx * CHUNK + 14.4,
      minZ: cz * CHUNK + 2.0, maxZ: cz * CHUNK + 7.3,
      floor0: 0, floor1: 4, direction: 'north'
    });
    upperZones.push({
      minX: cx * CHUNK + 8.9, maxX: cx * CHUNK + 15.9,
      minZ: cz * CHUNK - 0.1, maxZ: cz * CHUNK + 3.0, floor: 4
    });
    upperZones.push({
      minX: cx * CHUNK + 10.6, maxX: cx * CHUNK + 13.4,
      minZ: cz * CHUNK + 2.0, maxZ: cz * CHUNK + 15.0, floor: 4
    });
    upperZones.push({
      minX: cx * CHUNK + 4.9, maxX: cx * CHUNK + 10.4,
      minZ: cz * CHUNK + 8.9, maxZ: cz * CHUNK + 15.0, floor: 4
    });
  }

  return { data, type, rooms, ramps, upperZones };
}

const faces = [
  { d: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { d: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { d: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { d: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
];

function meshData(data, materialId) {
  const positions = [];
  const normals = [];
  const indices = [];
  let vertex = 0;
  for (let y = 0; y < HEIGHT; y++) for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
    if (voxel(data, x, y, z) !== materialId) continue;
    for (const face of faces) {
      if (voxel(data, x + face.d[0], y + face.d[1], z + face.d[2]) !== 0) continue;
      for (const corner of face.c) {
        positions.push(x + corner[0], y + corner[1], z + corner[2]);
        normals.push(face.d[0], face.d[1], face.d[2]);
      }
      indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
      vertex += 4;
    }
  }
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function addBox(group, x, y, z, w, h, d, material) {
  const mesh = new THREE.Mesh(BOX, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  group.add(mesh);
  return mesh;
}

function makeDoor(group, spec, chunkRecord) {
  const persistedOpen = doorState.get(spec.id) === true;
  const pivot = new THREE.Group();
  const floor = spec.door.floor;
  pivot.position.set(spec.door.x - chunkRecord.cx * CHUNK, floor, spec.door.z - chunkRecord.cz * CHUNK);
  group.add(pivot);

  const slab = new THREE.Mesh(BOX, decorMaterials.door);
  if (spec.door.axis === 'x') {
    slab.scale.set(0.12, 2.35, 0.92);
    slab.position.set(0, 1.175, 0.46);
  } else {
    slab.scale.set(0.92, 2.35, 0.12);
    slab.position.set(0.46, 1.175, 0);
  }
  pivot.add(slab);

  const door = {
    id: spec.id, pivot, slab, axis: spec.door.axis, open: persistedOpen,
    x: spec.door.x, z: spec.door.z, floor, roomBounds: spec.bounds
  };
  slab.userData.door = door;
  doorMeshes.push(slab);
  activeDoors.add(door);
  chunkRecord.doors.push(door);
  if (door.open) pivot.rotation.y = spec.door.axis === 'x' ? -1.46 : 1.46;
  return door;
}

function addRoomDecor(group, room, cx, cz, seed) {
  const b = room.bounds;
  const lx0 = b.minX - cx * CHUNK;
  const lx1 = b.maxX - cx * CHUNK;
  const lz0 = b.minZ - cz * CHUNK;
  const lz1 = b.maxZ - cz * CHUNK;
  const floor = b.floor;
  const flip = hash(cx, cz, seed) > 0.5 ? 1 : -1;
  addBox(group, (lx0 + lx1) / 2, floor + 0.28, flip > 0 ? lz1 - 0.8 : lz0 + 0.8, Math.max(1.8, lx1 - lx0 - 1), 0.5, 1.2, decorMaterials.fabric);
  addBox(group, flip > 0 ? lx0 + 0.65 : lx1 - 0.65, floor + 0.48, (lz0 + lz1) / 2, 0.8, 0.95, 0.8, decorMaterials.wood);
}

function buildChunk(cx, cz) {
  const k = key(cx, cz);
  if (chunks.has(k)) return;
  const generated = makeChunkData(cx, cz);
  const group = new THREE.Group();
  group.position.set(cx * CHUNK, 0, cz * CHUNK);
  const record = {
    cx, cz, type: generated.type, data: generated.data, group,
    geometries: [], doors: [], shelters: [], warnings: [], ramps: [], upperZones: []
  };

  for (let materialId = 1; materialId <= 5; materialId++) {
    const geometry = meshData(generated.data, materialId);
    if (!geometry) continue;
    record.geometries.push(geometry);
    group.add(new THREE.Mesh(geometry, materials[materialId]));
  }

  for (const room of generated.rooms) {
    const door = makeDoor(group, room, record);
    const shelter = { ...room.bounds, door };
    activeShelters.add(shelter);
    record.shelters.push(shelter);
    addRoomDecor(group, room, cx, cz, room.id.length);
  }

  for (const [x, z] of [[8, 3], [8, 12], [3, 8], [12, 8]]) {
    const warning = addBox(group, x, 3.72, z, 0.34, 0.18, 0.22, decorMaterials.warning);
    activeWarnings.add(warning);
    record.warnings.push(warning);
  }

  if (generated.type === 'SERVICE' || generated.type === 'TUNNEL') {
    for (let z = 2; z < 16; z += 4) {
      addBox(group, 6.18, 3.45, z, 0.16, 0.16, 3.4, decorMaterials.pipe);
      addBox(group, 9.82, 0.5, z, 0.55, 1.0, 0.55, decorMaterials.metal);
    }
  }

  if (generated.type === 'ATRIUM') {
    for (const [x, z] of [[4, 4], [11, 4], [4, 11], [11, 11]]) addBox(group, x, 1.5, z, 0.48, 3, 0.48, decorMaterials.metal);
  }

  if (generated.type === 'STAIRWELL') {
    for (let i = 0; i < 15; i++) {
      const t = i / 14;
      addBox(group, 12.5, 0.12 + t * 4, 7.0 - t * 5.0, 3.0, 0.24, 0.44, materials[BLOCK.STEP]);
    }
    addBox(group, 10.15, 6.0, 1.4, 0.12, 1.5, 2.4, decorMaterials.glass);
    addBox(group, 14.85, 6.0, 1.4, 0.12, 1.5, 2.4, decorMaterials.glass);
  }

  for (let i = 0; i < 3; i++) {
    const side = i % 2 ? -1 : 1;
    const height = 13 + Math.floor(hash(cx + i, cz, 92) * 20);
    addBox(group, side * (22 + i * 8), height / 2 - 1, 4 + i * 6, 7 + i * 2, height, 7, i % 2 ? decorMaterials.city : decorMaterials.city2);
  }

  for (const ramp of generated.ramps) { activeRamps.add(ramp); record.ramps.push(ramp); }
  for (const zone of generated.upperZones) { activeUpperZones.add(zone); record.upperZones.push(zone); }

  scene.add(group);
  chunks.set(k, record);
}

function unloadChunk(k) {
  const chunk = chunks.get(k);
  if (!chunk) return;
  for (const door of chunk.doors) {
    activeDoors.delete(door);
    const at = doorMeshes.indexOf(door.slab);
    if (at >= 0) doorMeshes.splice(at, 1);
  }
  for (const shelter of chunk.shelters) activeShelters.delete(shelter);
  for (const warning of chunk.warnings) activeWarnings.delete(warning);
  for (const ramp of chunk.ramps) activeRamps.delete(ramp);
  for (const zone of chunk.upperZones) activeUpperZones.delete(zone);
  scene.remove(chunk.group);
  for (const geometry of chunk.geometries) geometry.dispose();
  chunks.delete(k);
}

function queueChunk(cx, cz, priority = false) {
  const k = key(cx, cz);
  if (chunks.has(k) || queued.has(k)) return;
  queued.add(k);
  if (priority) buildQueue.unshift({ cx, cz, k }); else buildQueue.push({ cx, cz, k });
}

let streamCX = Number.NaN;
let streamCZ = Number.NaN;
function updateStreaming(force = false) {
  const cx = Math.floor(player.x / CHUNK);
  const cz = Math.floor(player.z / CHUNK);
  if (!force && cx === streamCX && cz === streamCZ) return;
  streamCX = cx;
  streamCZ = cz;

  const needed = [];
  for (let dz = -VIEW; dz <= VIEW; dz++) for (let dx = -VIEW; dx <= VIEW; dx++) {
    needed.push({ cx: cx + dx, cz: cz + dz, distance: Math.abs(dx) + Math.abs(dz) });
  }
  needed.sort((a, b) => a.distance - b.distance);
  for (const item of needed) queueChunk(item.cx, item.cz, item.distance === 0);

  for (const [k, chunk] of chunks) {
    if (Math.abs(chunk.cx - cx) > UNLOAD || Math.abs(chunk.cz - cz) > UNLOAD) unloadChunk(k);
  }
}

function buildQueuedChunk() {
  while (buildQueue.length) {
    const next = buildQueue.shift();
    queued.delete(next.k);
    if (Math.abs(next.cx - streamCX) > VIEW || Math.abs(next.cz - streamCZ) > VIEW) continue;
    if (!chunks.has(next.k)) buildChunk(next.cx, next.cz);
    return;
  }
}

function chunkAt(x, z) {
  return chunks.get(key(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));
}
function solidAt(x, y, z) {
  const cx = Math.floor(x / CHUNK);
  const cz = Math.floor(z / CHUNK);
  const chunk = chunks.get(key(cx, cz));
  if (!chunk) return true;
  const lx = Math.floor(x - cx * CHUNK);
  const lz = Math.floor(z - cz * CHUNK);
  return voxel(chunk.data, lx, Math.floor(y), lz) !== 0;
}

const player = { x: 8, y: 1.67, z: 8, yaw: Math.PI, pitch: 0, radius: 0.31, floor: 0, exposure: 0 };

function floorAt(x, z, previousFloor) {
  for (const ramp of activeRamps) {
    if (x < ramp.minX || x > ramp.maxX || z < ramp.minZ || z > ramp.maxZ) continue;
    const t = ramp.direction === 'north'
      ? (ramp.maxZ - z) / (ramp.maxZ - ramp.minZ)
      : (z - ramp.minZ) / (ramp.maxZ - ramp.minZ);
    return THREE.MathUtils.clamp(t, 0, 1) * (ramp.floor1 - ramp.floor0) + ramp.floor0;
  }
  for (const zone of activeUpperZones) {
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) return zone.floor;
  }
  return previousFloor > 2.2 ? 4 : 0;
}

function doorBlocks(x, z, floor) {
  for (const door of activeDoors) {
    if (door.open || Math.abs(door.floor - floor) > 0.7) continue;
    const halfX = door.axis === 'x' ? 0.18 : 0.52;
    const halfZ = door.axis === 'x' ? 0.52 : 0.18;
    if (x + player.radius > door.x - halfX && x - player.radius < door.x + halfX && z + player.radius > door.z - halfZ && z - player.radius < door.z + halfZ) return true;
  }
  return false;
}

function blocked(x, z, floor) {
  if (doorBlocks(x, z, floor)) return true;
  const r = player.radius;
  const foot = floor + 0.12;
  const chest = floor + 1.08;
  const head = floor + 1.62;
  for (const [sx, sz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    if (solidAt(x + sx, foot, z + sz) || solidAt(x + sx, chest, z + sz) || solidAt(x + sx, head, z + sz)) return true;
  }
  return false;
}

const raycaster = new THREE.Raycaster();
let aimedDoor = null;
function updateAim() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = raycaster.intersectObjects(doorMeshes, false).find((entry) => entry.distance < 3.5);
  aimedDoor = hit?.object?.userData?.door || null;
  ui.prompt.style.display = aimedDoor ? 'block' : 'none';
  if (aimedDoor) ui.prompt.textContent = `[ USE ] ${aimedDoor.open ? 'CLOSE' : 'OPEN'} DOOR`;
}

function useDoor() {
  updateAim();
  if (!aimedDoor) return;
  aimedDoor.open = !aimedDoor.open;
  doorState.set(aimedDoor.id, aimedDoor.open);
  aimedDoor.pivot.rotation.y = aimedDoor.open ? (aimedDoor.axis === 'x' ? -1.46 : 1.46) : 0;
}

let lampOn = true;
function toggleLamp() {
  lampOn = !lampOn;
  flashlight.visible = lampOn;
  ui.lamp.textContent = lampOn ? 'LAMP' : 'LAMP OFF';
  ui.lamp.classList.toggle('lamp-off', !lampOn);
}

function safeInShelter() {
  for (const shelter of activeShelters) {
    if (Math.abs(shelter.floor - player.floor) > 0.8) continue;
    if (player.x > shelter.minX && player.x < shelter.maxX && player.z > shelter.minZ && player.z < shelter.maxZ && !shelter.door.open) return true;
  }
  return false;
}

let audioContext = null;
let alarmOsc = null;
let alarmGain = null;
function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
}
function alarmOn() {
  ensureAudio();
  if (alarmOsc) return;
  alarmOsc = audioContext.createOscillator();
  alarmGain = audioContext.createGain();
  alarmOsc.type = 'square';
  alarmOsc.frequency.value = 410;
  alarmGain.gain.value = 0.025;
  alarmOsc.connect(alarmGain).connect(audioContext.destination);
  alarmOsc.start();
}
function alarmOff() {
  if (!alarmOsc) return;
  alarmOsc.stop();
  alarmOsc = null;
  alarmGain = null;
}

const event = { state: 'normal', timer: 62 + hash(Date.now(), 7, 2) * 48, cycle: 0 };
function setEvent(state, timer) {
  event.state = state;
  event.timer = timer;
  if (state === 'warning' || state === 'active') alarmOn(); else alarmOff();
}
function showMessage(text, duration = 2500) {
  ui.message.textContent = text;
  ui.message.style.display = 'block';
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => { ui.message.style.display = 'none'; }, duration);
}
function relocatePlayer() {
  const cx = Math.floor(player.x / CHUNK);
  const cz = Math.floor(player.z / CHUNK);
  player.x = cx * CHUNK + 8;
  player.z = cz * CHUNK + 8;
  player.floor = 0;
  player.y = 1.67;
  player.exposure = 0;
  showMessage('EXPOSURE DETECTED — EMERGENCY RELOCATION');
}
function updateEvent(dt, now) {
  event.timer -= dt;
  if (event.state === 'normal' && event.timer <= 0) setEvent('warning', 20);
  else if (event.state === 'warning' && event.timer <= 0) setEvent('active', 18);
  else if (event.state === 'active' && event.timer <= 0) { event.cycle++; setEvent('clear', 8); }
  else if (event.state === 'clear' && event.timer <= 0) setEvent('normal', 155 + hash(event.cycle, 11, 4) * 170);

  const danger = event.state === 'warning' || event.state === 'active';
  const flash = danger && Math.floor(now / 260) % 2 === 0;
  for (const warning of activeWarnings) warning.material = flash ? decorMaterials.warningLit : decorMaterials.warning;

  if (event.state === 'warning') {
    ui.alarm.style.display = 'block';
    ui.alarm.textContent = `САМОСБОР WARNING — SEEK SHELTER ${Math.ceil(event.timer)}s`;
    ui.objective.textContent = 'ENTER AN APARTMENT AND CLOSE THE DOOR';
  } else if (event.state === 'active') {
    const sealed = safeInShelter();
    ui.alarm.style.display = 'block';
    ui.alarm.textContent = sealed ? 'САМОСБОР ACTIVE — SHELTER SEALED' : 'САМОСБОР ACTIVE — EXPOSED';
    ui.objective.textContent = sealed ? 'WAIT FOR THE ALL-CLEAR' : 'GET BEHIND A CLOSED DOOR';
    if (sealed) {
      player.exposure = Math.max(0, player.exposure - dt * 2.5);
      ui.damage.style.opacity = '0';
    } else {
      player.exposure += dt;
      ui.damage.style.opacity = String(Math.min(1, player.exposure / 1.4));
      if (player.exposure > 3.2) relocatePlayer();
    }
  } else if (event.state === 'clear') {
    ui.alarm.style.display = 'block';
    ui.alarm.textContent = 'ALL CLEAR — CORRIDORS SAFE';
    ui.objective.textContent = 'CONTINUE THROUGH THE COMBINE';
    ui.damage.style.opacity = '0';
  } else {
    ui.alarm.style.display = 'none';
    ui.objective.textContent = 'EXPLORE THE ENDLESS RESIDENTIAL COMBINE';
    ui.damage.style.opacity = '0';
  }

  if (alarmOsc) {
    alarmOsc.frequency.value = flash ? 505 : 385;
    alarmGain.gain.value = event.state === 'active' ? 0.045 : 0.025;
  }
}

let started = false;
let joyX = 0;
let joyY = 0;
let joyPointer = null;
let lookPointer = null;
let lastLookX = 0;
let lastLookY = 0;
const keys = Object.create(null);

function setStick(eventPointer) {
  const rect = ui.joy.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = eventPointer.clientX - centerX;
  const dy = eventPointer.clientY - centerY;
  const maximum = rect.width * 0.34;
  const length = Math.hypot(dx, dy) || 1;
  const amount = Math.min(maximum, length);
  joyX = (dx / length) * amount / maximum;
  joyY = (dy / length) * amount / maximum;
  ui.stick.style.transform = `translate(${(dx / length) * amount}px, ${(dy / length) * amount}px)`;
}
function releaseStick() {
  joyX = 0;
  joyY = 0;
  joyPointer = null;
  ui.stick.style.transform = 'translate(0,0)';
}

ui.joy.addEventListener('pointerdown', (eventPointer) => {
  if (!started) return;
  eventPointer.preventDefault();
  eventPointer.stopPropagation();
  joyPointer = eventPointer.pointerId;
  ui.joy.setPointerCapture(eventPointer.pointerId);
  setStick(eventPointer);
});
ui.joy.addEventListener('pointermove', (eventPointer) => {
  if (eventPointer.pointerId === joyPointer) setStick(eventPointer);
});
ui.joy.addEventListener('pointerup', (eventPointer) => {
  if (eventPointer.pointerId === joyPointer) releaseStick();
});
ui.joy.addEventListener('pointercancel', releaseStick);

renderer.domElement.addEventListener('pointerdown', (eventPointer) => {
  if (!started || document.pointerLockElement === renderer.domElement || eventPointer.clientX < innerWidth * 0.42) return;
  lookPointer = eventPointer.pointerId;
  lastLookX = eventPointer.clientX;
  lastLookY = eventPointer.clientY;
  renderer.domElement.setPointerCapture(eventPointer.pointerId);
});
renderer.domElement.addEventListener('pointermove', (eventPointer) => {
  if (eventPointer.pointerId !== lookPointer || document.pointerLockElement === renderer.domElement) return;
  const dx = eventPointer.clientX - lastLookX;
  const dy = eventPointer.clientY - lastLookY;
  lastLookX = eventPointer.clientX;
  lastLookY = eventPointer.clientY;
  player.yaw -= dx * 0.0038;
  player.pitch = THREE.MathUtils.clamp(player.pitch + dy * 0.003, -1.05, 0.78);
});
renderer.domElement.addEventListener('pointerup', (eventPointer) => {
  if (eventPointer.pointerId === lookPointer) lookPointer = null;
});
renderer.domElement.addEventListener('pointercancel', () => { lookPointer = null; });
renderer.domElement.addEventListener('click', () => {
  if (started && matchMedia('(pointer:fine)').matches && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
});
addEventListener('mousemove', (eventPointer) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= eventPointer.movementX * 0.0023;
  player.pitch = THREE.MathUtils.clamp(player.pitch + eventPointer.movementY * 0.0021, -1.05, 0.78);
});

function bindButton(element, action) {
  element.addEventListener('pointerdown', (eventPointer) => {
    eventPointer.preventDefault();
    eventPointer.stopPropagation();
    action();
  });
}
bindButton(ui.use, useDoor);
bindButton(ui.lamp, toggleLamp);

addEventListener('keydown', (eventKey) => {
  keys[eventKey.code] = true;
  if (eventKey.code === 'KeyE') useDoor();
  if (eventKey.code === 'KeyF') toggleLamp();
});
addEventListener('keyup', (eventKey) => { keys[eventKey.code] = false; });
addEventListener('blur', () => { releaseStick(); lookPointer = null; for (const code of Object.keys(keys)) keys[code] = false; });

ui.startBtn.onclick = () => {
  started = true;
  ui.start.style.display = 'none';
  ensureAudio();
  updateStreaming(true);
};

buildChunk(0, 0);
updateStreaming(true);

let last = performance.now();
let hudTick = 0;
let aimTick = 0;
let qualityWindowStart = last;
let qualityFrames = 0;

function updateAtmosphere(dt) {
  const type = chunkAt(player.x, player.z)?.type || 'RESIDENTIAL';
  let lightTarget = 0.92;
  let sunTarget = 0.72;
  let darkMix = 0;
  if (type === 'TUNNEL') { lightTarget = 0.34; sunTarget = 0.08; darkMix = 0.78; }
  else if (type === 'SERVICE') { lightTarget = 0.58; sunTarget = 0.26; darkMix = 0.38; }
  else if (type === 'STAIRWELL') { lightTarget = 1.15; sunTarget = 1.1; darkMix = 0; }
  else if (type === 'ATRIUM') { lightTarget = 1.08; sunTarget = 1.0; darkMix = 0; }
  hemi.intensity = THREE.MathUtils.damp(hemi.intensity, lightTarget, 3.2, dt);
  sun.intensity = THREE.MathUtils.damp(sun.intensity, sunTarget, 3.2, dt);
  const targetColor = SKY.clone().lerp(DARK, darkMix);
  scene.background.lerp(targetColor, 1 - Math.exp(-dt * 2.4));
  scene.fog.color.copy(scene.background);
}

function updateHud(now) {
  if (now - hudTick < 250) return;
  hudTick = now;
  const cx = Math.floor(player.x / CHUNK);
  const cz = Math.floor(player.z / CHUNK);
  const type = chunks.get(key(cx, cz))?.type || 'LOADING';
  const level = player.floor > 2 ? 'UPPER LEVEL' : 'LOWER LEVEL';
  ui.zone.textContent = `${type} — ${level} — SECTION ${cx},${cz}`;
  ui.status.innerHTML = `LAMP ${lampOn ? 'ON' : 'OFF'}<br>EVENT ${event.state.toUpperCase()}<br>CHUNKS ${chunks.size}<br>FPS ${measuredFPS}`;
}

let measuredFPS = 60;
function updateQuality(now) {
  qualityFrames++;
  const elapsed = now - qualityWindowStart;
  if (elapsed < 2200) return;
  measuredFPS = Math.round(qualityFrames * 1000 / elapsed);
  qualityFrames = 0;
  qualityWindowStart = now;
  let nextScale = renderScale;
  if (measuredFPS < 40) nextScale = Math.max(0.55, renderScale - 0.08);
  else if (measuredFPS > 57) nextScale = Math.min(0.94, renderScale + 0.035);
  if (Math.abs(nextScale - renderScale) > 0.001) {
    renderScale = nextScale;
    applyResolution();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  buildQueuedChunk();

  if (started) {
    let forward = -joyY + (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    let strafe = joyX + (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const magnitude = Math.hypot(forward, strafe);
    if (magnitude > 1) { forward /= magnitude; strafe /= magnitude; }

    const speed = 5.15;
    const sine = Math.sin(player.yaw);
    const cosine = Math.cos(player.yaw);
    const dx = (strafe * cosine - forward * sine) * speed * dt;
    const dz = (-strafe * sine - forward * cosine) * speed * dt;

    const floorX = floorAt(player.x + dx, player.z, player.floor);
    if (!blocked(player.x + dx, player.z, floorX)) { player.x += dx; player.floor = floorX; }
    const floorZ = floorAt(player.x, player.z + dz, player.floor);
    if (!blocked(player.x, player.z + dz, floorZ)) { player.z += dz; player.floor = floorZ; }
    player.y = player.floor + 1.67;

    camera.position.set(player.x, player.y, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    updateStreaming();
    if (now - aimTick > 90) { updateAim(); aimTick = now; }
    updateEvent(dt, now);
    updateAtmosphere(dt);
    updateHud(now);
  }

  updateQuality(now);
  renderer.render(scene, camera);
}
frame(last);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  applyResolution();
});
