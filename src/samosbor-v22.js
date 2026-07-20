import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const ui = {
  start: $('startScreen'), startBtn: $('startBtn'), zone: $('zone'), objective: $('objective'),
  status: $('topRight'), alarm: $('alarm'), prompt: $('prompt'), message: $('message'),
  damage: $('damage'), joy: $('joystick'), stick: $('stick'), lamp: $('lampBtn'), use: $('useBtn')
};

const SKY = new THREE.Color(0xa8d4e6);
const NIGHT = new THREE.Color(0x101817);
const scene = new THREE.Scene();
scene.background = SKY.clone();
scene.fog = new THREE.Fog(SKY.clone(), 82, 235);

const camera = new THREE.PerspectiveCamera(innerHeight > innerWidth ? 62 : 72, innerWidth / innerHeight, 0.07, 245);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', precision: 'mediump' });
let renderScale = innerWidth * innerHeight > 1_100_000 ? 0.76 : 0.9;
function resizeRenderer() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.15) * renderScale);
  renderer.setSize(innerWidth, innerHeight, false);
}
resizeRenderer();
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const hemisphere = new THREE.HemisphereLight(0xe3f2f5, 0x222820, 1.08);
const sun = new THREE.DirectionalLight(0xffe7bc, 1.08);
sun.position.set(-38, 52, -24);
scene.add(hemisphere, sun);

const flashlight = new THREE.SpotLight(0xf6fff2, 11, 34, 0.55, 0.58, 1.05);
flashlight.position.set(0, 0.04, 0.05);
flashlight.target.position.set(0, -0.08, -3);
camera.add(flashlight, flashlight.target);
scene.add(camera);

const M = {
  wall: new THREE.MeshLambertMaterial({ color: 0x747a72, flatShading: true }),
  wallDark: new THREE.MeshLambertMaterial({ color: 0x555d58, flatShading: true }),
  wallWarm: new THREE.MeshLambertMaterial({ color: 0x9b9583, flatShading: true }),
  floor: new THREE.MeshLambertMaterial({ color: 0x414741, flatShading: true }),
  floorLight: new THREE.MeshLambertMaterial({ color: 0x827f70, flatShading: true }),
  ceiling: new THREE.MeshLambertMaterial({ color: 0x59615a, flatShading: true }),
  ceilingLight: new THREE.MeshLambertMaterial({ color: 0xa9a38e, flatShading: true }),
  door: new THREE.MeshLambertMaterial({ color: 0x40534f, flatShading: true }),
  wood: new THREE.MeshLambertMaterial({ color: 0x73583f, flatShading: true }),
  fabric: new THREE.MeshLambertMaterial({ color: 0x776b5d, flatShading: true }),
  metal: new THREE.MeshLambertMaterial({ color: 0x394744, flatShading: true }),
  pipe: new THREE.MeshLambertMaterial({ color: 0x283633, flatShading: true }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xf5f3d4 }),
  lampWarm: new THREE.MeshBasicMaterial({ color: 0xffe5ae }),
  red: new THREE.MeshBasicMaterial({ color: 0x64131a }),
  glass: new THREE.MeshBasicMaterial({ color: 0xb7e8f4, transparent: true, opacity: 0.48, depthWrite: false }),
  city: new THREE.MeshLambertMaterial({ color: 0x737c77, flatShading: true }),
  city2: new THREE.MeshLambertMaterial({ color: 0x909792, flatShading: true }),
  plant: new THREE.MeshLambertMaterial({ color: 0x3f5944, flatShading: true })
};

const GEO = new THREE.BoxGeometry(1, 1, 1);
const SECTOR = 48;
const LOAD_RADIUS = matchMedia('(pointer:fine)').matches ? 2 : 1;
const UNLOAD_RADIUS = LOAD_RADIUS + 1;
const WALL_HEIGHT = 4.2;
const EDGE_GAP = 12;

const sectors = new Map();
const colliders = [];
const doors = [];
const interactables = [];
const shelters = [];
const warnings = [];
const ramps = [];
const upperZones = [];
const buildQueue = [];
const queued = new Set();

function hash(a, b = 0, c = 0) {
  const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}
function sectorId(x, z) { return `${x},${z}`; }

