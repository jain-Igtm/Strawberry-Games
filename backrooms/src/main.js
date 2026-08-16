import * as THREE from 'three';

const CELL = 4;
const GRID = 12;
const CHUNK = CELL * GRID;
const WALL_H = 3.25;
const EYE_H = 1.67;
const LOAD_RADIUS = 2;
const KEEP_DATA = 180;
const PLAYER_RADIUS = 0.34;
const WALK_SPEED = 6.4;
const RUN_SPEED = 9.0;
const WORLD_SEED = 0x41a7f29d;

const game = document.getElementById('game');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const bootStatus = document.getElementById('bootStatus');
const hud = document.getElementById('hud');
const zoneName = document.getElementById('zoneName');
const coordsEl = document.getElementById('coords');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const lookHint = document.getElementById('lookHint');

let renderer, scene, camera, yawRig, pitchRig;
let yaw = 0, pitch = 0;
let started = false;
let lastTime = performance.now();
let lastChunkKey = '';
const renderChunks = new Map();
const dataCache = new Map();
const keys = new Set();
const motion = { x: 0, y: 0 };
let joyPointer = null;
let lookPointer = null;
let lookX = 0, lookY = 0;

const THEMES = [
  { id:'classic', name:'LEVEL 0 // YELLOW ROOMS', weight:32, wall:0xcac078, floor:0x7f7041, ceiling:0xd9d3a0, light:0xfff6bc, fog:0x9f955f, carpet:true },
  { id:'pool', name:'POOL ROOMS', weight:15, wall:0xc7e8e3, floor:0x7ed3d7, ceiling:0xe8fbf5, light:0xc8ffff, fog:0x8fc9cb, water:true },
  { id:'play', name:'PASTEL PLAYROOMS', weight:13, wall:0xf0b6c7, floor:0xb3d9c2, ceiling:0xffe6b8, light:0xffddda, fog:0xc9b1b6, slides:true },
  { id:'service', name:'SERVICE LEVEL', weight:16, wall:0x696b68, floor:0x343532, ceiling:0x4b4d48, light:0xd9d3b5, fog:0x343531, pipes:true },
  { id:'gallery', name:'LIMINAL GALLERY', weight:13, wall:0xd6d0c8, floor:0x8e887f, ceiling:0xefebe4, light:0xf7f1db, fog:0xb2aca2, tall:true },
  { id:'mint', name:'MINT HALLS', weight:11, wall:0xa9cbbb, floor:0x6f8d80, ceiling:0xd7e6dd, light:0xd8fff0, fog:0x7f9d91 }
];

