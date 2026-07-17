import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const $=id=>document.getElementById(id);
const ui={start:$('startScreen'),startBtn:$('startBtn'),zone:$('zone'),objective:$('objective'),status:$('topRight'),alarm:$('alarm'),prompt:$('prompt'),message:$('message'),damage:$('damage'),joy:$('joystick'),stick:$('stick'),lamp:$('lampBtn'),use:$('useBtn')};

const scene=new THREE.Scene();scene.background=new THREE.Color(0x080a09);scene.fog=new THREE.FogExp2(0x111511,.015);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.06,260);camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;document.body.prepend(renderer.domElement);
const hemi=new THREE.HemisphereLight(0xaab7ad,0x0e110f,.38);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffd49c,1.9);sun.position.set(-25,35,20);scene.add(sun);

const M={
 concrete:new THREE.MeshStandardMaterial({color:0x555a54,roughness:1}),
 darkConcrete:new THREE.MeshStandardMaterial({color:0x272c28,roughness:1}),
 floor:new THREE.MeshStandardMaterial({color:0x262925,roughness:.98}),
 steel:new THREE.MeshStandardMaterial({color:0x48504b,roughness:.62,metalness:.42}),
 rust:new THREE.MeshStandardMaterial({color:0x68473a,roughness:.85,metalness:.2}),
 pipe:new THREE.MeshStandardMaterial({color:0x394740,roughness:.75,metalness:.4}),
 warmWall:new THREE.MeshStandardMaterial({color:0xa69a82,roughness:.95}),
 warmFloor:new THREE.MeshStandardMaterial({color:0x766e60,roughness:.95}),
 wood:new THREE.MeshStandardMaterial({color:0x6b4d36,roughness:.95}),
 fabric:new THREE.MeshStandardMaterial({color:0x5a5852,roughness:1}),
 glass:new THREE.MeshStandardMaterial({color:0x8fc6de,roughness:.16,emissive:0x193743,transparent:true,opacity:.82}),
 lamp:new THREE.MeshStandardMaterial({color:0xd8e4d9,emissive:0x1c2a20})
};