function addBox(group, x, y, z, w, h, d, material, solid = false) {
  const mesh = new THREE.Mesh(GEO, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  group.add(mesh);
  if (solid) {
    const collider = {
      minX: x - w / 2, maxX: x + w / 2,
      minY: y - h / 2, maxY: y + h / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      enabled: true, owner: group
    };
    colliders.push(collider);
    group.userData.colliders.push(collider);
    mesh.userData.collider = collider;
  }
  return mesh;
}

function addLightPanel(group, x, y, z, w, d, warm = false) {
  return addBox(group, x, y, z, w, 0.06, d, warm ? M.lampWarm : M.lamp, false);
}

function addDoor(group, x, floor, z, axis, room, direction = 1) {
  const pivot = new THREE.Group();
  pivot.position.set(x, floor, z);
  group.add(pivot);

  const slab = new THREE.Mesh(GEO, M.door);
  if (axis === 'x') {
    slab.scale.set(0.16, 2.6, 1.5);
    slab.position.set(0, 1.3, 0);
  } else {
    slab.scale.set(1.5, 2.6, 0.16);
    slab.position.set(0, 1.3, 0);
  }
  pivot.add(slab);

  const collider = {
    minX: x - (axis === 'x' ? 0.13 : 0.82), maxX: x + (axis === 'x' ? 0.13 : 0.82),
    minY: floor, maxY: floor + 2.65,
    minZ: z - (axis === 'z' ? 0.13 : 0.82), maxZ: z + (axis === 'z' ? 0.13 : 0.82),
    enabled: true, owner: group
  };
  colliders.push(collider);
  group.userData.colliders.push(collider);

  const door = { pivot, slab, collider, axis, direction, open: false, room, owner: group };
  slab.userData.door = door;
  doors.push(door);
  interactables.push(slab);
  group.userData.doors.push(door);
  return door;
}

function addWarning(group, x, y, z) {
  const warning = addBox(group, x, y, z, 0.48, 0.22, 0.15, M.red, false);
  warnings.push(warning);
  group.userData.warnings.push(warning);
}

function addWindowWall(group, x, floor, z, length, axis = 'x', warm = false) {
  const height = 4.1;
  const wallMat = warm ? M.wallWarm : M.wall;
  if (axis === 'x') {
    addBox(group, x, floor + 0.42, z, length, 0.84, 0.22, wallMat, true);
    addBox(group, x, floor + height - 0.48, z, length, 0.96, 0.22, wallMat, true);
    const panes = Math.max(2, Math.floor(length / 4));
    const paneW = length / panes;
    for (let i = 0; i < panes; i++) {
      const px = x - length / 2 + paneW * (i + 0.5);
      addBox(group, px, floor + 2.08, z, paneW - 0.18, 2.35, 0.11, M.glass, true);
      addBox(group, x - length / 2 + paneW * i, floor + 2.08, z, 0.12, 2.55, 0.28, M.metal, true);
    }
    addBox(group, x + length / 2, floor + 2.08, z, 0.12, 2.55, 0.28, M.metal, true);
  } else {
    addBox(group, x, floor + 0.42, z, 0.22, 0.84, length, wallMat, true);
    addBox(group, x, floor + height - 0.48, z, 0.22, 0.96, length, wallMat, true);
    const panes = Math.max(2, Math.floor(length / 4));
    const paneD = length / panes;
    for (let i = 0; i < panes; i++) {
      const pz = z - length / 2 + paneD * (i + 0.5);
      addBox(group, x, floor + 2.08, pz, 0.11, 2.35, paneD - 0.18, M.glass, true);
      addBox(group, x, floor + 2.08, z - length / 2 + paneD * i, 0.28, 2.55, 0.12, M.metal, true);
    }
    addBox(group, x, floor + 2.08, z + length / 2, 0.28, 2.55, 0.12, M.metal, true);
  }
}

function addApartment(group, cfg) {
  const { x, z, w, d, floor = 0, doorSide = 'south', bright = false, windowSide = null } = cfg;
  const wall = bright ? M.wallWarm : M.wall;
  const floorMat = bright ? M.floorLight : M.floor;
  const ceilingMat = bright ? M.ceilingLight : M.ceiling;
  const top = floor + WALL_HEIGHT;

  addBox(group, x, floor - 0.1, z, w, 0.2, d, floorMat, false);
  addBox(group, x, top + 0.1, z, w, 0.2, d, ceilingMat, false);

  const room = {
    minX: x - w / 2 + 0.18, maxX: x + w / 2 - 0.18,
    minZ: z - d / 2 + 0.18, maxZ: z + d / 2 - 0.18,
    floor, door: null
  };

  const gap = 2.05;
  if (doorSide === 'south' || doorSide === 'north') {
    const wallZ = z + (doorSide === 'south' ? d / 2 : -d / 2);
    const sideLength = (w - gap) / 2;
    addBox(group, x - (gap + sideLength) / 2, floor + WALL_HEIGHT / 2, wallZ, sideLength, WALL_HEIGHT, 0.22, wall, true);
    addBox(group, x + (gap + sideLength) / 2, floor + WALL_HEIGHT / 2, wallZ, sideLength, WALL_HEIGHT, 0.22, wall, true);
    addBox(group, x, floor + 3.55, wallZ, gap, 1.3, 0.22, wall, true);
    room.door = addDoor(group, x, floor, wallZ, 'z', room, doorSide === 'south' ? -1 : 1);
  } else {
    const wallX = x + (doorSide === 'east' ? w / 2 : -w / 2);
    const sideLength = (d - gap) / 2;
    addBox(group, wallX, floor + WALL_HEIGHT / 2, z - (gap + sideLength) / 2, 0.22, WALL_HEIGHT, sideLength, wall, true);
    addBox(group, wallX, floor + WALL_HEIGHT / 2, z + (gap + sideLength) / 2, 0.22, WALL_HEIGHT, sideLength, wall, true);
    addBox(group, wallX, floor + 3.55, z, 0.22, 1.3, gap, wall, true);
    room.door = addDoor(group, wallX, floor, z, 'x', room, doorSide === 'east' ? -1 : 1);
  }

  const sides = ['north', 'south', 'east', 'west'];
  for (const side of sides) {
    if (side === doorSide) continue;
    if (side === windowSide) {
      if (side === 'north' || side === 'south') addWindowWall(group, x, floor, z + (side === 'south' ? d / 2 : -d / 2), w, 'x', bright);
      else addWindowWall(group, x + (side === 'east' ? w / 2 : -w / 2), floor, z, d, 'z', bright);
      continue;
    }
    if (side === 'north' || side === 'south') addBox(group, x, floor + WALL_HEIGHT / 2, z + (side === 'south' ? d / 2 : -d / 2), w, WALL_HEIGHT, 0.22, wall, true);
    else addBox(group, x + (side === 'east' ? w / 2 : -w / 2), floor + WALL_HEIGHT / 2, z, 0.22, WALL_HEIGHT, d, wall, true);
  }

  addBox(group, x, floor + 0.34, z + d * 0.24, Math.min(3.4, w - 1.4), 0.62, 1.45, M.fabric, true);
  addBox(group, x - w * 0.3, floor + 0.48, z - d * 0.28, 1.05, 0.96, 0.8, M.wood, true);
  addBox(group, x + w * 0.29, floor + 1.0, z - d * 0.28, 0.72, 2.0, 0.72, M.metal, true);
  if (bright) addLightPanel(group, x, top - 0.08, z, Math.min(3.8, w - 1), 0.7, true);

  shelters.push(room);
  group.userData.shelters.push(room);
  return room;
}

function edgeOpen(gx, gz, direction) {
  if (gx === 0 && gz === 0) return true;
  if (direction === 'E') return edgeOpen(gx + 1, gz, 'W');
  if (direction === 'S') return edgeOpen(gx, gz + 1, 'N');
  if (direction === 'N') return gx % 3 === 0 || hash(gx, gz, 1) > 0.31;
  return gz % 3 === 0 || hash(gx, gz, 2) > 0.31;
}

function buildBoundary(group, cx, cz, openings, floor = 0, height = WALL_HEIGHT) {
  const half = SECTOR / 2;
  const y = floor + height / 2;
  const sideSegment = (SECTOR - EDGE_GAP) / 2;
  const offset = (EDGE_GAP + sideSegment) / 2;

  function horizontal(z, open) {
    if (open) {
      addBox(group, cx - offset, y, z, sideSegment, height, 0.25, M.wall, true);
      addBox(group, cx + offset, y, z, sideSegment, height, 0.25, M.wall, true);
    } else addBox(group, cx, y, z, SECTOR, height, 0.25, M.wall, true);
  }
  function vertical(x, open) {
    if (open) {
      addBox(group, x, y, cz - offset, 0.25, height, sideSegment, M.wall, true);
      addBox(group, x, y, cz + offset, 0.25, height, sideSegment, M.wall, true);
    } else addBox(group, x, y, cz, 0.25, height, SECTOR, M.wall, true);
  }

  horizontal(cz - half, openings.n);
  horizontal(cz + half, openings.s);
  vertical(cx - half, openings.w);
  vertical(cx + half, openings.e);
}

function addSectorShell(group, cx, cz, openings, options = {}) {
  const floorMat = options.floorMat || M.floor;
  const ceilingMat = options.ceilingMat || M.ceiling;
  addBox(group, cx, -0.12, cz, SECTOR, 0.24, SECTOR, floorMat, false);
  if (!options.noCeiling) addBox(group, cx, WALL_HEIGHT + 0.12, cz, SECTOR, 0.24, SECTOR, ceilingMat, false);
  buildBoundary(group, cx, cz, openings);
}

function addCeilingGrid(group, cx, cz, warm = false) {
  for (let x = -16; x <= 16; x += 8) for (let z = -16; z <= 16; z += 8) addLightPanel(group, cx + x, WALL_HEIGHT - 0.06, cz + z, 2.5, 0.5, warm);
}

function buildHub(group, cx, cz, openings) {
  // Keep the initial hall open enough that the player can learn the controls
  // and choose any route without spawning inside decoration.
  addSectorShell(group, cx, cz, openings);

  for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) {
    addBox(group, cx + x, 2.05, cz + z, 0.7, 4.1, 0.7, M.metal, true);
  }

  for (const [x, z] of [[-10, -10], [0, -10], [10, -10], [-10, 10], [0, 10], [10, 10]]) {
    addLightPanel(group, cx + x, WALL_HEIGHT - 0.05, cz + z, 2.2, 0.48, false);
  }

  addBox(group, cx - 17.5, 0.38, cz, 4.8, 0.76, 1.2, M.wood, true);
  addBox(group, cx + 17.5, 0.38, cz, 4.8, 0.76, 1.2, M.wood, true);
  addBox(group, cx, 3.1, cz - 18.8, 13, 0.16, 0.16, M.pipe, false);

  const hubLight = new THREE.PointLight(0xffefd0, 0.55, 32, 1.8);
  hubLight.position.set(cx, 3.5, cz);
  group.add(hubLight);
  addWarning(group, cx, 3.48, cz + 7.5);
}

