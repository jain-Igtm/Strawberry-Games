import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $=id=>document.getElementById(id);
const ui={start:$('startScreen'),startBtn:$('startBtn'),zone:$('zone'),objective:$('objective'),status:$('topRight'),alarm:$('alarm'),prompt:$('prompt'),message:$('message'),damage:$('damage'),joy:$('joystick'),stick:$('stick'),lamp:$('lampBtn'),use:$('useBtn')};

const scene=new THREE.Scene();scene.background=new THREE.Color(0x9fc8dc);scene.fog=new THREE.Fog(0x9fc8dc,70,180);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.07,190);camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',precision:'mediump'});renderer.setPixelRatio(Math.min(devicePixelRatio,.9));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xd9e9ee,0x242720,1.05));const sun=new THREE.DirectionalLight(0xffefc8,1.25);sun.position.set(-35,45,-20);scene.add(sun);

const M={
 wall:new THREE.MeshLambertMaterial({color:0x74786f}),wall2:new THREE.MeshLambertMaterial({color:0x62675f}),floor:new THREE.MeshLambertMaterial({color:0x42463f}),ceiling:new THREE.MeshLambertMaterial({color:0x555b54}),door:new THREE.MeshLambertMaterial({color:0x4e5c58}),wood:new THREE.MeshLambertMaterial({color:0x74583e}),fabric:new THREE.MeshLambertMaterial({color:0x6f6559}),metal:new THREE.MeshLambertMaterial({color:0x394442}),pipe:new THREE.MeshLambertMaterial({color:0x303a38}),lamp:new THREE.MeshBasicMaterial({color:0xf0f4de}),red:new THREE.MeshBasicMaterial({color:0x541217}),glass:new THREE.MeshBasicMaterial({color:0xaad9ec,transparent:true,opacity:.7}),city:new THREE.MeshLambertMaterial({color:0x878e89}),city2:new THREE.MeshLambertMaterial({color:0x707875})
};
const G=new THREE.BoxGeometry(1,1,1),CHUNK=32,RADIUS=3;
const chunks=new Map(),colliders=[],doors=[],interactables=[],shelters=[],warningMeshes=[];
function rnd(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
function box(g,x,y,z,w,h,d,mat,solid=true){const m=new THREE.Mesh(G,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.updateMatrix();m.matrixAutoUpdate=false;g.add(m);if(solid){const c={minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2,enabled:true,owner:g};colliders.push(c);g.userData.colliders.push(c);}return m;}
function door(g,x,z,side,room){const p=new THREE.Group();p.position.set(x,0,z);g.add(p);const slab=new THREE.Mesh(G,M.door);slab.scale.set(.15,2.45,1.45);slab.position.set(0,1.225,side*.72);p.add(slab);const c={minX:x-.14,maxX:x+.14,minY:0,maxY:2.5,minZ:z-.8,maxZ:z+.8,enabled:true,owner:g};colliders.push(c);g.userData.colliders.push(c);const d={pivot:p,slab,col:c,side,open:false,room,owner:g};slab.userData.door=d;doors.push(d);interactables.push(slab);g.userData.doors.push(d);return d;}

function apartment(g,side,z,seed){
 const inner=side*4.15,center=side*7.15,outer=side*10.15,w=6,d=7.4;
 box(g,center,-.09,z,w,.18,d,M.floor);box(g,center,3.15,z,w,.18,d,M.ceiling);
 box(g,outer,1.53,z,.2,3.25,d,M.wall);
 box(g,center,1.53,z-d/2,w,3.25,.2,M.wall);box(g,center,1.53,z+d/2,w,3.25,.2,M.wall);
 box(g,inner,1.53,z-2.6,.2,3.25,2.2,M.wall);box(g,inner,1.53,z+2.6,.2,3.25,2.2,M.wall);
 box(g,inner,2.82,z, .22,.62,3.0,M.wall2);
 const room={minX:Math.min(inner,outer),maxX:Math.max(inner,outer),minZ:z-3.55,maxZ:z+3.55,door:null};room.door=door(g,inner,z,side>0?-1:1,room);shelters.push(room);g.userData.shelters.push(room);
 const r=rnd(seed);box(g,center+side*.7,.3,z+1.7,2.5,.6,1.15,M.fabric);box(g,center-side*1.65,.45,z-1.6,1.05,.9,.7,M.wood);box(g,center-side*2.15,1.35,z+1.65,.5,2.2,.5,M.metal);
 if(r>.55)box(g,center,1.1,z-2.3,1.8,2,.18,M.wall2);
 box(g,outer-side*.12,1.72,z,.06,1.5,2.5,M.glass,false);box(g,outer-side*.3,.95,z-2.4,.28,1.8,.28,M.pipe,false);
}
function city(g,idx,cz){for(let side of [-1,1])for(let row=0;row<3;row++)for(let i=0;i<4;i++){const r=rnd(idx*97+side*13+row*19+i*7),x=side*(22+row*17+r*5),z=cz-14+i*10+(r-.5)*4,h=20+Math.floor(r*6)*5;box(g,x,h/2-1,z,10+row*2,h,9+(i%2)*3,(i+row)%2?M.city:M.city2,false);}}
function build(idx){
 const g=new THREE.Group();g.userData={colliders:[],doors:[],shelters:[],warnings:[]};const z0=idx*CHUNK,cz=z0+CHUNK/2;
 box(g,0,-.1,cz,8,.2,CHUNK,M.floor);box(g,0,3.18,cz,8,.2,CHUNK,M.ceiling);
 for(let local=0;local<4;local++){
  const z=z0+4+local*8;apartment(g,-1,z,idx*17+local);apartment(g,1,z,idx*23+local);
  box(g,0,3.01,z,1.65,.07,.28,M.lamp,false);const w=box(g,0,2.73,z+.72,.46,.2,.14,M.red,false);warningMeshes.push(w);g.userData.warnings.push(w);
 }
 box(g,-3.55,2.7,cz,.13,.13,CHUNK,M.pipe,false);box(g,3.55,2.48,cz,.15,.15,CHUNK,M.pipe,false);
 city(g,idx,cz);scene.add(g);chunks.set(idx,g);
}
function remove(idx){const g=chunks.get(idx);if(!g)return;for(const d of g.userData.doors){doors.splice(doors.indexOf(d),1);interactables.splice(interactables.indexOf(d.slab),1);}for(const s of g.userData.shelters)shelters.splice(shelters.indexOf(s),1);for(const c of g.userData.colliders)colliders.splice(colliders.indexOf(c),1);for(const w of g.userData.warnings)warningMeshes.splice(warningMeshes.indexOf(w),1);scene.remove(g);chunks.delete(idx);}
function stream(){const here=Math.floor(player.pos.z/CHUNK);for(let i=here-RADIUS;i<=here+RADIUS;i++)if(!chunks.has(i))build(i);for(const i of [...chunks.keys()])if(Math.abs(i-here)>RADIUS+1)remove(i);}

const player={pos:new THREE.Vector3(0,1.67,2),yaw:Math.PI,pitch:0,radius:.34,exposure:0};
const flashlight=new THREE.SpotLight(0xf6fff2,8,28,.5,.55,1.1);flashlight.position.set(0,.05,.05);flashlight.target.position.set(0,-.05,-3);camera.add(flashlight,flashlight.target);scene.add(camera);
const ray=new THREE.Raycaster();let aimed=null,started=false,lampOn=true;
function blocked(p){const foot=p.y-1.02;for(const c of colliders){if(!c.enabled)continue;if(p.x+player.radius<c.minX||p.x-player.radius>c.maxX||foot+1.05<c.minY||foot>c.maxY||p.z+player.radius<c.minZ||p.z-player.radius>c.maxZ)continue;return true;}return false;}
function aim(){ray.setFromCamera({x:0,y:0},camera);const hit=ray.intersectObjects(interactables,false).find(h=>h.distance<3.5);aimed=hit?.object||null;ui.prompt.style.display=aimed?'block':'none';if(aimed)ui.prompt.textContent=`[ USE ] ${aimed.userData.door.open?'CLOSE':'OPEN'} DOOR`;}
function use(){if(!aimed)return;const d=aimed.userData.door;d.open=!d.open;d.pivot.rotation.y=d.open*(d.side>0?1.48:-1.48);d.col.enabled=!d.open;}
function toggleLamp(){lampOn=!lampOn;flashlight.visible=lampOn;ui.lamp.textContent=lampOn?'LAMP':'LAMP OFF';}
function safe(){return shelters.some(s=>player.pos.x>s.minX&&player.pos.x<s.maxX&&player.pos.z>s.minZ&&player.pos.z<s.maxZ&&!s.door.open);}

let ac=null,osc=null,gain=null;function alarmOn(){if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();if(osc)return;osc=ac.createOscillator();gain=ac.createGain();osc.type='square';osc.frequency.value=420;gain.gain.value=.032;osc.connect(gain).connect(ac.destination);osc.start();}function alarmOff(){if(osc){osc.stop();osc=null;gain=null;}}
const event={state:'normal',timer:300+rnd(Date.now())*240,cycle:0};
function setEvent(state,time){event.state=state;event.timer=time;if(state==='warning'||state==='active')alarmOn();else alarmOff();}
function relocate(){player.pos.set(0,1.67,Math.floor(player.pos.z/CHUNK)*CHUNK+2);player.exposure=0;ui.message.textContent='EXPOSURE DETECTED — EMERGENCY RELOCATION';ui.message.style.display='block';setTimeout(()=>ui.message.style.display='none',2600);}
function updateEvent(dt){
 event.timer-=dt;if(event.state==='normal'&&event.timer<=0)setEvent('warning',22);else if(event.state==='warning'&&event.timer<=0)setEvent('active',20);else if(event.state==='active'&&event.timer<=0){event.cycle++;setEvent('clear',8);}else if(event.state==='clear'&&event.timer<=0)setEvent('normal',180+rnd(event.cycle*43+9)*240);
 const flash=(event.state==='warning'||event.state==='active')&&Math.floor(performance.now()/260)%2===0;for(const w of warningMeshes)w.material=flash?M.lamp:M.red;
 if(event.state==='warning'){ui.alarm.style.display='block';ui.alarm.textContent=`САМОСБОР WARNING — SEEK SHELTER ${Math.ceil(event.timer)}s`;ui.objective.textContent='ENTER AN APARTMENT AND CLOSE THE DOOR';}
 else if(event.state==='active'){const sealed=safe();ui.alarm.style.display='block';ui.alarm.textContent=sealed?'САМОСБОР ACTIVE — SHELTER SEALED':'САМОСБОР ACTIVE — EXPOSED';ui.objective.textContent=sealed?'WAIT FOR THE ALL-CLEAR':'GET BEHIND A CLOSED DOOR';if(!sealed){player.exposure+=dt;ui.damage.style.opacity=Math.min(1,player.exposure/1.5);if(player.exposure>3)relocate();}else{player.exposure=Math.max(0,player.exposure-dt*2);ui.damage.style.opacity=0;}}
 else if(event.state==='clear'){ui.alarm.style.display='block';ui.alarm.textContent='ALL CLEAR — CORRIDORS SAFE';ui.objective.textContent='CONTINUE THROUGH THE COMBINE';ui.damage.style.opacity=0;}
 else{ui.alarm.style.display='none';ui.objective.textContent='EXPLORE THE ENDLESS RESIDENTIAL COMBINE';ui.damage.style.opacity=0;}
 if(osc){osc.frequency.value=flash?510:390;gain.gain.value=event.state==='active'?.052:.032;}
}
function hud(){const i=Math.floor(player.pos.z/CHUNK);ui.zone.textContent=`RESIDENTIAL COMBINE — SECTION ${i>=0?'+':''}${i}`;ui.status.innerHTML=`LAMP: ${lampOn?'ON':'OFF'}<br>EVENT: ${event.state.toUpperCase()}<br>WORLD: STREAMING`;}

let joyX=0,joyY=0,joyId=null,lookId=null,lx=0,ly=0;const keys={};
function stick(t){const r=ui.joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=t.clientX-cx,dy=t.clientY-cy,len=Math.hypot(dx,dy),max=r.width*.34,m=Math.min(max,len),nx=len?dx/len:0,ny=len?dy/len:0;joyX=nx*m/max;joyY=ny*m/max;ui.stick.style.transform=`translate(${nx*m}px,${ny*m}px)`;}function resetStick(){joyX=joyY=0;joyId=null;ui.stick.style.transform='translate(0,0)';}
addEventListener('touchstart',e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){const el=document.elementFromPoint(t.clientX,t.clientY);if(el?.closest('#buttons'))continue;if(t.clientX<innerWidth*.44&&joyId===null){joyId=t.identifier;stick(t);}else if(lookId===null){lookId=t.identifier;lx=t.clientX;ly=t.clientY;}}},{passive:false});
addEventListener('touchmove',e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){if(t.identifier===joyId)stick(t);if(t.identifier===lookId){const dx=t.clientX-lx,dy=t.clientY-ly;lx=t.clientX;ly=t.clientY;player.yaw-=dx*.0037;player.pitch=THREE.MathUtils.clamp(player.pitch+dy*.003,-1.05,.75);}}},{passive:false});
addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===joyId)resetStick();if(t.identifier===lookId)lookId=null;}});addEventListener('touchcancel',()=>{resetStick();lookId=null;});
function bind(el,fn){el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fn();});}bind(ui.use,use);bind(ui.lamp,toggleLamp);addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')use();if(e.code==='KeyF')toggleLamp();});addEventListener('keyup',e=>keys[e.code]=false);
ui.startBtn.onclick=()=>{started=true;ui.start.style.display='none';stream();if(ac)ac.resume();};
stream();let last=performance.now(),hudTick=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(started){let f=-joyY+(keys.KeyW?1:0)-(keys.KeyS?1:0),s=joyX+(keys.KeyD?1:0)-(keys.KeyA?1:0),n=Math.hypot(f,s);if(n>1){f/=n;s/=n;}const speed=5.8,sn=Math.sin(player.yaw),cs=Math.cos(player.yaw),dx=(s*cs-f*sn)*speed*dt,dz=(-s*sn-f*cs)*speed*dt;const px=player.pos.clone();px.x+=dx;if(!blocked(px))player.pos.copy(px);const pz=player.pos.clone();pz.z+=dz;if(!blocked(pz))player.pos.copy(pz);camera.position.copy(player.pos);camera.rotation.set(player.pitch,player.yaw,0);stream();aim();updateEvent(dt);if(now-hudTick>250){hud();hudTick=now;}}renderer.render(scene,camera);}frame(last);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});