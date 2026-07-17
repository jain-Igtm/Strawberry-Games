import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $=id=>document.getElementById(id);
const ui={start:$('startScreen'),startBtn:$('startBtn'),zone:$('zone'),objective:$('objective'),status:$('topRight'),alarm:$('alarm'),prompt:$('prompt'),message:$('message'),damage:$('damage'),joy:$('joystick'),stick:$('stick'),run:$('runBtn'),lamp:$('lampBtn'),use:$('useBtn')};

const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b0e0c);scene.fog=new THREE.FogExp2(0x131713,.018);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.06,180);camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=false;document.body.prepend(renderer.domElement);

const hemi=new THREE.HemisphereLight(0xa9b8ad,0x11100d,.45);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffd99d,1.8);sun.position.set(-20,30,10);scene.add(sun);

const MAT={
 concrete:new THREE.MeshStandardMaterial({color:0x5a5f58,roughness:.98}),
 concreteDark:new THREE.MeshStandardMaterial({color:0x30352f,roughness:1}),
 floor:new THREE.MeshStandardMaterial({color:0x2c2e2a,roughness:.95}),
 steel:new THREE.MeshStandardMaterial({color:0x49504c,roughness:.55,metalness:.55}),
 rust:new THREE.MeshStandardMaterial({color:0x604237,roughness:.85,metalness:.2}),
 pipe:new THREE.MeshStandardMaterial({color:0x3d4a43,roughness:.7,metalness:.45}),
 red:new THREE.MeshStandardMaterial({color:0x7d272d,roughness:.7,metalness:.2}),
 yellow:new THREE.MeshStandardMaterial({color:0xa69745,roughness:.7,metalness:.15}),
 dark:new THREE.MeshStandardMaterial({color:0x101310,roughness:.9}),
 warmWall:new THREE.MeshStandardMaterial({color:0xa89e86,roughness:.95}),
 warmFloor:new THREE.MeshStandardMaterial({color:0x746d60,roughness:.95}),
 glass:new THREE.MeshStandardMaterial({color:0x8ec3dc,roughness:.2,emissive:0x162f3a,transparent:true,opacity:.86}),
 fabric:new THREE.MeshStandardMaterial({color:0x58554e,roughness:1}),
 paper:new THREE.MeshStandardMaterial({color:0xc7c1a5,roughness:1})
};

