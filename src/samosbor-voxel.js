import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const ui = {
  start: $('startScreen'), startBtn: $('startBtn'), zone: $('zone'), objective: $('objective'),
  status: $('topRight'), alarm: $('alarm'), prompt: $('prompt'), damage: $('damage'),
  joy: $('joystick'), stick: $('stick'), lamp: $('lampBtn'), use: $('useBtn')
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc8dc);
scene.fog = new THREE.Fog(0x9fc8dc, 28, 90);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 120);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdceaf0, 0x252821, 1.25));
const sun = new THREE.DirectionalLight(0xffe5bd, 1.1); sun.position.set(-20, 35, -15); scene.add(sun);

const flashlight = new THREE.SpotLight(0xf6fff2, 8, 24, 0.52, 0.55, 1.1);
flashlight.position.set(0, 0.05, 0.05); flashlight.target.position.set(0, -0.05, -3);
camera.add(flashlight, flashlight.target); scene.add(camera);

const CHUNK = 16, HEIGHT = 5, VIEW = 2;
const chunks = new Map();
const mats = [
  null,
  new THREE.MeshLambertMaterial({ color: 0x666b63, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x3f443e, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x51574f, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x73553c, flatShading: true })
];

function hash(x, z, s = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
function key(x, z) { return `${x},${z}`; }
function idx(x, y, z) { return x + CHUNK * (z + CHUNK * y); }
function voxel(data, x, y, z) {
  if (x < 0 || z < 0 || y < 0 || x >= CHUNK || z >= CHUNK || y >= HEIGHT) return 0;
  return data[idx(x, y, z)];
}

function makeData(cx, cz) {
  const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
    data[idx(x, 0, z)] = 2;
    data[idx(x, HEIGHT - 1, z)] = 3;
    const gx = cx * CHUNK + x, gz = cz * CHUNK + z;
    const mainX = Math.abs(((gx % 24) + 24) % 24 - 12) <= 2;
    const mainZ = Math.abs(((gz % 24) + 24) % 24 - 12) <= 2;
    const hall = mainX || mainZ;
    if (!hall) {
      for (let y = 1; y < HEIGHT - 1; y++) data[idx(x, y, z)] = 1;
    }
  }

  // Cut deterministic apartment alcoves into the solid mass beside corridors.
  const seed = hash(cx, cz, 9);
  const side = seed > 0.5 ? 1 : -1;
  const doorX = 8, doorZ = side > 0 ? 14 : 1;
  for (let z = side > 0 ? 11 : 1; z <= (side > 0 ? 14 : 4); z++) {
    for (let x = 5; x <= 11; x++) for (let y = 1; y < HEIGHT - 1; y++) data[idx(x, y, z)] = 0;
  }
  for (let y = 1; y <= 2; y++) data[idx(doorX, y, doorZ)] = 0;
  return data;
}