function buildResidential(group, cx, cz, openings, seed) {
  addSectorShell(group, cx, cz, openings);
  addCeilingGrid(group, cx, cz, false);
  const flip = hash(seed, 1, 8) > 0.5 ? 1 : -1;
  const sideZ = cz + flip * 15.5;
  for (let i = -1; i <= 1; i++) {
    addApartment(group, {
      x: cx + i * 12.5, z: sideZ, w: 10.5, d: 13,
      doorSide: flip > 0 ? 'north' : 'south', bright: false,
      windowSide: flip > 0 ? 'south' : 'north'
    });
  }
  addBox(group, cx, 2.9, cz - flip * 15, 18, 0.16, 0.16, M.pipe, false);
  addWarning(group, cx, 3.48, cz + flip * 7.5);
}

function buildAtrium(group, cx, cz, openings) {
  addSectorShell(group, cx, cz, openings, { noCeiling: true, floorMat: M.floorLight });
  const ceilingY = WALL_HEIGHT + 0.12;
  addBox(group, cx - 18, ceilingY, cz, 12, 0.24, SECTOR, M.ceilingLight, false);
  addBox(group, cx + 18, ceilingY, cz, 12, 0.24, SECTOR, M.ceilingLight, false);
  addBox(group, cx, ceilingY, cz - 18, 24, 0.24, 12, M.ceilingLight, false);
  addBox(group, cx, ceilingY, cz + 18, 24, 0.24, 12, M.ceilingLight, false);
  for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) addBox(group, cx + x, 2.1, cz + z, 0.75, 4.2, 0.75, M.wallWarm, true);
  addBox(group, cx, 0.45, cz, 12, 0.9, 8, M.wood, true);
  for (let x = -4; x <= 4; x += 4) addBox(group, cx + x, 1.1, cz, 1.2, 1.3, 1.2, M.plant, true);
  const light = new THREE.PointLight(0xffdfaa, 1.0, 42, 1.5);
  light.position.set(cx, 7.2, cz);
  group.add(light);
  addWarning(group, cx, 3.48, cz + 8);
}