const colliders=[],interactables=[],lights=[],safeRooms=[];
function meshBox(x,y,z,w,h,d,mat=MAT.concrete,solid=true,parent=scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);if(solid)colliders.push({mesh:m,enabled:true});return m;}
function cylinder(x,y,z,r,h,mat=MAT.pipe,rz=Math.PI/2,parent=scene){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,10),mat);m.position.set(x,y,z);m.rotation.z=rz;parent.add(m);return m;}
function interact(mesh,type,label,data={}){mesh.userData={type,label,data};interactables.push(mesh);return mesh;}
function sign(text,x,y,z,ry=0,scale=1){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle='#d8d3b9';g.fillRect(0,0,512,128);g.strokeStyle='#292d29';g.lineWidth=12;g.strokeRect(6,6,500,116);g.fillStyle='#272b27';g.font='bold 50px monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,64);const t=new THREE.CanvasTexture(c);const m=new THREE.Mesh(new THREE.PlaneGeometry(2.7*scale,.68*scale),new THREE.MeshBasicMaterial({map:t}));m.position.set(x,y,z);m.rotation.y=ry;scene.add(m);}
function fixture(x,y,z,index,day=false){meshBox(x,y+.28,z,2.3,.12,.42,MAT.dark,false);const panel=meshBox(x,y+.2,z,2,.03,.24,MAT.glass,false);const light=new THREE.PointLight(day?0xffd9a7:0xb8c9bc,0,day?14:11,2);light.position.set(x,y,z);scene.add(light);lights.push({light,panel,phase:index*1.73,broken:index%7===0,day});}

function buildService(){
 meshBox(0,0,0,7,.2,104,MAT.floor);meshBox(0,3.2,0,7,.2,104,MAT.concreteDark);meshBox(-3.4,1.55,0,.2,3.2,104,MAT.concrete);meshBox(3.4,1.55,0,.2,3.2,104,MAT.concrete);
 for(let z=-48,i=0;z<=48;z+=6,i++)fixture(0,2.72,z,i,false);
 for(let z=-48;z<=48;z+=8){cylinder(-2.85,2.55,z,.08,7,MAT.pipe,0);meshBox(-2.85,2.55,z,.26,.26,.09,MAT.dark,false);}
 for(let i=0;i<10;i++){const z=-44+i*9.5;meshBox(i%2?2.55:-2.55,.26,z,.7,.52,.7,i%3?MAT.rust:MAT.steel);}
 sign('SERVICE LEVEL 06',2.95,2.2,-49,-Math.PI/2,.55);
}

function buildApartments(y,sunlit=false){
 const wall=sunlit?MAT.warmWall:MAT.concrete,floor=sunlit?MAT.warmFloor:MAT.floor;
 meshBox(0,y,0,7,.2,104,floor);meshBox(0,y+3.2,0,7,.2,104,wall);meshBox(-3.4,y+1.55,0,.2,3.2,104,wall);meshBox(3.4,y+1.55,0,.2,3.2,104,wall);
 for(let z=-44,i=0;z<=44;z+=11,i++){
  const side=i%2===0?1:-1,cx=side*6.2;
  meshBox(cx,y,z,5.7,.2,6.8,floor);meshBox(cx,y+3.2,z,5.7,.2,6.8,wall);meshBox(side*9,y+1.55,z,.2,3.2,6.8,wall);meshBox(cx,y+1.55,z-3.3,5.7,3.2,.2,wall);meshBox(cx,y+1.55,z+3.3,5.7,3.2,.2,wall);
  meshBox(side*3.5,y+1.55,z-2.2,.2,3.2,2.3,wall);meshBox(side*3.5,y+1.55,z+2.2,.2,3.2,2.3,wall);
  const pivot=new THREE.Group();pivot.position.set(side*3.45,y,z+(side<0?-.78:.78));scene.add(pivot);
  const slab=meshBox(0,1.2,side<0?.78:-.78,.15,2.4,1.5,MAT.steel,false,pivot);const col={mesh:slab,enabled:true};colliders.push(col);
  const door={pivot,open:false,side,col};interact(slab,'door',sunlit?'OPEN APARTMENT':'OPEN SHELTER',door);
  cylinder(side<0?.1:-.1,1.15,side<0?.34:-.34,.04,.34,MAT.yellow,Math.PI/2,pivot);
  meshBox(cx+side*.6,y+.35,z+1.45,2.1,.55,1.1,MAT.fabric);meshBox(cx-side*1.7,y+.5,z-1.5,.95,1,.6,MAT.rust);
  if(sunlit){meshBox(cx-side*.7,y+1.45,z-3.18,2.25,2,.08,MAT.glass,false);const glow=new THREE.PointLight(0xffd49d,1.45,11,2);glow.position.set(cx,y+1.7,z-2.2);scene.add(glow);}else meshBox(cx-side*.7,y+1,z-3.18,2.2,1.7,.08,MAT.dark,false);
  safeRooms.push({box:new THREE.Box3(new THREE.Vector3(Math.min(side*3.65,side*8.75),y+.1,z-3.05),new THREE.Vector3(Math.max(side*3.65,side*8.75),y+2.9,z+3.05)),door});
  sign(String((sunlit?700:600)+i),side*3.2,y+2.25,z,side<0?Math.PI/2:-Math.PI/2,.42);
 }
 if(sunlit){for(let z=-45,i=0;z<=45;z+=15,i++)fixture(0,y+2.72,z,30+i,true);sign('RESIDENTIAL LEVEL 07',2.95,y+2.2,-49,-Math.PI/2,.5);}
}

function buildStairwell(){
 const x=-1.6,z=36;
 meshBox(0,2.7,z,6.6,5.4,7.6,MAT.concrete);meshBox(0,2.7,z-3.72,2.4,5,.08,MAT.dark,false);
 for(let i=0;i<14;i++){const step=meshBox(x+i*.24,.12+i*.42,z,1.9,.22,1.35,MAT.steel);step.rotation.y=0;}
 meshBox(1.65,5.95,z,3.2,.2,7,MAT.steel);meshBox(-2.95,2.7,z,.12,5.2,7,MAT.steel);
 sign('STAIR 6–7',0,4.7,z-3.75,0,.55);
}

function buildMachines(){
 const panel=meshBox(-3.05,1.35,-16,.3,1.8,1.45,MAT.steel);sign('AUX GRID',-3.22,2.45,-16,Math.PI/2,.5);
 const switches=[];for(let i=0;i<3;i++){const s=meshBox(-3.22,1.72-i*.38,-16.3,.08,.22,.2,MAT.rust,false);switches.push(interact(s,'breaker',`TOGGLE BREAKER ${i+1}`,{index:i,on:false}));}
 const slot=interact(meshBox(-3.22,.9,-15.62,.08,.38,.34,MAT.dark,false),'slot','INSTALL CERAMIC FUSE',{installed:false});
 const fuse=interact(meshBox(2.35,.65,8,.22,.62,.22,MAT.paper,false),'fuse','TAKE CERAMIC FUSE',{});
 cylinder(3,1.35,24,.16,3.1,MAT.rust,0);const wheel=new THREE.Mesh(new THREE.TorusGeometry(.48,.055,8,20),MAT.red);wheel.position.set(2.66,1.35,24);wheel.rotation.y=Math.PI/2;scene.add(wheel);for(let i=0;i<4;i++){const spoke=meshBox(0,0,0,.05,.78,.05,MAT.red,false,wheel);spoke.rotation.z=i*Math.PI/2;}interact(wheel,'valve','TURN SHELTER RISER',{turns:0});sign('SHELTER RISER',2.62,2.35,24,-Math.PI/2,.48);
 return {switches,slot,fuse};
}

buildService();buildApartments(0,false);buildApartments(6,true);buildStairwell();const machine=buildMachines();

const player={pos:new THREE.Vector3(0,1.67,-42),yaw:0,pitch:-.03,radius:.34,stamina:1,zone:'service'};
const game={started:false,power:false,pressure:0,fuses:0,lamp:true,run:false,event:'idle',timer:Infinity,exposure:0,lightMode:'dim',lightTimer:8};
const ray=new THREE.Raycaster(),tempBox=new THREE.Box3();let aimed=null;
const flashlight=new THREE.SpotLight(0xe9f2e7,4.5,23,.4,.58,1.5);flashlight.position.set(0,0,0);flashlight.target.position.set(0,0,-2);camera.add(flashlight,flashlight.target);scene.add(camera);

function floorHeight(x,z){
 if(z>31&&z<41&&x>-2&&x<2){const t=THREE.MathUtils.clamp((x+1.6)/3.4,0,1);return .2+t*5.8;}
 return player.zone==='residential'?6:0;
}
function blocked(pos){const sphere=new THREE.Sphere(new THREE.Vector3(pos.x,pos.y-.65,pos.z),player.radius);for(const c of colliders){if(!c.enabled||!c.mesh.parent)continue;tempBox.setFromObject(c.mesh);if(tempBox.intersectsSphere(sphere))return true;}return false;}
function safe(){return safeRooms.some(r=>r.box.containsPoint(player.pos)&&!r.door.open);}
function say(text,ms=2600){ui.message.textContent=text;ui.message.style.display='block';clearTimeout(say.t);say.t=setTimeout(()=>ui.message.style.display='none',ms);}
function updateAim(){ray.setFromCamera({x:0,y:0},camera);const hit=ray.intersectObjects(interactables,false).find(h=>h.distance<2.7&&h.object.visible);aimed=hit?.object||null;if(aimed){ui.prompt.textContent=`[ USE ] ${aimed.userData.label}`;ui.prompt.style.display='block';}else ui.prompt.style.display='none';}
function use(){if(!aimed)return;const {type,data}=aimed.userData;
 if(type==='door'){if(!game.power&&player.zone==='service'){say('DOOR BUS OFFLINE');return;}data.open=!data.open;data.pivot.rotation.y=data.open*(data.side<0?-1.48:1.48);data.col.enabled=!data.open;aimed.userData.label=data.open?'CLOSE DOOR':'OPEN DOOR';}
 if(type==='fuse'){game.fuses++;aimed.visible=false;say('CERAMIC FUSE ACQUIRED');}
 if(type==='slot'){if(data.installed)return;if(!game.fuses){say('FUSE SLOT EMPTY');return;}game.fuses--;data.installed=true;aimed.material=MAT.yellow;say('CONTROL FUSE INSTALLED');}
 if(type==='breaker'){data.on=!data.on;aimed.material=data.on?MAT.yellow:MAT.rust;const ok=machine.slot.userData.data.installed&&machine.switches[0].userData.data.on&&!machine.switches[1].userData.data.on&&machine.switches[2].userData.data.on;if(ok&&!game.power){game.power=true;say('AUXILIARY GRID ONLINE');}}
 if(type==='valve'){if(!game.power){say('PUMP BUS OFFLINE');return;}data.turns=Math.min(4,data.turns+1);aimed.rotation.x+=Math.PI/2;game.pressure=data.turns/4;if(game.pressure===1&&game.event==='idle'){say('SHELTER RISER PRESSURIZED');game.event='quiet';game.timer=50;}}
}
function toggleLamp(){game.lamp=!game.lamp;flashlight.visible=game.lamp;ui.lamp.textContent=game.lamp?'LAMP':'LAMP OFF';ui.lamp.classList.toggle('lamp-off',!game.lamp);}

let audioCtx,sirenGain;function initAudio(){audioCtx=new(window.AudioContext||window.webkitAudioContext)();const master=audioCtx.createGain();master.gain.value=.2;master.connect(audioCtx.destination);sirenGain=audioCtx.createGain();sirenGain.gain.value=0;sirenGain.connect(master);for(const [type,f] of [['sawtooth',430],['square',218]]){const o=audioCtx.createOscillator();o.type=type;o.frequency.value=f;o.connect(sirenGain);o.start();}}
function siren(on){if(!audioCtx)return;const t=audioCtx.currentTime;sirenGain.gain.cancelScheduledValues(t);sirenGain.gain.linearRampToValueAtTime(on?.42:0,t+.12);}
function phase(p){game.event=p;if(p==='warning'){game.timer=14;ui.alarm.textContent='CIVIL ALARM · SEEK SEALED SHELTER';ui.alarm.style.display='block';siren(true);say('CIVIL ALARM — SHELTER IMMEDIATELY',5000);}if(p==='active'){game.timer=25;scene.background.setHex(0x25101f);scene.fog.color.setHex(0x5d2450);}if(p==='quiet'){game.timer=55+Math.random()*35;game.exposure=0;ui.alarm.style.display='none';siren(false);}}
function updateEvent(dt){if(game.event==='idle')return;game.timer-=dt;if(game.event==='quiet'&&game.timer<=0)phase('warning');else if(game.event==='warning'&&game.timer<=0)phase('active');else if(game.event==='active'){game.exposure=THREE.MathUtils.clamp(game.exposure+(safe()?-dt*.3:dt*.23),0,1);ui.damage.style.opacity=String(game.exposure);if(game.exposure>=1){siren(false);say('BIOLOGICAL INTEGRITY LOST',99999);setTimeout(()=>location.reload(),2500);}if(game.timer<=0){ui.damage.style.opacity='0';phase('quiet');say('EVENT TERMINATED');}}}
function nextLighting(){const r=Math.random();game.lightMode=r<.16?'blackout':r<.4?'flicker':r<.72?'dim':'bright';game.lightTimer=game.lightMode==='blackout'?1.2+Math.random()*1.6:game.lightMode==='flicker'?3+Math.random()*4:7+Math.random()*11;}
function updateLighting(dt,now){game.lightTimer-=dt;if(game.lightTimer<=0)nextLighting();const alarm=game.event==='warning'||game.event==='active';for(const f of lights){let on=!f.broken,level=f.day?1.35:(game.power?1:.16);if(game.lightMode==='dim')level*=.48;if(game.lightMode==='bright')level*=1.25;if(game.lightMode==='blackout'&&!f.day)level=.01;if(game.lightMode==='flicker')on=Math.sin(now*.035+f.phase)>-.12;if(alarm&&!f.day){on=Math.sin(now*.05+f.phase)>.35;f.light.color.setHex(0xc62b32);}else f.light.color.setHex(f.day?0xffd9a7:0xb8c9bc);f.light.intensity=on?level:.01;f.panel.material.emissive.setHex(on?0x17231b:0x030403);}const residential=player.pos.y>4;player.zone=residential?'residential':'service';sun.intensity=residential?1.9:.05;hemi.intensity=residential?.72:.34;if(game.event!=='active'){scene.background.setHex(residential?0x7f9ca8:0x0b0e0c);scene.fog.color.setHex(residential?0x9cadad:0x131713);scene.fog.density=residential?.007:.018;renderer.toneMappingExposure=residential?1.12:.95;}}
function updateHud(){ui.zone.textContent=player.zone==='residential'?'RESIDENTIAL LEVEL 07':'SERVICE LEVEL 06';let obj='FIND THE CERAMIC FUSE';if(game.fuses||machine.slot.userData.data.installed)obj='INSTALL FUSE AND SET BREAKERS 1–0–1';if(game.power&&game.pressure<1)obj='PRESSURIZE THE SHELTER RISER';if(game.pressure===1)obj='EXPLORE BOTH LEVELS · LISTEN FOR ALARM';ui.objective.textContent=obj;ui.status.innerHTML=`POWER: ${game.power?'AUX':'OFF'}<br>RISER: ${Math.round(game.pressure*100)}%<br>LIGHTS: ${game.lightMode.toUpperCase()}<br>EVENT: ${game.event.toUpperCase()}<br>EXPOSURE: ${Math.round(game.exposure*100)}%`;}

let joyX=0,joyY=0,joyId=null,lookId=null,lx=0,ly=0;const keys={};
function moveStick(t){const r=ui.joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=t.clientX-cx,dy=t.clientY-cy,len=Math.hypot(dx,dy),max=r.width*.34,m=Math.min(max,len),nx=len?dx/len:0,ny=len?dy/len:0;joyX=nx*m/max;joyY=ny*m/max;ui.stick.style.transform=`translate(${nx*m}px,${ny*m}px)`;}
function resetStick(){joyX=joyY=0;joyId=null;ui.stick.style.transform='translate(0,0)';}
addEventListener('touchstart',e=>{if(!game.started)return;e.preventDefault();for(const t of e.changedTouches){const el=document.elementFromPoint(t.clientX,t.clientY);if(el?.closest('#buttons'))continue;if(t.clientX<innerWidth*.44&&joyId===null){joyId=t.identifier;moveStick(t);}else if(lookId===null){lookId=t.identifier;lx=t.clientX;ly=t.clientY;}}},{passive:false});
addEventListener('touchmove',e=>{if(!game.started)return;e.preventDefault();for(const t of e.changedTouches){if(t.identifier===joyId)moveStick(t);if(t.identifier===lookId){const dx=t.clientX-lx,dy=t.clientY-ly;lx=t.clientX;ly=t.clientY;player.yaw+=dx*.0037;player.pitch=THREE.MathUtils.clamp(player.pitch-dy*.003,-1.05,.7);}}},{passive:false});
addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===joyId)resetStick();if(t.identifier===lookId)lookId=null;}});addEventListener('touchcancel',()=>{resetStick();lookId=null;});
function bindButton(el,down,up){el.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();down();},{passive:false});el.addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();up?.();},{passive:false});el.addEventListener('click',e=>{e.preventDefault();down();up?.();});}
bindButton(ui.use,use);bindButton(ui.lamp,toggleLamp);bindButton(ui.run,()=>{game.run=true;ui.run.classList.add('active');},()=>{game.run=false;ui.run.classList.remove('active');});
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')use();if(e.code==='KeyF')toggleLamp();});addEventListener('keyup',e=>keys[e.code]=false);
ui.startBtn.onclick=()=>{game.started=true;ui.start.style.display='none';initAudio();say('FIND THE CERAMIC FUSE');};

let last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(game.started){let f=-joyY+(keys.KeyW?1:0)-(keys.KeyS?1:0),s=joyX+(keys.KeyD?1:0)-(keys.KeyA?1:0);const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}const running=(game.run||keys.ShiftLeft)&&player.stamina>.05;player.stamina=THREE.MathUtils.clamp(player.stamina+(running?-dt*.22:dt*.16),0,1);const speed=3.5*(running?1.55:1),sn=Math.sin(player.yaw),cs=Math.cos(player.yaw),dx=(s*cs+f*sn)*speed*dt,dz=(s*-sn+f*cs)*speed*dt;const nx=player.pos.clone();nx.x+=dx;nx.y=floorHeight(nx.x,nx.z)+1.67;if(!blocked(nx))player.pos.copy(nx);const nz=player.pos.clone();nz.z+=dz;nz.y=floorHeight(nz.x,nz.z)+1.67;if(!blocked(nz))player.pos.copy(nz);camera.position.copy(player.pos);camera.rotation.set(player.pitch,player.yaw,0);updateAim();updateEvent(dt);updateLighting(dt,now);updateHud();}renderer.render(scene,camera);}frame(last);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});