const faces = [
  { d:[ 1,0,0], c:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { d:[-1,0,0], c:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { d:[0, 1,0], c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { d:[0,-1,0], c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { d:[0,0, 1], c:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { d:[0,0,-1], c:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }
];

function meshData(data, materialId) {
  const pos = [], nor = [], ind = [];
  let v = 0;
  for (let y = 0; y < HEIGHT; y++) for (let z = 0; z < CHUNK; z++) for (let x = 0; x < CHUNK; x++) {
    if (voxel(data, x, y, z) !== materialId) continue;
    for (const f of faces) {
      if (voxel(data, x + f.d[0], y + f.d[1], z + f.d[2]) !== 0) continue;
      for (const c of f.c) { pos.push(x+c[0], y+c[1], z+c[2]); nor.push(...f.d); }
      ind.push(v,v+1,v+2, v,v+2,v+3); v += 4;
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(ind); g.computeBoundingSphere();
  return g;
}

function buildChunk(cx, cz) {
  const data = makeData(cx, cz), group = new THREE.Group();
  group.position.set(cx * CHUNK, 0, cz * CHUNK);
  for (let m = 1; m <= 3; m++) {
    const geo = meshData(data, m);
    if (geo) group.add(new THREE.Mesh(geo, mats[m]));
  }
  scene.add(group); chunks.set(key(cx, cz), { cx, cz, data, group });
}
function stream() {
  const cx = Math.floor(player.x / CHUNK), cz = Math.floor(player.z / CHUNK);
  for (let x = cx - VIEW; x <= cx + VIEW; x++) for (let z = cz - VIEW; z <= cz + VIEW; z++) {
    if (!chunks.has(key(x,z))) buildChunk(x,z);
  }
  for (const [k,c] of [...chunks]) if (Math.abs(c.cx-cx)>VIEW+1 || Math.abs(c.cz-cz)>VIEW+1) {
    scene.remove(c.group); c.group.traverse(o=>o.geometry?.dispose()); chunks.delete(k);
  }
}
function solidAt(x, y, z) {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const c = chunks.get(key(cx,cz)); if (!c) return false;
  const lx = Math.floor(x - cx*CHUNK), lz = Math.floor(z - cz*CHUNK);
  return voxel(c.data, lx, Math.floor(y), lz) !== 0;
}

const player = { x: 12, y: 1.65, z: 12, yaw: Math.PI, pitch: 0, radius: 0.28 };
function blocked(x,z) {
  const r=player.radius;
  return solidAt(x-r,1,z-r)||solidAt(x+r,1,z-r)||solidAt(x-r,1,z+r)||solidAt(x+r,1,z+r);
}

let started=false, joyX=0, joyY=0, joyPointer=null, lookPointer=null, lx=0, ly=0;
const keys={};
function setStick(e){
  const r=ui.joy.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
  const dx=e.clientX-cx, dy=e.clientY-cy, max=r.width*.34, len=Math.hypot(dx,dy)||1, m=Math.min(max,len);
  joyX=dx/len*m/max; joyY=dy/len*m/max;
  ui.stick.style.transform=`translate(${dx/len*m}px,${dy/len*m}px)`;
}
function releaseStick(){ joyX=joyY=0; joyPointer=null; ui.stick.style.transform='translate(0,0)'; }

ui.joy.addEventListener('pointerdown',e=>{ if(!started)return; e.preventDefault(); joyPointer=e.pointerId; ui.joy.setPointerCapture(e.pointerId); setStick(e); });
ui.joy.addEventListener('pointermove',e=>{ if(e.pointerId===joyPointer)setStick(e); });
ui.joy.addEventListener('pointerup',e=>{ if(e.pointerId===joyPointer)releaseStick(); });
ui.joy.addEventListener('pointercancel',releaseStick);
renderer.domElement.addEventListener('pointerdown',e=>{ if(!started||e.clientX<innerWidth*.44)return; lookPointer=e.pointerId; lx=e.clientX; ly=e.clientY; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove',e=>{ if(e.pointerId!==lookPointer)return; const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;player.yaw-=dx*.004;player.pitch=THREE.MathUtils.clamp(player.pitch+dy*.003,-1.05,.75); });
renderer.domElement.addEventListener('pointerup',e=>{if(e.pointerId===lookPointer)lookPointer=null;});
addEventListener('keydown',e=>keys[e.code]=true); addEventListener('keyup',e=>keys[e.code]=false);

let lampOn=true; ui.lamp.onclick=()=>{lampOn=!lampOn;flashlight.visible=lampOn;ui.lamp.textContent=lampOn?'LAMP':'LAMP OFF';};
ui.use.onclick=()=>{};
ui.startBtn.onclick=()=>{started=true;ui.start.style.display='none';};

stream();
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame); const dt=Math.min(.05,(now-last)/1000); last=now;
  if(started){
    let f=-joyY+(keys.KeyW?1:0)-(keys.KeyS?1:0), s=joyX+(keys.KeyD?1:0)-(keys.KeyA?1:0);
    const n=Math.hypot(f,s); if(n>1){f/=n;s/=n;}
    const speed=5.2, sn=Math.sin(player.yaw), cs=Math.cos(player.yaw);
    const dx=(s*cs-f*sn)*speed*dt, dz=(-s*sn-f*cs)*speed*dt;
    if(!blocked(player.x+dx,player.z))player.x+=dx;
    if(!blocked(player.x,player.z+dz))player.z+=dz;
    stream();
    camera.position.set(player.x,player.y,player.z); camera.rotation.set(player.pitch,player.yaw,0);
    const cx=Math.floor(player.x/CHUNK),cz=Math.floor(player.z/CHUNK);
    ui.zone.textContent=`VOXEL COMBINE — CHUNK ${cx},${cz}`;
    ui.status.innerHTML=`X ${player.x.toFixed(1)} Z ${player.z.toFixed(1)}<br>CHUNKS ${chunks.size}<br>INPUT ${f.toFixed(2)}, ${s.toFixed(2)}`;
    ui.objective.textContent='EXPLORE THE STREAMING RESIDENTIAL COMBINE';
  }
  renderer.render(scene,camera);
}
frame(last);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