function buildService(group, cx, cz, openings, seed) {
  addSectorShell(group, cx, cz, openings, { ceilingMat: M.wallDark });
  for (let x = -15; x <= 15; x += 10) addLightPanel(group, cx + x, 4.02, cz, 2.2, 0.4, false);
  const side = hash(seed, 4, 2) > 0.5 ? 1 : -1;
  for (let i = -1; i <= 1; i++) {
    const z = cz + i * 12;
    addBox(group, cx + side * 15.5, 1.25, z, 7.5, 2.5, 6, M.metal, true);
    addBox(group, cx + side * 11.2, 2.9, z, 0.26, 0.26, 8.0, M.pipe, false);
  }
  addBox(group, cx - side * 16.5, 3.25, cz, 0.22, 0.22, 31, M.pipe, false);
  addWarning(group, cx, 3.48, cz - 7);
}

function buildStorage(group, cx, cz, openings, seed) {
  addSectorShell(group, cx, cz, openings);
  addCeilingGrid(group, cx, cz, false);
  const offset = hash(seed, 6, 9) > 0.5 ? 1 : -1;
  const positions = [[-15, -14], [-15, 0], [-15, 14], [15, -14], [15, 0], [15, 14]];
  for (let i = 0; i < positions.length; i++) {
    const [x, z] = positions[i];
    const h = 2.2 + hash(seed, i, 3) * 1.4;
    addBox(group, cx + x + offset * (i % 2), h / 2, cz + z, 6.5, h, 7.5, i % 2 ? M.wood : M.metal, true);
  }
  addWarning(group, cx, 3.48, cz);
}

function buildTunnel(group, cx, cz, openings) {
  addSectorShell(group, cx, cz, openings, { noCeiling: true });
  addBox(group, cx, 3.15, cz, SECTOR, 0.22, SECTOR, M.wallDark, false);
  const corridor = 11;
  const wing = (SECTOR - corridor) / 2;
  addBox(group, cx - (corridor + wing) / 2, 1.55, cz - 12, wing, 3.1, 0.28, M.wallDark, true);
  addBox(group, cx - (corridor + wing) / 2, 1.55, cz + 12, wing, 3.1, 0.28, M.wallDark, true);
  addBox(group, cx + (corridor + wing) / 2, 1.55, cz - 12, wing, 3.1, 0.28, M.wallDark, true);
  addBox(group, cx + (corridor + wing) / 2, 1.55, cz + 12, wing, 3.1, 0.28, M.wallDark, true);
  for (let q = -16; q <= 16; q += 8) {
    addLightPanel(group, cx, 3.02, cz + q, 2.0, 0.34, false);
    addLightPanel(group, cx + q, 3.02, cz, 0.34, 2.0, false);
  }
  addBox(group, cx - 5.2, 2.65, cz, 0.18, 0.18, 38, M.pipe, false);
  addWarning(group, cx, 2.72, cz + 7);
}

function buildSunlit(group, cx, cz, openings) {
  addSectorShell(group, cx, cz, openings, { floorMat: M.floorLight, ceilingMat: M.ceilingLight });
  addWindowWall(group, cx, 0, cz - 20.5, 35, 'x', true);
  addWindowWall(group, cx, 0, cz + 20.5, 35, 'x', true);
  addApartment(group, { x: cx - 15.5, z: cz, w: 12, d: 14, doorSide: 'east', bright: true, windowSide: 'west' });
  addApartment(group, { x: cx + 15.5, z: cz, w: 12, d: 14, doorSide: 'west', bright: true, windowSide: 'east' });
  for (let x = -8; x <= 8; x += 8) addLightPanel(group, cx + x, 4.0, cz, 3.2, 0.75, true);
  const light = new THREE.PointLight(0xffdfaa, 0.85, 38, 1.6);
  light.position.set(cx, 3.4, cz);
  group.add(light);
  addWarning(group, cx, 3.48, cz + 7);
}