const colliders=[],interactables=[],zoneLights=[];
function box(x,y,z,w,h,d,mat=M.concrete,solid=true,parent=scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);if(solid)colliders.push({mesh:m,enabled:true});return m;}
function pipe(x,y,z,len,axis='z'){const g=new THREE.CylinderGeometry(.09,.09,len,10),m=new THREE.Mesh(g,M.pipe);m.position.set(x,y,z);if(axis==='z')m.rotation.x=Math.PI/2;else if(axis==='x')m.rotation.z=Math.PI/2;scene.add(m);return m;}
function addLight(x,y,z,color,intensity,range,kind='service'){const l=new THREE.PointLight(color,intensity,range,2);l.position.set(x,y,z);scene.add(l);zoneLights.push({l,kind,base:intensity,phase:Math.random()*10});box(x,y+.12,z,1.6,.08,.28,M.lamp,false);}
function makeDoor(x,y,z,side,label='OPEN DOOR'){
 const pivot=new THREE.Group();pivot.position.set(x,y,z);scene.add(pivot);
 const slab=box(0,1.2,side*.72,.13,2.4,1.45,M.steel,false,pivot);
 const col={mesh:slab,enabled:true};colliders.push(col);
 slab.userData={type:'door',label,data:{pivot,slab,col,open:false,side}};interactables.push(slab);
 return slab;
}
function sign(text,x,y,z,ry=0,s=.55){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle='#d7d1b5';g.fillRect(0,0,512,128);g.strokeStyle='#252925';g.lineWidth=12;g.strokeRect(6,6,500,116);g.fillStyle='#242824';g.font='bold 48px monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,64);const t=new THREE.CanvasTexture(c);const m=new THREE.Mesh(new THREE.PlaneGeometry(2.8*s,.7*s),new THREE.MeshBasicMaterial({map:t}));m.position.set(x,y,z);m.rotation.y=ry;scene.add(m);}

function corridor(z0,z1,y,bright=false){
 const len=z1-z0,cz=(z0+z1)/2,wall=bright?M.warmWall:M.concrete,floor=bright?M.warmFloor:M.floor;
 box(0,y,cz,7,.18,len,floor);box(0,y+3.2,cz,7,.18,len,bright?M.warmWall:M.darkConcrete);
 box(-3.4,y+1.6,cz,.18,3.2,len,wall);box(3.4,y+1.6,cz,.18,3.2,len,wall);
 for(let z=z0+4,i=0;z<z1;z+=8,i++)addLight(0,y+2.72,z,bright?0xffd6a3:0xc3d0c5,bright?1.25:.52,bright?15:11,bright?'upper':'service');
}
function sideRoom(side,z,y,bright=false,index=0){
 const sx=side*6.3,wall=bright?M.warmWall:M.concrete,floor=bright?M.warmFloor:M.floor;
 box(sx,y,z,5.8,.18,7,floor);box(sx,y+3.2,z,5.8,.18,7,wall);box(side*9.1,y+1.6,z,.18,3.2,7,wall);box(sx,y+1.6,z-3.4,5.8,3.2,.18,wall);box(sx,y+1.6,z+3.4,5.8,3.2,.18,wall);
 box(side*3.48,y+1.6,z-2.25,.18,3.2,2.1,wall);box(side*3.48,y+1.6,z+2.25,.18,3.2,2.1,wall);
 makeDoor(side*3.42,y,z,side>0?-1:1,bright?'OPEN APARTMENT':'OPEN SHELTER');
 box(sx+side*.55,y+.34,z+1.45,2.3,.52,1.15,M.fabric);box(sx-side*1.55,y+.48,z-1.55,1.1,.95,.65,M.wood);
 if(bright){box(sx-side*.65,y+1.5,z-3.28,2.4,2,.08,M.glass,false);const glow=new THREE.PointLight(0xffd49d,1.6,12,2);glow.position.set(sx,y+1.7,z-2.1);scene.add(glow);}
 else{pipe(sx-side*2.1,y+2.45,z,5.4,'z');box(sx,y+.2,z-2.4,1.2,.35,.8,M.rust);}
 sign(String((bright?700:600)+index),side*3.24,y+2.3,z,side>0?-Math.PI/2:Math.PI/2,.42);
}
function tunnel(x,z0,z1){
 const len=z1-z0,cz=(z0+z1)/2;
 box(x,0,cz,5.2,.16,len,M.floor);box(x,2.7,cz,5.2,.16,len,M.darkConcrete);box(x-2.5,1.35,cz,.16,2.7,len,M.darkConcrete);box(x+2.5,1.35,cz,.16,2.7,len,M.darkConcrete);
 for(let z=z0+5,i=0;z<z1;z+=10,i++)addLight(x,2.3,z,0x9eb0a3,.18,8,'tunnel');
 for(let z=z0+3;z<z1;z+=7){pipe(x-2.05,2.05,z,5,'z');box(x+1.8,.28,z,.75,.45,.75,M.rust);}
}
function stairwell(z){
 const x=0;box(0,2.9,z,7,5.8,9,M.darkConcrete);box(0,0,z,6.6,.18,8,M.floor);box(0,6,z,6.6,.18,8,M.warmFloor);
 for(let i=0;i<15;i++)box(-1.8+i*.25,.12+i*.39,z,2,.22,1.35,M.steel);
 box(2.1,3,z,2.2,.18,8,M.steel);addLight(0,5.35,z,0xffd2a0,1.2,14,'upper');sign('STAIR 6–7',0,4.85,z-4.2,0,.58);
}

corridor(-70,34,0,false);
for(let i=0,z=-60;z<=22;z+=11,i++)sideRoom(i%2?1:-1,z,0,false,i);
tunnel(-7.8,-52,22);tunnel(7.8,-20,48);
box(-5.3,1.35,-38,5,.18,2.4,M.darkConcrete);box(5.3,1.35,6,5,.18,2.4,M.darkConcrete);
stairwell(42);
corridor(34,108,6,true);
for(let i=0,z=50;z<=96;z+=11,i++)sideRoom(i%2?-1:1,z,6,true,i);
box(0,6,106,18,.18,12,M.warmFloor);box(0,9.2,106,18,.18,12,M.warmWall);box(-9,7.6,106,.18,3.2,12,M.warmWall);box(9,7.6,106,.18,3.2,12,M.warmWall);box(0,7.6,112,18,3.2,.18,M.glass,false);addLight(0,8.7,106,0xffd18f,2.2,20,'upper');sign('SUN GALLERY',0,8.8,100,0,.7);

const player={pos:new THREE.Vector3(0,1.67,-64),yaw:0,pitch:-.03,radius:.34,zone:'service'};
const ray=new THREE.Raycaster(),tempBox=new THREE.Box3();let aimed=null,started=false,lampOn=true;
const flashlight=new THREE.SpotLight(0xf7fff4,11.5,42,.5,.45,1.05);flashlight.position.set(0,0,0);flashlight.target.position.set(0,0,-3);camera.add(flashlight,flashlight.target);scene.add(camera);
function floorAt(x,z){if(z>37&&z<47&&x>-2.2&&x<2.2)return THREE.MathUtils.clamp((x+1.8)/3.6,0,1)*6;return player.pos.y>4?6:0;}
function blocked(p){const s=new THREE.Sphere(new THREE.Vector3(p.x,p.y-.65,p.z),player.radius);for(const c of colliders){if(!c.enabled)continue;tempBox.setFromObject(c.mesh);if(tempBox.intersectsSphere(s))return true;}return false;}
function use(){if(!aimed)return;const d=aimed.userData.data;if(aimed.userData.type==='door'){d.open=!d.open;d.pivot.rotation.y=d.open*(d.side>0?1.48:-1.48);d.col.enabled=!d.open;aimed.userData.label=d.open?'CLOSE DOOR':'OPEN DOOR';}}
function updateAim(){ray.setFromCamera({x:0,y:0},camera);const hit=ray.intersectObjects(interactables,false).find(h=>h.distance<3.6);aimed=hit?.object||null;ui.prompt.style.display=aimed?'block':'none';if(aimed)ui.prompt.textContent=`[ USE ] ${aimed.userData.label}`;}
function toggleLamp(){lampOn=!lampOn;flashlight.visible=lampOn;ui.lamp.textContent=lampOn?'LAMP':'LAMP OFF';ui.lamp.classList.toggle('lamp-off',!lampOn);}
function updateWorld(now){const upper=player.pos.y>4;player.zone=upper?'upper':(Math.abs(player.pos.x)>4.8?'tunnel':'service');ui.zone.textContent=player.zone==='upper'?'RESIDENTIAL LEVEL 07':player.zone==='tunnel'?'MAINTENANCE TUNNELS':'SERVICE LEVEL 06';ui.objective.textContent=upper?'EXPLORE THE SUNLIT APARTMENTS':'FIND THE STAIRWELL TO LEVEL 07';ui.status.innerHTML=`ZONE: ${player.zone.toUpperCase()}<br>LAMP: ${lampOn?'ON':'OFF'}<br>MAP: EXPANDED`;for(const q of zoneLights){let v=q.base;if(q.kind==='tunnel')v*=Math.sin(now*.018+q.phase)>.3?1:.08;q.l.intensity=v;}sun.intensity=upper?2.1:.04;hemi.intensity=upper?.72:.3;scene.background.setHex(upper?0x839fa9:0x080a09);scene.fog.color.setHex(upper?0xa5b6b4:0x111511);scene.fog.density=upper?.0065:.015;renderer.toneMappingExposure=upper?1.13:.95;}

let joyX=0,joyY=0,joyId=null,lookId=null,lx=0,ly=0;const keys={};
function moveStick(t){const r=ui.joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=t.clientX-cx,dy=t.clientY-cy,len=Math.hypot(dx,dy),max=r.width*.34,m=Math.min(max,len),nx=len?dx/len:0,ny=len?dy/len:0;joyX=nx*m/max;joyY=ny*m/max;ui.stick.style.transform=`translate(${nx*m}px,${ny*m}px)`;}
function resetStick(){joyX=joyY=0;joyId=null;ui.stick.style.transform='translate(0,0)';}
addEventListener('touchstart',e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){const el=document.elementFromPoint(t.clientX,t.clientY);if(el?.closest('#buttons'))continue;if(t.clientX<innerWidth*.44&&joyId===null){joyId=t.identifier;moveStick(t);}else if(lookId===null){lookId=t.identifier;lx=t.clientX;ly=t.clientY;}}},{passive:false});
addEventListener('touchmove',e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){if(t.identifier===joyId)moveStick(t);if(t.identifier===lookId){const dx=t.clientX-lx,dy=t.clientY-ly;lx=t.clientX;ly=t.clientY;player.yaw-=dx*.0037;player.pitch=THREE.MathUtils.clamp(player.pitch+dy*.003,-1.05,.7);}}},{passive:false});
addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===joyId)resetStick();if(t.identifier===lookId)lookId=null;}});addEventListener('touchcancel',()=>{resetStick();lookId=null;});
function bind(el,fn){el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fn();});}bind(ui.use,use);bind(ui.lamp,toggleLamp);
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyE')use();if(e.code==='KeyF')toggleLamp();});addEventListener('keyup',e=>keys[e.code]=false);
ui.startBtn.onclick=()=>{started=true;ui.start.style.display='none';};
let last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(started){let f=-joyY+(keys.KeyW?1:0)-(keys.KeyS?1:0),s=joyX+(keys.KeyD?1:0)-(keys.KeyA?1:0);const n=Math.hypot(f,s);if(n>1){f/=n;s/=n;}const speed=6.4,sn=Math.sin(player.yaw),cs=Math.cos(player.yaw),dx=(s*cs-f*sn)*speed*dt,dz=(-s*sn-f*cs)*speed*dt;const px=player.pos.clone();px.x+=dx;px.y=floorAt(px.x,px.z)+1.67;if(!blocked(px))player.pos.copy(px);const pz=player.pos.clone();pz.z+=dz;pz.y=floorAt(pz.x,pz.z)+1.67;if(!blocked(pz))player.pos.copy(pz);camera.position.copy(player.pos);camera.rotation.set(player.pitch,player.yaw,0);updateAim();updateWorld(now);}renderer.render(scene,camera);}frame(last);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});