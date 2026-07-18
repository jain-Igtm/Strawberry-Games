import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $ = id => document.getElementById(id);
const ui = {start:$('startScreen'),startBtn:$('startBtn'),zone:$('zone'),objective:$('objective'),status:$('topRight'),alarm:$('alarm'),prompt:$('prompt'),message:$('message'),damage:$('damage'),joy:$('joystick'),stick:$('stick'),lamp:$('lampBtn'),use:$('useBtn')};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc8dc);
scene.fog = new THREE.Fog(0x9fc8dc, 55, 155);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .07, 170);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',precision:'mediump'});
renderer.setPixelRatio(Math.min(devicePixelRatio, .9));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xd8e8ee, 0x252820, 1.05));
const sun = new THREE.DirectionalLight(0xfff0c7, 1.35);
sun.position.set(-30, 45, -20);
scene.add(sun);

const M = {
 concrete:new THREE.MeshLambertMaterial({color:0x77796f}),
 concrete2:new THREE.MeshLambertMaterial({color:0x686b63}),
 floor:new THREE.MeshLambertMaterial({color:0x444740}),
 ceiling:new THREE.MeshLambertMaterial({color:0x5c6059}),
 steel:new THREE.MeshLambertMaterial({color:0x414a49}),
 door:new THREE.MeshLambertMaterial({color:0x59645f}),
 wood:new THREE.MeshLambertMaterial({color:0x72573d}),
 fabric:new THREE.MeshLambertMaterial({color:0x6f655a}),
 pipe:new THREE.MeshLambertMaterial({color:0x35403d}),
 lamp:new THREE.MeshBasicMaterial({color:0xf0f3dc}),
 warning:new THREE.MeshBasicMaterial({color:0x431014}),
 window:new THREE.MeshBasicMaterial({color:0xa7d9ee,transparent:true,opacity:.65}),
 city:new THREE.MeshLambertMaterial({color:0x8e938d}),
 cityDark:new THREE.MeshLambertMaterial({color:0x737a76})
};

const CHUNK = 32, ACTIVE_RADIUS = 3;
const chunks = new Map(), colliders = [], doors = [], interactables = [], shelters = [], warningMeshes = [];
const boxGeo = new THREE.BoxGeometry(1,1,1);
const dummy = new THREE.Object3D();