function buildStairwell(group, cx, cz, openings) {
  addSectorShell(group, cx, cz, openings, { noCeiling: true });
  addBox(group, cx, WALL_HEIGHT + 0.12, cz - 10, SECTOR, 0.24, 28, M.ceiling, false);
  addBox(group, cx + 15, WALL_HEIGHT + 0.12, cz + 13, 18, 0.24, 18, M.ceiling, false);

  const ramp = { minX: cx - 18, maxX: cx - 2, minZ: cz + 7, maxZ: cz + 13, floor0: 0, floor1: 4.4, axis: 'x' };
  ramps.push(ramp);
  group.userData.ramps.push(ramp);

  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    addBox(group, ramp.minX + (ramp.maxX - ramp.minX) * t, 0.12 + 4.4 * t, cz + 10, 0.82, 0.24, 5.4, M.metal, false);
  }
  addBox(group, cx - 10, 2.3, cz + 6.9, 16.8, 0.22, 0.22, M.metal, false);
  addBox(group, cx - 10, 2.3, cz + 13.1, 16.8, 0.22, 0.22, M.metal, false);

  const upperFloor = 4.4;
  addBox(group, cx + 9, upperFloor - 0.1, cz + 10, 22, 0.2, 18, M.floorLight, false);
  addBox(group, cx + 9, upperFloor + 4.3, cz + 10, 22, 0.2, 18, M.ceilingLight, false);
  const upperZone = { minX: cx - 2.5, maxX: cx + 20.2, minZ: cz + 1, maxZ: cz + 19.2, floor: upperFloor };
  upperZones.push(upperZone);
  group.userData.upperZones.push(upperZone);

  addBox(group, cx + 20.2, upperFloor + 2.1, cz + 10, 0.25, 4.2, 18, M.wallWarm, true);
  addWindowWall(group, cx + 9, upperFloor, cz + 19.1, 22, 'x', true);
  addBox(group, cx - 2.4, upperFloor + 3.55, cz + 10, 0.25, 1.3, 18, M.wallWarm, true);
  addBox(group, cx - 2.4, upperFloor + 2.1, cz + 2.1, 0.25, 4.2, 2.3, M.wallWarm, true);
  addBox(group, cx - 2.4, upperFloor + 2.1, cz + 17.9, 0.25, 4.2, 2.3, M.wallWarm, true);

  addApartment(group, { x: cx + 3, z: cz + 5.2, w: 8.5, d: 7.4, floor: upperFloor, doorSide: 'south', bright: true, windowSide: 'north' });
  addApartment(group, { x: cx + 12.5, z: cz + 5.2, w: 8.5, d: 7.4, floor: upperFloor, doorSide: 'south', bright: true, windowSide: 'north' });
  addApartment(group, { x: cx + 17, z: cz + 13.2, w: 6.2, d: 8.5, floor: upperFloor, doorSide: 'west', bright: true, windowSide: 'east' });

  for (let x = 1; x <= 17; x += 5.3) addLightPanel(group, cx + x, upperFloor + 4.18, cz + 14.5, 2.6, 0.65, true);
  const light = new THREE.PointLight(0xffdfaa, 1.12, 36, 1.5);
  light.position.set(cx + 9, upperFloor + 2.8, cz + 13);
  group.add(light);

  addWarning(group, cx, 3.48, cz - 6);
  addWarning(group, cx + 9, upperFloor + 3.5, cz + 15);
}

function sectorType(gx, gz) {
  if (gx === 0 && gz === 0) return 'START HUB';
  // A known nearby stairwell guarantees that the bright upper apartments are
  // discoverable without turning the rest of the endless map into a tutorial.
  if (gx === 0 && gz === -2) return 'STAIRWELL';
  const r = hash(gx, gz, 27);
  if (r < 0.27) return 'RESIDENTIAL';
  if (r < 0.40) return 'ATRIUM';
  if (r < 0.54) return 'SERVICE PLANT';
  if (r < 0.66) return 'STORAGE HALL';
  if (r < 0.77) return 'SUNLIT GALLERY';
  if (r < 0.90) return 'STAIRWELL';
  return 'TRANSIT TUNNEL';
}

function addCity(group, gx, gz, cx, cz) {
  for (let i = 0; i < 5; i++) {
    const r = hash(gx * 17 + i, gz * 13 - i, 91);
    const side = i % 2 ? -1 : 1;
    const x = cx + side * (38 + i * 10);
    const z = cz + (r - 0.5) * 70;
    const h = 24 + Math.floor(r * 9) * 6;
    addBox(group, x, h / 2 - 1, z, 11 + (i % 3) * 4, h, 12 + (i % 2) * 5, i % 2 ? M.city : M.city2, false);
  }
}

function buildSector(gx, gz) {
  const key = sectorId(gx, gz);
  if (sectors.has(key)) return;
  const group = new THREE.Group();
  group.userData = { gx, gz, type: sectorType(gx, gz), colliders: [], doors: [], shelters: [], warnings: [], ramps: [], upperZones: [] };
  const cx = gx * SECTOR;
  const cz = gz * SECTOR;
  const openings = {
    n: edgeOpen(gx, gz, 'N'), s: edgeOpen(gx, gz, 'S'),
    e: edgeOpen(gx, gz, 'E'), w: edgeOpen(gx, gz, 'W')
  };

  switch (group.userData.type) {
    case 'START HUB': buildHub(group, cx, cz, openings); break;
    case 'RESIDENTIAL': buildResidential(group, cx, cz, openings, gx * 97 + gz * 53); break;
    case 'ATRIUM': buildAtrium(group, cx, cz, openings); break;
    case 'SERVICE PLANT': buildService(group, cx, cz, openings, gx * 71 + gz * 37); break;
    case 'STORAGE HALL': buildStorage(group, cx, cz, openings, gx * 43 + gz * 89); break;
    case 'SUNLIT GALLERY': buildSunlit(group, cx, cz, openings); break;
    case 'STAIRWELL': buildStairwell(group, cx, cz, openings); break;
    default: buildTunnel(group, cx, cz, openings); break;
  }

  addCity(group, gx, gz, cx, cz);
  scene.add(group);
  sectors.set(key, group);
}

function removeFrom(list, item) {
  const at = list.indexOf(item);
  if (at >= 0) list.splice(at, 1);
}

function removeSector(key) {
  const group = sectors.get(key);
  if (!group) return;
  for (const door of group.userData.doors) {
    removeFrom(doors, door);
    removeFrom(interactables, door.slab);
  }
  for (const room of group.userData.shelters) removeFrom(shelters, room);
  for (const collider of group.userData.colliders) removeFrom(colliders, collider);
  for (const warning of group.userData.warnings) removeFrom(warnings, warning);
  for (const ramp of group.userData.ramps) removeFrom(ramps, ramp);
  for (const zone of group.userData.upperZones) removeFrom(upperZones, zone);
  scene.remove(group);
  sectors.delete(key);
}

function queueSector(gx, gz, urgent = false) {
  const key = sectorId(gx, gz);
  if (sectors.has(key) || queued.has(key)) return;
  queued.add(key);
  const item = { gx, gz, key };
  if (urgent) buildQueue.unshift(item); else buildQueue.push(item);
}