function mix32(x){
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
function hash2(x,z,salt=0){
  return mix32((Math.imul(x|0, 0x1f123bb5) ^ Math.imul(z|0, 0x6c8e9cf5) ^ WORLD_SEED ^ salt) >>> 0);
}
function rand01(x,z,salt=0){ return hash2(x,z,salt) / 4294967296; }
function mulberry32(seed){ return ()=>{ let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function chunkKey(cx,cz){ return `${cx},${cz}`; }
function cellIndex(x,z){ return z*GRID+x; }

function chooseTheme(cx,cz){
  const bx=Math.floor(cx/3), bz=Math.floor(cz/3);
  let roll = rand01(bx,bz,0x9911) * 100;
  for(const t of THEMES){ if((roll-=t.weight) < 0) return t; }
  return THEMES[0];
}

function sharedGate(cx,cz,side){
  if(side==='N') return 2 + (hash2(cx,cz-1,0x1001) % (GRID-4));
  if(side==='S') return 2 + (hash2(cx,cz,0x1001) % (GRID-4));
  if(side==='W') return 2 + (hash2(cx-1,cz,0x2002) % (GRID-4));
  return 2 + (hash2(cx,cz,0x2002) % (GRID-4));
}

function carvePath(grid,x0,z0,x1,z1,rng,width=1){
  let x=x0,z=z0;
  const carve=(cx,cz)=>{ for(let dz=-width+1;dz<width;dz++)for(let dx=-width+1;dx<width;dx++){const nx=cx+dx,nz=cz+dz;if(nx>=0&&nx<GRID&&nz>=0&&nz<GRID)grid[cellIndex(nx,nz)]=1;} };
  carve(x,z);
  const horizFirst=rng()>.5;
  const stepX=()=>{ while(x!==x1){ x += Math.sign(x1-x); carve(x,z); } };
  const stepZ=()=>{ while(z!==z1){ z += Math.sign(z1-z); carve(x,z); } };
  if(horizFirst){stepX();stepZ();}else{stepZ();stepX();}
}
function carveRect(grid,x,z,w,h){
  for(let zz=z;zz<z+h;zz++) for(let xx=x;xx<x+w;xx++) if(xx>=0&&xx<GRID&&zz>=0&&zz<GRID) grid[cellIndex(xx,zz)]=1;
}

function generateChunkData(cx,cz){
  const key=chunkKey(cx,cz);
  if(dataCache.has(key)){
    const cached=dataCache.get(key); dataCache.delete(key); dataCache.set(key,cached); return cached;
  }
  const rng=mulberry32(hash2(cx,cz,0xabc123));
  const theme=chooseTheme(cx,cz);
  const grid=new Uint8Array(GRID*GRID);
  const gates={N:sharedGate(cx,cz,'N'),S:sharedGate(cx,cz,'S'),W:sharedGate(cx,cz,'W'),E:sharedGate(cx,cz,'E')};
  const center={x:Math.floor(GRID/2),z:Math.floor(GRID/2)};
  carveRect(grid,center.x-1,center.z-1,3,3);

  carvePath(grid,gates.N,0,center.x,center.z,rng,theme.id==='gallery'?2:1);
  carvePath(grid,gates.S,GRID-1,center.x,center.z,rng,1);
  carvePath(grid,0,gates.W,center.x,center.z,rng,1);
  carvePath(grid,GRID-1,gates.E,center.x,center.z,rng,1);

  const roomCount = theme.id==='pool' ? 6 : theme.id==='classic' ? 9 : 7;
  for(let i=0;i<roomCount;i++){
    let w=2+Math.floor(rng()*(theme.id==='pool'?6:4));
    let h=2+Math.floor(rng()*(theme.id==='pool'?6:4));
    const x=1+Math.floor(rng()*Math.max(1,GRID-w-2));
    const z=1+Math.floor(rng()*Math.max(1,GRID-h-2));
    carveRect(grid,x,z,w,h);
    carvePath(grid,x+Math.floor(w/2),z+Math.floor(h/2),center.x,center.z,rng,1);
  }
  if(theme.id==='classic'){
    for(let i=0;i<5;i++){
      const x=1+Math.floor(rng()*(GRID-3)), z=1+Math.floor(rng()*(GRID-3));
      carveRect(grid,x,z,2+Math.floor(rng()*3),1+Math.floor(rng()*2));
      carvePath(grid,x,z,center.x,center.z,rng,1);
    }
  }

  const data={cx,cz,key,theme,grid,gates,decorSeed:hash2(cx,cz,0x51eed)};
  dataCache.set(key,data);
  if(dataCache.size>KEEP_DATA) dataCache.delete(dataCache.keys().next().value);
  return data;
}

function floorAtWorld(x,z){
  const cx=Math.floor(x/CHUNK), cz=Math.floor(z/CHUNK);
  const lx=x-cx*CHUNK, lz=z-cz*CHUNK;
  const gx=Math.floor(lx/CELL), gz=Math.floor(lz/CELL);
  if(gx<0||gz<0||gx>=GRID||gz>=GRID) return false;
  return !!generateChunkData(cx,cz).grid[cellIndex(gx,gz)];
}
function canStand(x,z){
  const r=PLAYER_RADIUS;
  return floorAtWorld(x-r,z-r)&&floorAtWorld(x+r,z-r)&&floorAtWorld(x-r,z+r)&&floorAtWorld(x+r,z+r);
}

function makeCanvasTexture(kind,theme){
  const c=document.createElement('canvas'); c.width=c.height=128; const ctx=c.getContext('2d');
  const base=new THREE.Color(theme.wall); ctx.fillStyle=`#${base.getHexString()}`; ctx.fillRect(0,0,128,128);
  const rng=mulberry32(hash2(theme.wall,theme.floor,kind==='floor'?3:7));
  if(kind==='wall'){
    ctx.globalAlpha=.16; ctx.strokeStyle='#3a3525';
    for(let y=0;y<128;y+=16){ctx.beginPath();ctx.moveTo(0,y+rng()*3);ctx.lineTo(128,y+rng()*3);ctx.stroke();}
    for(let i=0;i<130;i++){ctx.globalAlpha=.035+rng()*.05;ctx.fillStyle=rng()>.5?'#fff':'#111';ctx.fillRect(rng()*128,rng()*128,1+rng()*2,3+rng()*10);}
  } else {
    ctx.fillStyle=`#${new THREE.Color(theme.floor).getHexString()}`;ctx.globalAlpha=1;ctx.fillRect(0,0,128,128);
    ctx.globalAlpha=.13;ctx.strokeStyle='#111';
    const step=theme.water?16:24;for(let i=0;i<=128;i+=step){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();}
    for(let i=0;i<90;i++){ctx.globalAlpha=.03+rng()*.05;ctx.fillStyle=rng()>.5?'#fff':'#000';ctx.fillRect(rng()*128,rng()*128,2+rng()*5,2+rng()*5);}
  }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=2; return tex;
}
const materialCache=new Map();
const sharedMaterials=new Set();
function themeMaterials(theme){
  if(materialCache.has(theme.id)) return materialCache.get(theme.id);
  const wallTex=makeCanvasTexture('wall',theme), floorTex=makeCanvasTexture('floor',theme);
  wallTex.repeat.set(1.5,1);floorTex.repeat.set(1,1);
  const mats={
    wall:new THREE.MeshStandardMaterial({map:wallTex,color:theme.wall,roughness:.94,metalness:0}),
    floor:new THREE.MeshStandardMaterial({map:floorTex,color:theme.floor,roughness:theme.water?.35:.96,metalness:0}),
    ceiling:new THREE.MeshStandardMaterial({color:theme.ceiling,roughness:.92}),
    panel:new THREE.MeshBasicMaterial({color:theme.light}),
    water:new THREE.MeshPhysicalMaterial({color:0x73dce8,transparent:true,opacity:.43,roughness:.08,metalness:0,transmission:.08,depthWrite:false}),
    accent:new THREE.MeshStandardMaterial({color:theme.id==='play'?0xffd353:0x9b9d99,roughness:.55})
  };
  Object.values(mats).forEach(m=>sharedMaterials.add(m));
  materialCache.set(theme.id,mats);return mats;
}

function buildChunk(data){
  const {cx,cz,grid,theme}=data; const group=new THREE.Group(); group.position.set(cx*CHUNK,0,cz*CHUNK); group.userData.theme=theme;
  const mats=themeMaterials(theme); const floors=[],ceilings=[],walls=[];
  const roomHeight=theme.tall?5.4:WALL_H;
  const wallGeoH=roomHeight;
  for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
    if(!grid[cellIndex(x,z)]) continue;
    const px=(x+.5)*CELL,pz=(z+.5)*CELL; floors.push([px,0,pz,0]); ceilings.push([px,roomHeight,pz,0]);
    const neighbor=(nx,nz)=> nx>=0&&nz>=0&&nx<GRID&&nz<GRID ? grid[cellIndex(nx,nz)] : boundaryOpen(data,x,z,nx,nz);
    if(!neighbor(x,z-1)) walls.push([px,wallGeoH/2,pz-CELL/2,0]);
    if(!neighbor(x,z+1)) walls.push([px,wallGeoH/2,pz+CELL/2,0]);
    if(!neighbor(x-1,z)) walls.push([px-CELL/2,wallGeoH/2,pz,Math.PI/2]);
    if(!neighbor(x+1,z)) walls.push([px+CELL/2,wallGeoH/2,pz,Math.PI/2]);
  }
  const floorGeo=new THREE.BoxGeometry(CELL,.12,CELL); const ceilGeo=new THREE.BoxGeometry(CELL,.1,CELL); const wallGeo=new THREE.BoxGeometry(CELL+.06,wallGeoH,.14);
  addInstances(group,floorGeo,mats.floor,floors); addInstances(group,ceilGeo,mats.ceiling,ceilings); addInstances(group,wallGeo,mats.wall,walls);

  const rng=mulberry32(data.decorSeed); const panels=[];
  for(let z=1;z<GRID-1;z+=2)for(let x=1;x<GRID-1;x+=2){if(grid[cellIndex(x,z)]&&rng()>.36) panels.push([(x+.5)*CELL,roomHeight-.08,(z+.5)*CELL,rng()>.5?0:Math.PI/2]);}
  addInstances(group,new THREE.BoxGeometry(2.25,.045,.34),mats.panel,panels);

  if(theme.water) addPoolDetails(group,data,mats,rng,roomHeight);
  if(theme.slides) addPlayDetails(group,data,mats,rng,roomHeight);
  if(theme.pipes) addServiceDetails(group,data,mats,rng,roomHeight);
  scene.add(group); return group;
}
function boundaryOpen(data,x,z,nx,nz){
  if(nz<0) return x===data.gates.N;
  if(nz>=GRID) return x===data.gates.S;
  if(nx<0) return z===data.gates.W;
  if(nx>=GRID) return z===data.gates.E;
  return false;
}
function addInstances(group,geo,mat,items){
  if(!items.length){geo.dispose();return;}
  const mesh=new THREE.InstancedMesh(geo,mat,items.length); mesh.frustumCulled=true; const m=new THREE.Matrix4(); const q=new THREE.Quaternion(); const s=new THREE.Vector3(1,1,1); const p=new THREE.Vector3();
  items.forEach((v,i)=>{p.set(v[0],v[1],v[2]);q.setFromAxisAngle(new THREE.Vector3(0,1,0),v[3]||0);m.compose(p,q,s);mesh.setMatrixAt(i,m);});mesh.instanceMatrix.needsUpdate=true;group.add(mesh);
}
function addPoolDetails(group,data,mats,rng,roomHeight){
  const wet=[];
  for(let z=1;z<GRID-1;z++)for(let x=1;x<GRID-1;x++) if(data.grid[cellIndex(x,z)]&&rng()>.58) wet.push([(x+.5)*CELL,.11,(z+.5)*CELL,0]);
  addInstances(group,new THREE.PlaneGeometry(CELL*.94,CELL*.94).rotateX(-Math.PI/2),mats.water,wet);
  if(rng()>.45){
    const colMat=new THREE.MeshStandardMaterial({color:0xe5f5ef,roughness:.7});
    const cols=[];for(let i=0;i<4;i++) cols.push([CELL*(3+i*2),roomHeight/2,CELL*(3+(i%2)*4),0]);
    addInstances(group,new THREE.CylinderGeometry(.38,.38,roomHeight,12),colMat,cols);
  }
}
function addPlayDetails(group,data,mats,rng,roomHeight){
  if(rng()>.72) return;
  const baseX=CELL*(3+Math.floor(rng()*5)), baseZ=CELL*(3+Math.floor(rng()*5));
  const points=[new THREE.Vector3(baseX,roomHeight-1.0,baseZ),new THREE.Vector3(baseX+3.2,roomHeight-1.5,baseZ+1.5),new THREE.Vector3(baseX+2.0,1.55,baseZ+4.2),new THREE.Vector3(baseX+5.4,.45,baseZ+5.8)];
  const curve=new THREE.CatmullRomCurve3(points); const geo=new THREE.TubeGeometry(curve,28,.48,10,false); const slideMat=new THREE.MeshStandardMaterial({color:rng()>.5?0xffcf4f:0xef6e9b,roughness:.42,side:THREE.DoubleSide});
  const slide=new THREE.Mesh(geo,slideMat); group.add(slide);
  const platform=new THREE.Mesh(new THREE.BoxGeometry(3.2,.25,3.2),mats.accent);platform.position.set(baseX,roomHeight-1.1,baseZ);group.add(platform);
}
function addServiceDetails(group,data,mats,rng,roomHeight){
  const pipeMat=new THREE.MeshStandardMaterial({color:0x9b8061,metalness:.45,roughness:.48});
  const pipes=[];for(let i=0;i<6;i++) if(rng()>.28) pipes.push([CELL*(1+rng()*(GRID-2)),roomHeight-.38,CELL*(1+rng()*(GRID-2)),rng()>.5?0:Math.PI/2]);
  addInstances(group,new THREE.CylinderGeometry(.11,.11,5.6,8).rotateZ(Math.PI/2),pipeMat,pipes);
}

function updateStreaming(force=false){
  const cx=Math.floor(yawRig.position.x/CHUNK), cz=Math.floor(yawRig.position.z/CHUNK); const here=chunkKey(cx,cz);
  if(!force&&here===lastChunkKey) return; lastChunkKey=here;
  const wanted=new Set();
  for(let dz=-LOAD_RADIUS;dz<=LOAD_RADIUS;dz++)for(let dx=-LOAD_RADIUS;dx<=LOAD_RADIUS;dx++){
    const k=chunkKey(cx+dx,cz+dz);wanted.add(k);if(!renderChunks.has(k))renderChunks.set(k,buildChunk(generateChunkData(cx+dx,cz+dz)));
  }
  for(const [k,g] of renderChunks){if(!wanted.has(k)){scene.remove(g);disposeChunkGroup(g);renderChunks.delete(k);}}
  const current=generateChunkData(cx,cz).theme;zoneName.textContent=current.name;
  scene.fog.color.set(current.fog);renderer.setClearColor(current.fog,1);
}
function disposeChunkGroup(group){
  group.traverse(o=>{
    if(o.geometry) o.geometry.dispose();
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats){if(m&&!sharedMaterials.has(m))m.dispose();}
  });
}

function initRenderer(){
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=false;game.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x8f875c,.027);
  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,160);
  yawRig=new THREE.Group();pitchRig=new THREE.Group();pitchRig.position.y=EYE_H;pitchRig.add(camera);yawRig.add(pitchRig);scene.add(yawRig);
  yawRig.position.set(CHUNK/2,0,CHUNK/2);
  const hemi=new THREE.HemisphereLight(0xfff7ce,0x4b493a,1.65);scene.add(hemi);
  const ambient=new THREE.AmbientLight(0xffffff,.52);scene.add(ambient);
  updateStreaming(true);
}

