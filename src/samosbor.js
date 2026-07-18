import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $=id=>document.getElementById(id);
const ui={start:$('startScreen'),startBtn:$('startBtn'),zone:$('zone'),objective:$('objective'),status:$('topRight'),prompt:$('prompt'),joy:$('joystick'),stick:$('stick'),lamp:$('lampBtn'),use:$('useBtn')};

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x070908);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.08,95);camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',precision:'lowp'});
renderer.setPixelRatio(Math.min(devicePixelRatio,.82));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xc8d0c8,0x111411,.72));
const sun=new THREE.DirectionalLight(0xffd6a4,.85);sun.position.set(-20,30,-10);scene.add(sun);

const MAT={
 concrete:new THREE.MeshLambertMaterial({color:0x4c514d}),dark:new THREE.MeshLambertMaterial({color:0x202421}),floor:new THREE.MeshLambertMaterial({color:0x242724}),steel:new THREE.MeshLambertMaterial({color:0x4d5651}),rust:new THREE.MeshLambertMaterial({color:0x63483d}),warm:new THREE.MeshLambertMaterial({color:0x9c927f}),warmFloor:new THREE.MeshLambertMaterial({color:0x6f685b}),wood:new THREE.MeshLambertMaterial({color:0x604632}),fabric:new THREE.MeshLambertMaterial({color:0x55534e}),lamp:new THREE.MeshBasicMaterial({color:0xdde8dc}),window:new THREE.MeshBasicMaterial({color:0xb9def0})
};

const chunks=new Map(),colliders=[],doors=[],interactables=[];const CHUNK=24;
function chunkId(z,y=0){return `${y>3?'u':'l'}:${Math.floor(z/CHUNK)}`;}
function getChunk(z,y=0){const id=chunkId(z,y);if(!chunks.has(id))chunks.set(id,{id,y,specs:{},group:new THREE.Group(),built:false,visible:false});return chunks.get(id);}
function addSpec(x,y,z,w,h,d,key='concrete',solid=true){const c=getChunk(z,y);(c.specs[key]??=[]).push([x,y,z,w,h,d]);if(solid)colliders.push({minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2,chunk:c.id,enabled:true});}
function buildChunk(c){if(c.built)return;c.built=true;for(const [key,specs] of Object.entries(c.specs)){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),MAT[key],specs.length);const m=new THREE.Matrix4();for(let i=0;i<specs.length;i++){const [x,y,z,w,h,d]=specs[i];m.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(w,h,d));mesh.setMatrixAt(i,m);}mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=true;c.group.add(mesh);}c.group.visible=false;scene.add(c.group);}
function B(x,y,z,w,h,d,key='concrete',solid=true){addSpec(x,y,z,w,h,d,key,solid);}
function lamp(x,y,z,bright=false){B(x,y,z,1.45,.07,.25,'lamp',false);if(bright){B(x,y-.07,z,1.1,.03,.18,'window',false);}}
function corridor(z0,z1,y,bright=false){for(let z=z0;z<z1;z+=CHUNK){const e=Math.min(z+CHUNK,z1),len=e-z,cz=(z+e)/2;B(0,y,cz,7,.18,len,bright?'warmFloor':'floor');B(0,y+3.2,cz,7,.18,len,bright?'warm':'dark');B(-3.4,y+1.6,cz,.18,3.2,len,bright?'warm':'concrete');B(3.4,y+1.6,cz,.18,3.2,len,bright?'warm':'concrete');for(let q=z+4;q<e;q+=8)lamp(0,y+2.73,q,bright);}}
function door(x,y,z,side){const pivot=new THREE.Group();pivot.position.set(x,y,z);const slab=new THREE.Mesh(new THREE.BoxGeometry(.13,2.4,1.45),MAT.steel);slab.position.set(0,1.2,side*.72);pivot.add(slab);scene.add(pivot);const col={minX:x-.12,maxX:x+.12,minY:y,maxY:y+2.4,minZ:z-.78,maxZ:z+.78,chunk:chunkId(z,y),enabled:true};colliders.push(col);const d={pivot,slab,col,open:false,side,chunk:col.chunk};slab.userData.door=d;doors.push(d);interactables.push(slab);}
function room(side,z,y,bright,index){const x=side*6.25,key=bright?'warm':'concrete',fk=bright?'warmFloor':'floor';B(x,y,z,5.7,.18,7,fk);B(x,y+3.2,z,5.7,.18,7,key);B(side*9.05,y+1.6,z,.18,3.2,7,key);B(x,y+1.6,z-3.4,5.7,3.2,.18,key);B(x,y+1.6,z+3.4,5.7,3.2,.18,key);B(side*3.48,y+1.6,z-2.25,.18,3.2,2.05,key);B(side*3.48,y+1.6,z+2.25,.18,3.2,2.05,key);door(side*3.42,y,z,side>0?-1:1);B(x+side*.55,y+.34,z+1.5,2.3,.5,1.1,'fabric');B(x-side*1.5,y+.45,z-1.5,1,.9,.62,'wood');if(bright){B(x-side*.6,y+1.55,z-3.29,2.4,2.05,.04,'window',false);B(x,y+2.65,z,1.3,.06,.22,'lamp',false);}else{B(x-side*2.1,y+2.35,z,4.4,.12,.12,'steel',false);B(x,y+.22,z-2.35,1.1,.35,.75,'rust');}}
function tunnel(x,z0,z1){for(let z=z0;z<z1;z+=CHUNK){const e=Math.min(z+CHUNK,z1),len=e-z,cz=(z+e)/2;B(x,0,cz,5.1,.16,len,'floor');B(x,2.7,cz,5.1,.16,len,'dark');B(x-2.48,1.35,cz,.16,2.7,len,'dark');B(x+2.48,1.35,cz,.16,2.7,len,'dark');for(let q=z+5;q<e;q+=10)lamp(x,2.32,q,false);for(let q=z+4;q<e;q+=8)B(x+1.75,.25,q,.7,.45,.7,'rust');}}