let streamGX = Number.NaN;
let streamGZ = Number.NaN;
function stream(force = false) {
  const gx = Math.floor((player.pos.x + SECTOR / 2) / SECTOR);
  const gz = Math.floor((player.pos.z + SECTOR / 2) / SECTOR);
  if (!force && gx === streamGX && gz === streamGZ) return;
  streamGX = gx;
  streamGZ = gz;

  const desired = [];
  for (let x = gx - LOAD_RADIUS; x <= gx + LOAD_RADIUS; x++) for (let z = gz - LOAD_RADIUS; z <= gz + LOAD_RADIUS; z++) {
    desired.push({ gx: x, gz: z, distance: Math.abs(x - gx) + Math.abs(z - gz) });
  }
  desired.sort((a, b) => a.distance - b.distance);
  for (const item of desired) queueSector(item.gx, item.gz, item.distance === 0);

  for (const [key, group] of sectors) {
    if (Math.abs(group.userData.gx - gx) > UNLOAD_RADIUS || Math.abs(group.userData.gz - gz) > UNLOAD_RADIUS) removeSector(key);
  }
}

function buildNextSector() {
  while (buildQueue.length) {
    const item = buildQueue.shift();
    queued.delete(item.key);
    if (Math.abs(item.gx - streamGX) > LOAD_RADIUS || Math.abs(item.gz - streamGZ) > LOAD_RADIUS) continue;
    buildSector(item.gx, item.gz);
    return;
  }
}

const player = {
  pos: new THREE.Vector3(0, 1.68, 8), yaw: Math.PI, pitch: 0,
  radius: 0.38, height: 1.72, floor: 0, exposure: 0
};

function floorAt(x, z, currentFloor) {
  for (const ramp of ramps) {
    if (x < ramp.minX || x > ramp.maxX || z < ramp.minZ || z > ramp.maxZ) continue;
    const t = (x - ramp.minX) / (ramp.maxX - ramp.minX);
    return ramp.floor0 + THREE.MathUtils.clamp(t, 0, 1) * (ramp.floor1 - ramp.floor0);
  }
  if (currentFloor > 2.2) {
    for (const zone of upperZones) {
      if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) return zone.floor;
    }
    return null;
  }
  return 0;
}

function colliderOverlapsPlayer(collider, x, z, floor) {
  if (!collider.enabled) return false;
  const minY = floor + 0.05;
  const maxY = floor + player.height;
  if (maxY <= collider.minY || minY >= collider.maxY) return false;
  return x + player.radius > collider.minX && x - player.radius < collider.maxX && z + player.radius > collider.minZ && z - player.radius < collider.maxZ;
}

function overlapDepth(collider, x, z) {
  return Math.min(
    x + player.radius - collider.minX,
    collider.maxX - (x - player.radius),
    z + player.radius - collider.minZ,
    collider.maxZ - (z - player.radius)
  );
}

function blockedAt(x, z, floor, fromX = player.pos.x, fromZ = player.pos.z, fromFloor = player.floor) {
  for (const collider of colliders) {
    if (!colliderOverlapsPlayer(collider, x, z, floor)) continue;

    // If a streamed object ever appears around the player, permit motion that
    // reduces the overlap. New collisions still stop completely.
    if (
      colliderOverlapsPlayer(collider, fromX, fromZ, fromFloor) &&
      overlapDepth(collider, x, z) + 0.0001 < overlapDepth(collider, fromX, fromZ)
    ) continue;

    return true;
  }
  return false;
}

function placeAtSafeSpawn() {
  const candidates = [[0, 8], [0, 0], [0, -8], [8, 0], [-8, 0]];
  for (const [x, z] of candidates) {
    if (blockedAt(x, z, 0, x, z, 0)) continue;
    player.pos.set(x, 1.68, z);
    player.floor = 0;
    return;
  }
  throw new Error('The starting sector contains no clear spawn point.');
}

function movePlayer(dx, dz) {
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / 0.12));
  const stepX = dx / steps;
  const stepZ = dz / steps;

  for (let i = 0; i < steps; i++) {
    const fromX = player.pos.x;
    const fromZ = player.pos.z;
    const fromFloor = player.floor;
    const nextFloorX = floorAt(fromX + stepX, fromZ, fromFloor);
    if (
      nextFloorX !== null &&
      !blockedAt(fromX + stepX, fromZ, nextFloorX, fromX, fromZ, fromFloor)
    ) {
      player.pos.x = fromX + stepX;
      player.floor = nextFloorX;
    }

    const nextFloorZ = floorAt(player.pos.x, fromZ + stepZ, player.floor);
    if (
      nextFloorZ !== null &&
      !blockedAt(player.pos.x, fromZ + stepZ, nextFloorZ, player.pos.x, fromZ, player.floor)
    ) {
      player.pos.z = fromZ + stepZ;
      player.floor = nextFloorZ;
    }
  }
  player.pos.y = player.floor + 1.68;
}

const ray = new THREE.Raycaster();
let aimed = null;
let started = false;
let lampOn = true;

function updateAim() {
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = ray.intersectObjects(interactables, false).find((entry) => entry.distance < 3.6);
  aimed = hit?.object || null;
  ui.prompt.style.display = aimed ? 'block' : 'none';
  if (aimed) ui.prompt.textContent = `[ USE ] ${aimed.userData.door.open ? 'CLOSE' : 'OPEN'} DOOR`;
}

function use() {
  updateAim();
  if (!aimed) return;
  const door = aimed.userData.door;
  door.open = !door.open;
  door.pivot.rotation.y = door.open * (door.axis === 'x' ? -1.5 * door.direction : 1.5 * door.direction);
  door.collider.enabled = !door.open;
}

function toggleLamp() {
  lampOn = !lampOn;
  flashlight.visible = lampOn;
  ui.lamp.textContent = lampOn ? 'LAMP' : 'LAMP OFF';
}