function seeded(n){let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
function addBox(group,x,y,z,w,h,d,mat,solid=true,tag=null){
 const mesh=new THREE.Mesh(boxGeo,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.updateMatrix();mesh.matrixAutoUpdate=false;mesh.userData.tag=tag;group.add(mesh);
 if(solid){const c={minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2,owner:group,enabled:true};colliders.push(c);group.userData.colliders.push(c);}
 return mesh;
}
function addDoor(group,x,z,side,room){
 const pivot=new THREE.Group();pivot.position.set(x,0,z);group.add(pivot);
 const slab=new THREE.Mesh(boxGeo,M.door);slab.scale.set(.13,2.45,1.48);slab.position.set(0,1.225,side*.74);pivot.add(slab);
 const col={minX:x-.13,maxX:x+.13,minY:0,maxY:2.5,minZ:z-.82,maxZ:z+.82,owner:group,enabled:true};
 colliders.push(col);group.userData.colliders.push(col);
 const d={pivot,slab,col,open:false,side,room,owner:group};slab.userData.door=d;doors.push(d);interactables.push(slab);group.userData.doors.push(d);return d;
}
function furnish(group,x,z,side,variant){
 addBox(group,x+side*.65,.31,z+1.55,2.4,.62,1.15,M.fabric,true);
 addBox(group,x-side*1.55,.47,z-1.55,1.05,.94,.7,M.wood,true);
 addBox(group,x-side*1.75,1.4,z+1.45,.45,2.2,.45,M.steel,true);
 if(variant>.52){addBox(group,x,1.15,z-2.25,1.7,2.05,.18,M.concrete2,true);}
 addBox(group,x-side*2.3,2.65,z,4.3,.12,.12,M.pipe,false);
}
function addRoom(group,side,z,idx,local){
 const x=side*6.45, outer=side*9.25, inner=side*3.58;
 const variant=seeded(idx*19+local*7+(side>0?4:9));
 addBox(group,x,-.09,z,5.75,.18,7.25,M.floor,true);
 addBox(group,x,3.15,z,5.75,.18,7.25,M.ceiling,true);
 addBox(group,outer,1.53,z,.2,3.25,7.25,M.concrete,true);
 addBox(group,x,1.53,z-3.55,5.75,3.25,.2,M.concrete,true);
 addBox(group,x,1.53,z+3.55,5.75,3.25,.2,M.concrete,true);
 addBox(group,inner,1.53,z-2.55,.2,3.25,2.05,M.concrete,true);
 addBox(group,inner,1.53,z+2.55,.2,3.25,2.05,M.concrete,true);
 const room={minX:Math.min(inner,outer),maxX:Math.max(inner,outer),minZ:z-3.42,maxZ:z+3.42,door:null,owner:group};
 room.door=addDoor(group,inner,z,side>0?-1:1,room);shelters.push(room);group.userData.shelters.push(room);
 furnish(group,x,z,side,variant);
 addBox(group,outer-side*.11,1.75,z, .05,1.45,2.3,M.window,false);
 addBox(group,outer-side*.28,.95,z-2.25,.32,1.7,.32,M.pipe,false);
}
function addCity(group,idx,z0){
 for(let row=0;row<3;row++)for(let side of [-1,1])for(let i=0;i<4;i++){
  const r=seeded(idx*101+row*17+i*11+(side>0?3:7));
  const x=side*(18+row*15+r*6), z=z0-8+i*12+(r-.5)*5, h=18+Math.floor(r*6)*5;
  addBox(group,x,h/2-1,z,9+row*2,h,9+(i%2)*3,(i+row)%2?M.city:M.cityDark,false);
  for(let y=4;y<h-2;y+=4)addBox(group,x-side*4.56,y,z, .06,.7,6.5,M.lamp,false);
 }
}
function buildChunk(idx){
 const group=new THREE.Group();group.userData={idx,colliders:[],doors:[],shelters:[]};
 const z0=idx*CHUNK, cz=z0+CHUNK/2, special=seeded(idx*31)>.78;
 addBox(group,0,-.1,cz,7.2,.2,CHUNK,M.floor,true);
 addBox(group,0,3.18,cz,7.2,.2,CHUNK,M.ceiling,true);
 for(let side of [-1,1]){
  for(let z=z0+4;z<z0+CHUNK;z+=8){
   addBox(group,side*3.55,1.54,z-2.55,.2,3.25,2.85,M.concrete,true);
   addBox(group,side*3.55,1.54,z+2.55,.2,3.25,2.85,M.concrete,true);
  }
 }
 for(let local=0;local<4;local++){
  const z=z0+4+local*8;
  addRoom(group,-1,z,idx,local);addRoom(group,1,z,idx,local);
  addBox(group,0,3.02,z,1.55,.07,.25,M.lamp,false);
  const warn=addBox(group,0,2.72,z+.8,.42,.18,.12,M.warning,false);warningMeshes.push(warn);group.userData.warningMeshes??=[];group.userData.warningMeshes.push(warn);
 }
 for(let z=z0+2;z<z0+CHUNK;z+=8){addBox(group,-3.25,2.72,z,.12,.12,7.2,M.pipe,false);addBox(group,3.25,2.5,z,.15,.15,7.2,M.pipe,false);}
 if(special){
  addBox(group,0,.12,cz,5.8,.25,5.5,M.concrete2,false);
  addBox(group,0,1.05,cz,1.4,1.8,.7,M.steel,true);
 }
 addCity(group,idx,cz);
 scene.add(group);chunks.set(idx,group);return group;
}
function disposeChunk(idx){
 const g=chunks.get(idx);if(!g)return;
 for(const d of g.userData.doors){doors.splice(doors.indexOf(d),1);interactables.splice(interactables.indexOf(d.slab),1);}
 for(const s of g.userData.shelters)shelters.splice(shelters.indexOf(s),1);
 for(const c of g.userData.colliders)colliders.splice(colliders.indexOf(c),1);
 for(const w of g.userData.warningMeshes||[])warningMeshes.splice(warningMeshes.indexOf(w),1);
 scene.remove(g);chunks.delete(idx);
}
function stream(){
 const here=Math.floor(player.pos.z/CHUNK);
 for(let i=here-ACTIVE_RADIUS;i<=here+ACTIVE_RADIUS;i++)if(!chunks.has(i))buildChunk(i);
 for(const idx of [...chunks.keys()])if(Math.abs(idx-here)>ACTIVE_RADIUS+1)disposeChunk(idx);
}

const player={pos:new THREE.Vector3(0,1.67,2),yaw:Math.PI,pitch:0,radius:.34,exposure:0};
const flashlight=new THREE.SpotLight(0xf5fff0,8,28,.5,.55,1.1);flashlight.position.set(0,.05,.05);flashlight.target.position.set(0,-.05,-3);camera.add(flashlight,flashlight.target);scene.add(camera);
const ray=new THREE.Raycaster();let aimed=null,started=false,lampOn=true;

function blocked(p){const foot=p.y-1.02;for(const c of colliders){if(!c.enabled)continue;if(p.x+player.radius<c.minX||p.x-player.radius>c.maxX||foot+1.05<c.minY||foot>c.maxY||p.z+player.radius<c.minZ||p.z-player.radius>c.maxZ)continue;return true;}return false;}
function updateAim(){ray.setFromCamera({x:0,y:0},camera);const visible=interactables.filter(m=>m.parent?.parent?.parent!==null);const h=ray.intersectObjects(visible,false).find(v=>v.distance<3.4);aimed=h?.object||null;ui.prompt.style.display=aimed?'block':'none';if(aimed)ui.prompt.textContent=`[ USE ] ${aimed.userData.door.open?'CLOSE':'OPEN'} DOOR`;}
function use(){if(!aimed)return;const d=aimed.userData.door;d.open=!d.open;d.pivot.rotation.y=d.open*(d.side>0?1.5:-1.5);d.col.enabled=!d.open;}
function toggleLamp(){lampOn=!lampOn;flashlight.visible=lampOn;ui.lamp.textContent=lampOn?'LAMP':'LAMP OFF';}
function sealedShelter(){return shelters.find(s=>player.pos.x>s.minX&&player.pos.x<s.maxX&&player.pos.z>s.minZ&&player.pos.z<s.maxZ&&!s.door.open);}

let audioCtx=null,alarmOsc=null,alarmGain=null;
function beginAlarmSound(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(alarmOsc)return;alarmOsc=audioCtx.createOscillator();alarmGain=audioCtx.createGain();alarmOsc.type='square';alarmOsc.frequency.value=430;alarmGain.gain.value=.035;alarmOsc.connect(alarmGain).connect(audioCtx.destination);alarmOsc.start();}
function stopAlarmSound(){if(alarmOsc){alarmOsc.stop();alarmOsc=null;alarmGain=null;}}
const event={state:'normal',timer:55+seeded(Date.now())*35,cycle:0};
function setEvent(state,time){event.state=state;event.timer=time;if(state==='warning'||state==='active')beginAlarmSound();else stopAlarmSound();}
function resetPlayer(){player.pos.set(0,1.67,Math.floor(player.pos.z/CHUNK)*CHUNK+2);player.exposure=0;ui.message.textContent='EXPOSURE DETECTED — EMERGENCY RELOCATION';ui.message.style.display='block';setTimeout(()=>ui.message.style.display='none',2600);}
function updateEvent(dt){
 event.timer-=dt;
 if(event.state==='normal'&&event.timer<=0)setEvent('warning',15);
 else if(event.state==='warning'&&event.timer<=0)setEvent('active',18);
 else if(event.state==='active'&&event.timer<=0){event.cycle++;setEvent('clear',6);}
 else if(event.state==='clear'&&event.timer<=0)setEvent('normal',65+seeded(event.cycle*43+9)*65);
 const flashing=(event.state==='warning'||event.state==='active')&&Math.floor(performance.now()/260)%2===0;
 for(const w of warningMeshes)w.material=flashing?M.warning:M.lamp;
 if(event.state==='warning'){
  ui.alarm.style.display='block';ui.alarm.textContent=`САМОСБОР WARNING — SEEK SHELTER ${Math.ceil(event.timer)}s`;
  ui.objective.textContent='ENTER AN APARTMENT AND CLOSE THE DOOR';
 }else if(event.state==='active'){
  const safe=!!sealedShelter();ui.alarm.style.display='block';ui.alarm.textContent=safe?'САМОСБОР ACTIVE — SHELTER SEALED':'САМОСБОР ACTIVE — EXPOSED';
  ui.objective.textContent=safe?'WAIT FOR THE ALL-CLEAR':'GET BEHIND A CLOSED DOOR';
  if(!safe){player.exposure+=dt;ui.damage.style.opacity=Math.min(1,player.exposure/1.5);if(player.exposure>2.8)resetPlayer();}else{player.exposure=Math.max(0,player.exposure-dt*2);ui.damage.style.opacity=0;}
 }else if(event.state==='clear'){
  ui.alarm.style.display='block';ui.alarm.textContent='ALL CLEAR — CORRIDORS SAFE';ui.objective.textContent='CONTINUE THROUGH THE COMBINE';ui.damage.style.opacity=0;
 }else{ui.alarm.style.display='none';ui.objective.textContent='EXPLORE THE ENDLESS RESIDENTIAL COMBINE';ui.damage.style.opacity=0;}
 if(alarmOsc){alarmOsc.frequency.value=flashing?510:390;alarmGain.gain.value=event.state==='active'?.055:.035;}
}
function updateHud(){const idx=Math.floor(player.pos.z/CHUNK);ui.zone.textContent=`RESIDENTIAL COMBINE — SECTION ${idx>=0?'+':''}${idx}`;ui.status.innerHTML=`LAMP: ${lampOn?'ON':'OFF'}<br>EVENT: ${event.state.toUpperCase()}<br>WORLD: STREAMING`;}

let joyX=0,joyY=0,joyId=null,lookId=null,lx=0,ly=0;const keys={};
function moveStick(t){const r=ui.joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=t.clientX-cx,dy=t.clientY-cy,len=Math.hypot(dx,dy),max=r.width*.34,m=Math.min(max,len),nx=len?dx/len:0,ny=len?dy/len:0;joyX=nx*m/max;joyY=ny*m/max;ui.stick.style.transform=`translate(${nx*m}px,${ny*m}px)`;}
function resetStick(){joyX=joyY=0;joyId=null;ui.stick.style.transform='translate(0,0)';}
addEventListener('touchstart',e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){const el=document.elementFromPoint(t.clientX,t.clientY);if(el?.closest('#buttons'))continue;if(t.clientX<innerWidth*.44&&joyId===null){joyId=t.identifier;moveStick(t);}else if(lookId===null){lookId=t.identifier;lx=t.clientX;ly=t.clientY;}}},{passive:false});
addEventListener('touchmove',e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){if(t.identifier===joyId)moveStick(t);if(t.identifier===lookId){const dx=t.clientX-lx,dy=t.clientY-ly;lx=t.clientX;ly=t.clientY;player.yaw-=dx*.0037;player.pitch=THREE.MathUtils.clamp(player.pitch+dy*.003,-1.05,.75);}}},{passive:false});
addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===joyId)resetStick();if(t.identifier===lookId)lookId=null;}});addEventListener('touchcancel',()=>{resetStick();lookId=null;});
function bind(el,fn){el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fn();});}bind(ui.use,use);bind(ui.lamp,toggleLamp);
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')use();if(e.code==='KeyF')toggleLamp();});addEventListener('keyup',e=>keys[e.code]=false);
ui.startBtn.onclick=()=>{started=true;ui.start.style.display='none';stream();if(audioCtx)audioCtx.resume();};

stream();let last=performance.now(),hudTick=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(started){
 let f=-joyY+(keys.KeyW?1:0)-(keys.KeyS?1:0),s=joyX+(keys.KeyD?1:0)-(keys.KeyA?1:0),n=Math.hypot(f,s);if(n>1){f/=n;s/=n;}
 const speed=5.8,sn=Math.sin(player.yaw),cs=Math.cos(player.yaw),dx=(s*cs-f*sn)*speed*dt,dz=(-s*sn-f*cs)*speed*dt;
 const px=player.pos.clone();px.x+=dx;if(!blocked(px))player.pos.copy(px);const pz=player.pos.clone();pz.z+=dz;if(!blocked(pz))player.pos.copy(pz);
 camera.position.copy(player.pos);camera.rotation.set(player.pitch,player.yaw,0);stream();updateAim();updateEvent(dt);if(now-hudTick>250){updateHud();hudTick=now;}
 }renderer.render(scene,camera);}frame(last);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});