// Huge connected map: 300m service level, two tunnels, stair, then 300m residential level.
corridor(-180,120,0,false);for(let i=0,z=-168;z<108;z+=12,i++)room(i%2?1:-1,z,0,false,i);
tunnel(-7.8,-160,90);tunnel(7.8,-120,116);B(-5.25,1.35,-130,5,.18,2.5,'dark');B(5.25,1.35,-72,5,.18,2.5,'dark');
// Stair ramp area.
B(0,0,124,7,.18,16,'floor');B(-3.4,3,124,.18,6,16,'dark');B(3.4,3,124,.18,6,16,'dark');B(0,6,124,7,.18,16,'warmFloor');for(let i=0;i<18;i++)B(-2+i*.235,.12+i*.34,124,2,.2,1.4,'steel');lamp(0,5.35,124,true);
corridor(132,432,6,true);for(let i=0,z=144;z<420;z+=12,i++)room(i%2?-1:1,z,6,true,i);
// Sun gallery at the far end.
B(0,6,438,18,.18,20,'warmFloor');B(0,9.2,438,18,.18,20,'warm');B(-9,7.6,438,.18,3.2,20,'warm');B(9,7.6,438,.18,3.2,20,'warm');B(0,7.6,448,18,3.2,.05,'window',false);for(let x=-6;x<=6;x+=3)B(x,8.8,438,1.4,.06,.24,'lamp',false);
for(const c of chunks.values())buildChunk(c);