function setJoystickFromPointer(e){
  const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;
  let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max;}
  motion.x=clamp(dx/max,-1,1);motion.y=clamp(dy/max,-1,1);stick.style.transform=`translate(${dx}px,${dy}px)`;
}
function resetJoystick(){motion.x=motion.y=0;stick.style.transform='translate(0px,0px)';joyPointer=null;}
function installControls(){
  joystick.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(joyPointer!==null)return;joyPointer=e.pointerId;joystick.setPointerCapture?.(e.pointerId);setJoystickFromPointer(e);});
  joystick.addEventListener('pointermove',e=>{if(e.pointerId!==joyPointer)return;e.preventDefault();e.stopPropagation();setJoystickFromPointer(e);});
  const joyEnd=e=>{if(e.pointerId!==joyPointer)return;e.preventDefault();e.stopPropagation();resetJoystick();};joystick.addEventListener('pointerup',joyEnd);joystick.addEventListener('pointercancel',joyEnd);joystick.addEventListener('lostpointercapture',()=>{if(joyPointer!==null)resetJoystick();});

  renderer.domElement.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'){renderer.domElement.requestPointerLock?.();return;}
    if(e.clientX<innerWidth*.38||lookPointer!==null)return;
    lookPointer=e.pointerId;lookX=e.clientX;lookY=e.clientY;renderer.domElement.setPointerCapture?.(e.pointerId);lookHint.style.opacity='0';
  });
  renderer.domElement.addEventListener('pointermove',e=>{
    if(e.pointerType==='mouse')return;if(e.pointerId!==lookPointer)return;e.preventDefault();
    const dx=e.clientX-lookX,dy=e.clientY-lookY;lookX=e.clientX;lookY=e.clientY;applyLook(dx,dy,.0042);
  },{passive:false});
  const lookEnd=e=>{if(e.pointerId===lookPointer)lookPointer=null;};renderer.domElement.addEventListener('pointerup',lookEnd);renderer.domElement.addEventListener('pointercancel',lookEnd);
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement)applyLook(e.movementX,e.movementY,.0021);});
  addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();resetJoystick();lookPointer=null;});
}
function applyLook(dx,dy,sensitivity){
  yaw -= dx*sensitivity;pitch=clamp(pitch-dy*sensitivity,-1.42,1.42);yawRig.rotation.y=yaw;pitchRig.rotation.x=pitch;
}
function movementInput(){
  let x=motion.x,y=-motion.y;
  if(keys.has('KeyW')||keys.has('ArrowUp'))y+=1;if(keys.has('KeyS')||keys.has('ArrowDown'))y-=1;if(keys.has('KeyD'))x+=1;if(keys.has('KeyA'))x-=1;
  const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}return{x,y};
}
function updatePlayer(dt){
  const input=movementInput();if(!input.x&&!input.y)return;
  const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?RUN_SPEED:WALK_SPEED;
  const sin=Math.sin(yaw),cos=Math.cos(yaw);
  const dx=(input.x*cos-input.y*sin)*speed*dt;
  const dz=(-input.x*sin-input.y*cos)*speed*dt;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
  for(let i=0;i<steps;i++){
    const sx=dx/steps,sz=dz/steps;const nx=yawRig.position.x+sx,nz=yawRig.position.z+sz;
    if(canStand(nx,yawRig.position.z))yawRig.position.x=nx;
    if(canStand(yawRig.position.x,nz))yawRig.position.z=nz;
  }
}
function animate(now){
  if(!started)return;const dt=Math.min(.033,(now-lastTime)/1000);lastTime=now;updatePlayer(dt);updateStreaming();coordsEl.textContent=`${Math.floor(yawRig.position.x)} , ${Math.floor(yawRig.position.z)}`;renderer.render(scene,camera);requestAnimationFrame(animate);
}

startBtn.addEventListener('click',()=>{
  if(started)return;bootStatus.textContent='Generating nearby sectors…';startBtn.disabled=true;
  try{initRenderer();installControls();started=true;startScreen.style.display='none';hud.classList.add('live');lastTime=performance.now();requestAnimationFrame(animate);}catch(err){console.error(err);bootStatus.textContent='Renderer failed to start. Reload and try again.';startBtn.disabled=false;}
});
addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
document.addEventListener('contextmenu',e=>e.preventDefault());