function safe() {
  return shelters.some((room) =>
    Math.abs(room.floor - player.floor) < 0.8 &&
    player.pos.x > room.minX && player.pos.x < room.maxX &&
    player.pos.z > room.minZ && player.pos.z < room.maxZ &&
    !room.door.open
  );
}

let audioContext = null;
let oscillator = null;
let alarmGain = null;
function alarmOn() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  if (oscillator) return;
  oscillator = audioContext.createOscillator();
  alarmGain = audioContext.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = 420;
  alarmGain.gain.value = 0.03;
  oscillator.connect(alarmGain).connect(audioContext.destination);
  oscillator.start();
}
function alarmOff() {
  if (!oscillator) return;
  oscillator.stop();
  oscillator = null;
  alarmGain = null;
}

const event = { state: 'normal', timer: 100 + hash(Date.now(), 4, 8) * 90, cycle: 0 };
function setEvent(state, duration) {
  event.state = state;
  event.timer = duration;
  if (state === 'warning' || state === 'active') alarmOn(); else alarmOff();
}
function showMessage(text) {
  ui.message.textContent = text;
  ui.message.style.display = 'block';
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => { ui.message.style.display = 'none'; }, 2500);
}
function relocate() {
  const gx = Math.floor((player.pos.x + SECTOR / 2) / SECTOR);
  const gz = Math.floor((player.pos.z + SECTOR / 2) / SECTOR);
  player.pos.set(gx * SECTOR, 1.68, gz * SECTOR);
  player.floor = 0;
  player.exposure = 0;
  showMessage('EXPOSURE DETECTED — EMERGENCY RELOCATION');
}
function updateEvent(dt, now) {
  event.timer -= dt;
  if (event.state === 'normal' && event.timer <= 0) setEvent('warning', 22);
  else if (event.state === 'warning' && event.timer <= 0) setEvent('active', 20);
  else if (event.state === 'active' && event.timer <= 0) { event.cycle++; setEvent('clear', 8); }
  else if (event.state === 'clear' && event.timer <= 0) setEvent('normal', 180 + hash(event.cycle, 43) * 240);

  const flash = (event.state === 'warning' || event.state === 'active') && Math.floor(now / 260) % 2 === 0;
  for (const warning of warnings) warning.material = flash ? M.lamp : M.red;

  if (event.state === 'warning') {
    ui.alarm.style.display = 'block';
    ui.alarm.textContent = `САМОСБОР WARNING — SEEK SHELTER ${Math.ceil(event.timer)}s`;
    ui.objective.textContent = 'ENTER AN APARTMENT AND CLOSE THE DOOR';
  } else if (event.state === 'active') {
    const sealed = safe();
    ui.alarm.style.display = 'block';
    ui.alarm.textContent = sealed ? 'САМОСБОР ACTIVE — SHELTER SEALED' : 'САМОСБОР ACTIVE — EXPOSED';
    ui.objective.textContent = sealed ? 'WAIT FOR THE ALL-CLEAR' : 'GET BEHIND A CLOSED DOOR';
    if (!sealed) {
      player.exposure += dt;
      ui.damage.style.opacity = Math.min(1, player.exposure / 1.5);
      if (player.exposure > 3.2) relocate();
    } else {
      player.exposure = Math.max(0, player.exposure - dt * 2);
      ui.damage.style.opacity = 0;
    }
  } else if (event.state === 'clear') {
    ui.alarm.style.display = 'block';
    ui.alarm.textContent = 'ALL CLEAR — CORRIDORS SAFE';
    ui.objective.textContent = 'CONTINUE THROUGH THE COMBINE';
    ui.damage.style.opacity = 0;
  } else {
    ui.alarm.style.display = 'none';
    ui.objective.textContent = 'EXPLORE THE ENDLESS RESIDENTIAL COMBINE';
    ui.damage.style.opacity = 0;
  }

  if (oscillator) {
    oscillator.frequency.value = flash ? 510 : 390;
    alarmGain.gain.value = event.state === 'active' ? 0.05 : 0.03;
  }
}

function currentSector() {
  const gx = Math.floor((player.pos.x + SECTOR / 2) / SECTOR);
  const gz = Math.floor((player.pos.z + SECTOR / 2) / SECTOR);
  return sectors.get(sectorId(gx, gz));
}

function updateAtmosphere(dt) {
  const type = currentSector()?.userData.type || 'START HUB';
  let hemiTarget = 1.0;
  let sunTarget = 0.95;
  let darkMix = 0;
  if (type === 'TRANSIT TUNNEL') { hemiTarget = 0.3; sunTarget = 0.04; darkMix = 0.88; }
  else if (type === 'SERVICE PLANT') { hemiTarget = 0.55; sunTarget = 0.2; darkMix = 0.42; }
  else if (type === 'SUNLIT GALLERY' || type === 'STAIRWELL' || type === 'ATRIUM') { hemiTarget = 1.28; sunTarget = 1.35; darkMix = 0; }
  hemisphere.intensity = THREE.MathUtils.damp(hemisphere.intensity, hemiTarget, 3.0, dt);
  sun.intensity = THREE.MathUtils.damp(sun.intensity, sunTarget, 3.0, dt);
  const target = SKY.clone().lerp(NIGHT, darkMix);
  scene.background.lerp(target, 1 - Math.exp(-dt * 2.4));
  scene.fog.color.copy(scene.background);
}