const player={pos:new THREE.Vector3(0,1.67,-176),yaw:0,pitch:-.03,radius:.34};
const ray=new THREE.Raycaster();let aimed=null,started=false,lampOn=true,lastChunk='';
const flashlight=new THREE.SpotLight(0xf7fff4,8.5,28,.52,.6,1.1);flashlight.position.set(0,.05,.05);flashlight.target.position.set(0,-.05,-3);camera.add(flashlight,flashlight.target);scene.add(camera);
function floorAt(x,z){if(z>116&&z<132&&Math.abs(x)<2.5)return THREE.MathUtils.clamp((z-116)/16,0,1)*6;return player.pos.y>4?6:0;}
function nearbyChunk(c){const parts=c.id.split(':'),level=parts[0],idx=Number(parts[1]),here=Math.floor(player.pos.z/CHUNK),same=(player.pos.y>3?'u':'l')===level;return same&&Math.abs(idx-here)<=2;}
function updateVisibility(){const id=chunkId(player.pos.z,player.pos.y);if(id===lastChunk)return;lastChunk=id;for(const c of chunks.values()){const v=nearbyChunk(c);if(v!==c.visible){c.visible=v;c.group.visible=v;}}for(const d of doors)d.pivot.visible=nearbyChunk({id:d.chunk});}
function blocked(p){const y=p.y-.65;for(const c of colliders){if(!c.enabled||!nearbyChunk({id:c.chunk}))continue;if(p.x+player.radius<c.minX||p.x-player.radius>c.maxX||y+player.radius<c.minY||y-player.radius>c.maxY||p.z+player.radius<c.minZ||p.z-player.radius>c.maxZ)continue;return true;}return false;}
function updateAim(){ray.setFromCamera({x:0,y:0},camera);const visible=interactables.filter(m=>m.parent.visible);const h=ray.intersectObjects(visible,false).find(v=>v.distance<3.7);aimed=h?.object||null;ui.prompt.style.display=aimed?'block':'none';if(aimed)ui.prompt.textContent=`[ USE ] ${aimed.userData.door.open?'CLOSE':'OPEN'} DOOR`;}
function use(){if(!aimed)return;const d=aimed.userData.door;d.open=!d.open;d.pivot.rotation.y=d.open*(d.side>0?1.48:-1.48);d.col.enabled=!d.open;}
function toggleLamp(){lampOn=!lampOn;flashlight.visible=lampOn;ui.lamp.textContent=lampOn?'LAMP':'LAMP OFF';}
function updateHud(){const upper=player.pos.y>4,tunnelZone=Math.abs(player.pos.x)>4.5&&!upper;ui.zone.textContent=upper?'RESIDENTIAL LEVEL 07':tunnelZone?'MAINTENANCE TUNNELS':'SERVICE LEVEL 06';ui.objective.textContent=upper?'REACH THE SUN GALLERY':'FIND THE STAIRWELL AT THE FAR END';ui.status.innerHTML=`LAMP: ${lampOn?'ON':'OFF'}<br>RENDER: MOBILE<br>MAP: 600M+`;scene.background.setHex(upper?0x7895a0:0x070908);sun.intensity=upper?1.15:.08;}

let joyX=0,joyY=0,joyId=null,lookId=null,lx=0,ly=0;const keys={};
function moveStick(t){const r=ui.joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=t.clientX-cx,dy=t.clientY-cy,len=Math.hypot(dx,dy),max=r.width*.34,m=Math.min(max,len),nx=len?dx/len:0,ny=len?dy/len:0;joyX=nx*m/max;joyY=ny*m/max;ui.stick.style.transform=`translate(${nx*m}px,${ny*m}px)`;}
function resetStick(){joyX=joyY=0;joyId=null;ui.stick.style.transform='translate(0,0)';}
addEventListener('touchstart',e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){const el=document.elementFromPoint(t.clientX,t.clientY);if(el?.closest('#buttons'))continue;if(t.clientX<innerWidth*.44&&joyId===null){joyId=t.identifier;moveStick(t);}else if(lookId===null){lookId=t.identifier;lx=t.clientX;ly=t.clientY;}}},{passive:false});
addEventListener('touchmove',e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){if(t.identifier===joyId)moveStick(t);if(t.identifier===lookId){const dx=t.clientX-lx,dy=t.clientY-ly;lx=t.clientX;ly=t.clientY;player.yaw-=dx*.0037;player.pitch=THREE.MathUtils.clamp(player.pitch+dy*.003,-1.05,.7);}}},{passive:false});
addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===joyId)resetStick();if(t.identifier===lookId)lookId=null;}});addEventListener('touchcancel',()=>{resetStick();lookId=null;});
function bind(el,fn){el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fn();});}bind(ui.use,use);bind(ui.lamp,toggleLamp);
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')use();if(e.code==='KeyF')toggleLamp();});addEventListener('keyup',e=>keys[e.code]=false);
ui.startBtn.onclick=()=>{started=true;ui.start.style.display='none';updateVisibility();};
let last=performance.now(),hudTick=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(started){let f=-joyY+(keys.KeyW?1:0)-(keys.KeyS?1:0),s=joyX+(keys.KeyD?1:0)-(keys.KeyA?1:0);const n=Math.hypot(f,s);if(n>1){f/=n;s/=n;}const speed=6.4,sn=Math.sin(player.yaw),cs=Math.cos(player.yaw),dx=(s*cs-f*sn)*speed*dt,dz=(-s*sn-f*cs)*speed*dt;const px=player.pos.clone();px.x+=dx;px.y=floorAt(px.x,px.z)+1.67;if(!blocked(px))player.pos.copy(px);const pz=player.pos.clone();pz.z+=dz;pz.y=floorAt(pz.x,pz.z)+1.67;if(!blocked(pz))player.pos.copy(pz);camera.position.copy(player.pos);camera.rotation.set(player.pitch,player.yaw,0);updateVisibility();updateAim();if(now-hudTick>250){updateHud();hudTick=now;}}renderer.render(scene,camera);}frame(last);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});