function updateHud() {
  const gx = Math.floor((player.pos.x + SECTOR / 2) / SECTOR);
  const gz = Math.floor((player.pos.z + SECTOR / 2) / SECTOR);
  const type = sectors.get(sectorId(gx, gz))?.userData.type || 'LOADING';
  const level = player.floor > 2.2 ? 'UPPER LEVEL' : 'LOWER LEVEL';
  ui.zone.textContent = `${type} — ${level} — SECTOR ${gx},${gz}`;
  ui.status.innerHTML = `LAMP: ${lampOn ? 'ON' : 'OFF'}<br>EVENT: ${event.state.toUpperCase()}<br>MAP: LARGE STREAMING`;
}

let joyX = 0;
let joyY = 0;
let joyId = null;
let lookId = null;
let lookX = 0;
let lookY = 0;
const keys = {};

function moveStick(touch) {
  const rect = ui.joy.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = touch.clientX - cx;
  const dy = touch.clientY - cy;
  const length = Math.hypot(dx, dy) || 1;
  const max = rect.width * 0.34;
  const amount = Math.min(max, length);
  joyX = dx / length * amount / max;
  joyY = dy / length * amount / max;
  ui.stick.style.transform = `translate(${dx / length * amount}px,${dy / length * amount}px)`;
}
function resetStick() {
  joyX = 0;
  joyY = 0;
  joyId = null;
  ui.stick.style.transform = 'translate(0,0)';
}

addEventListener('touchstart', (eventTouch) => {
  if (!started) return;
  eventTouch.preventDefault();
  for (const touch of eventTouch.changedTouches) {
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element?.closest('#buttons')) continue;
    if (touch.clientX < innerWidth * 0.5 && joyId === null) {
      joyId = touch.identifier;
      moveStick(touch);
    } else if (lookId === null) {
      lookId = touch.identifier;
      lookX = touch.clientX;
      lookY = touch.clientY;
    }
  }
}, { passive: false });
addEventListener('touchmove', (eventTouch) => {
  if (!started) return;
  eventTouch.preventDefault();
  for (const touch of eventTouch.changedTouches) {
    if (touch.identifier === joyId) moveStick(touch);
    if (touch.identifier === lookId) {
      const dx = touch.clientX - lookX;
      const dy = touch.clientY - lookY;
      lookX = touch.clientX;
      lookY = touch.clientY;
      player.yaw -= dx * 0.0037;
      player.pitch = THREE.MathUtils.clamp(player.pitch + dy * 0.003, -1.05, 0.78);
    }
  }
}, { passive: false });
addEventListener('touchend', (eventTouch) => {
  for (const touch of eventTouch.changedTouches) {
    if (touch.identifier === joyId) resetStick();
    if (touch.identifier === lookId) lookId = null;
  }
});
addEventListener('touchcancel', () => { resetStick(); lookId = null; });

renderer.domElement.addEventListener('click', () => {
  if (started && matchMedia('(pointer:fine)').matches && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
});
addEventListener('mousemove', (eventMouse) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= eventMouse.movementX * 0.0024;
  player.pitch = THREE.MathUtils.clamp(player.pitch + eventMouse.movementY * 0.0022, -1.05, 0.78);
});

function bind(element, action) {
  element.addEventListener('pointerdown', (eventPointer) => {
    eventPointer.preventDefault();
    eventPointer.stopPropagation();
    action();
  });
}
bind(ui.use, use);
bind(ui.lamp, toggleLamp);

addEventListener('keydown', (eventKey) => {
  keys[eventKey.code] = true;
  if (eventKey.code === 'KeyE') use();
  if (eventKey.code === 'KeyF') toggleLamp();
});
addEventListener('keyup', (eventKey) => { keys[eventKey.code] = false; });
addEventListener('blur', () => {
  resetStick();
  lookId = null;
  for (const key of Object.keys(keys)) keys[key] = false;
});

export function getGameState() {
  return {
    started,
    x: player.pos.x,
    y: player.pos.y,
    z: player.pos.z,
    floor: player.floor,
    sectorCount: sectors.size
  };
}

export function startGame() {
  if (started) return getGameState();
  started = true;
  ui.start.style.display = 'none';
  stream(true);
  if (audioContext) audioContext.resume();
  renderer.domElement.focus?.();
  return getGameState();
}

buildSector(0, 0);
placeAtSafeSpawn();
stream(true);
camera.position.copy(player.pos);
camera.rotation.set(player.pitch, player.yaw, 0);
document.documentElement.dataset.samosborReady = 'true';

let last = performance.now();
let hudTick = 0;
let aimTick = 0;
let qualityStart = last;
let qualityFrames = 0;

function updateQuality(now) {
  qualityFrames++;
  const elapsed = now - qualityStart;
  if (elapsed < 2400) return;
  const fps = qualityFrames * 1000 / elapsed;
  qualityFrames = 0;
  qualityStart = now;
  let next = renderScale;
  if (fps < 38) next = Math.max(0.58, renderScale - 0.08);
  else if (fps > 57) next = Math.min(0.96, renderScale + 0.03);
  if (Math.abs(next - renderScale) > 0.001) {
    renderScale = next;
    resizeRenderer();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  buildNextSector();

  if (started) {
    let forward = -joyY + (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    let strafe = joyX + (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const magnitude = Math.hypot(forward, strafe);
    if (magnitude > 1) { forward /= magnitude; strafe /= magnitude; }

    const speed = 6.25;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    const dx = (strafe * cos - forward * sin) * speed * dt;
    const dz = (-strafe * sin - forward * cos) * speed * dt;
    movePlayer(dx, dz);

    camera.position.copy(player.pos);
    camera.rotation.set(player.pitch, player.yaw, 0);
    stream();
    if (now - aimTick > 85) { updateAim(); aimTick = now; }
    updateEvent(dt, now);
    updateAtmosphere(dt);
    if (now - hudTick > 250) { updateHud(); hudTick = now; }
  }

  updateQuality(now);
  renderer.render(scene, camera);
}
frame(last);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  resizeRenderer();
});


