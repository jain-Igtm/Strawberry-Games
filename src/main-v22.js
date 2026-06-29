import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const title = document.getElementById("title");
const hint = document.getElementById("hint");
const coords = document.getElementById("coords");
const overlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");

if (title) title.textContent = "STRAWBERRY FOREST";
if (hint) hint.textContent = "Update 22 loaded. Stable terrain build.";
if (startBtn) startBtn.textContent = "Start";

let started = false;
function startGame() {
  started = true;
  if (overlay) overlay.style.display = "none";
  if (hint) setTimeout(() => hint.style.opacity = "0", 2500);
}
if (startBtn) {
  startBtn.onclick = startGame;
  startBtn.addEventListener("touchstart", e => { e.preventDefault(); e.stopPropagation(); startGame(); }, { passive:false });
}

window.addEventListener("error", e => { if (hint) hint.textContent = "Runtime error: " + e.message; });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88b9dd);
scene.fog = new THREE.FogExp2(0x88b9dd, 0.0042);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 1800);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:"high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdcefff, 0x2d432c, 1.55));
const sun = new THREE.DirectionalLight(0xffdca3, 2.45);
sun.position.set(-120, 160, 80);
scene.add(sun);
scene.add(sun.target);

function tex(a,b,c){
  const can=document.createElement("canvas"),g=can.getContext("2d");
  can.width=can.height=128; g.fillStyle=a; g.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=6){g.globalAlpha=.18;g.fillStyle=y%18?b:c;g.fillRect(0,y,128,2+(y%4));}
  for(let i=0;i<350;i++){g.globalAlpha=.08+Math.random()*.18;g.fillStyle=Math.random()>.5?b:c;g.fillRect(Math.random()*128,Math.random()*128,1+Math.random()*2,1+Math.random()*2);}
  const t=new THREE.CanvasTexture(can);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(42,42);t.magFilter=THREE.NearestFilter;return t;
}
const grassTex=tex("#476d35","#698349","#243b27");
const groundMat=new THREE.MeshStandardMaterial({map:grassTex,vertexColors:true,roughness:1});
const pathMat=new THREE.MeshStandardMaterial({color:0x806a4d,roughness:1});
const waterMat=new THREE.MeshStandardMaterial({color:0x3f7d93,transparent:true,opacity:.58,roughness:.45});
const trunkMat=new THREE.MeshStandardMaterial({color:0x53331e,roughness:1});
const rockMat=new THREE.MeshStandardMaterial({color:0x777a73,roughness:1,flatShading:true});
const leafMats=[0x15321e,0x1e4528,0x0f2b1a,0x264d2e].map(x=>new THREE.MeshStandardMaterial({color:x,roughness:1,flatShading:true}));

function hash(x,z){let n=(Math.floor(x)*374761393+Math.floor(z)*668265263)|0;n=(n^(n>>13))*1274126177;return ((n^(n>>16))>>>0)/4294967295;}
function sm(t){return t*t*(3-2*t);}
function noise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=sm(xf),v=sm(zf);const a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,u),THREE.MathUtils.lerp(c,d,u),v);}
function pathZ(x){return Math.sin(x*.014)*28+Math.sin(x*.004+1.1)*48;}
function pathBlend(x,z){return THREE.MathUtils.clamp(1-Math.abs(z-pathZ(x))/12,0,1);}
function lakeBlend(x,z){return THREE.MathUtils.clamp(1-Math.hypot(x+170,z-80)/95,0,1);}
function heightAt(x,z){
  let y=(noise(x*.006,z*.006)-.5)*22+(noise(x*.025+80,z*.025-31)-.5)*7;
  const ridge=Math.pow(1-Math.abs(noise(x*.006-8,z*.006+12)*2-1),2.2);
  const far=THREE.MathUtils.clamp((Math.hypot(x+120,z-320)-80)/250,0,1);
  y+=ridge*44*far;
  y=THREE.MathUtils.lerp(y,.35,pathBlend(x,z));
  y=THREE.MathUtils.lerp(y,-1.4,lakeBlend(x,z));
  return y;
}
function colorAt(x,z,y){const col=new THREE.Color(y>12?0x747b75:y>6?0x536c41:0x496f34);col.lerp(new THREE.Color(0x80684a),pathBlend(x,z));col.lerp(new THREE.Color(0x3e5a39),lakeBlend(x,z)*.7);return col;}

const size=1450, seg=150;
const geo=new THREE.PlaneGeometry(size,size,seg,seg); geo.rotateX(-Math.PI/2);
const p=geo.attributes.position, colors=[];
for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=heightAt(x,z);p.setY(i,y);const c=colorAt(x,z,y);colors.push(c.r,c.g,c.b);} 
geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3)); geo.computeVertexNormals();
const ground=new THREE.Mesh(geo,groundMat); scene.add(ground);

const pathGeo=new THREE.PlaneGeometry(size,8.5,160,1); pathGeo.rotateX(-Math.PI/2);
const pp=pathGeo.attributes.position;
for(let i=0;i<pp.count;i++){const x=pp.getX(i),lat=pp.getZ(i),z=pathZ(x)+lat;pp.setZ(i,z);pp.setY(i,heightAt(x,z)+.05);} pathGeo.computeVertexNormals();
scene.add(new THREE.Mesh(pathGeo,pathMat));

const water=new THREE.Mesh(new THREE.CircleGeometry(110,48),waterMat); water.rotation.x=-Math.PI/2; water.position.set(-170,-1.05,80); scene.add(water);

const trunkGeo=new THREE.CylinderGeometry(.28,.62,8,7);
const lowGeo=new THREE.ConeGeometry(3.2,6.4,9),midGeo=new THREE.ConeGeometry(2.35,5.2,9),topGeo=new THREE.ConeGeometry(1.35,3.7,8);
const trees=520;
const trunks=new THREE.InstancedMesh(trunkGeo,trunkMat,trees),lows=new THREE.InstancedMesh(lowGeo,leafMats[0],trees),mids=new THREE.InstancedMesh(midGeo,leafMats[1],trees),tops=new THREE.InstancedMesh(topGeo,leafMats[2],trees);
const tmp=new THREE.Object3D(); let ti=0;
function place(mesh,i,x,y,z,s,ry){tmp.position.set(x,y,z);tmp.rotation.set(0,ry,0);tmp.scale.set(s,s,s);tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix);}
for(let i=0;i<trees;i++){const x=(hash(i,1)-.5)*size*.92,z=(hash(i,2)-.5)*size*.92,y=heightAt(x,z);if(pathBlend(x,z)>.18||lakeBlend(x,z)>.05||y>11||Math.hypot(x,z)<18)continue;const s=.65+hash(i,3)*1.25,r=hash(i,4)*6.28;place(trunks,ti,x,y+4*s,z,s,r);place(lows,ti,x,y+8.2*s,z,s,r);place(mids,ti,x,y+11*s,z,s,r+.4);place(tops,ti,x,y+13*s,z,s,r+.8);ti++;}
trunks.count=lows.count=mids.count=tops.count=ti; scene.add(trunks,lows,mids,tops);

const rockGeo=new THREE.DodecahedronGeometry(1,0); const rocks=new THREE.InstancedMesh(rockGeo,rockMat,160);
for(let i=0;i<160;i++){const x=(hash(i,11)-.5)*size*.9,z=(hash(i,12)-.5)*size*.9,y=heightAt(x,z),s=.2+hash(i,13)*.8;tmp.position.set(x,y+s*.35,z);tmp.rotation.set(hash(i,14)*2,hash(i,15)*6.28,hash(i,16)*2);tmp.scale.set(s*1.4,s*.55,s);tmp.updateMatrix();rocks.setMatrixAt(i,tmp.matrix);} scene.add(rocks);

const player={x:9,z:-3,yaw:0,pitch:-.05}; let joyX=0,joyY=0,joyId=null,lookId=null,lx=0,ly=0;
function moveStick(t){const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=t.clientX-cx,dy=t.clientY-cy,len=Math.hypot(dx,dy),max=r.width*.34,m=Math.min(max,len),nx=len?dx/len:0,ny=len?dy/len:0;joyX=nx*m/max;joyY=ny*m/max;stick.style.transform=`translate(${nx*m}px,${ny*m}px)`;}
function resetStick(){joyX=joyY=0;joyId=null;stick.style.transform="translate(0,0)";}
addEventListener("touchstart",e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){if(t.clientX<innerWidth*.44&&joyId===null){joyId=t.identifier;moveStick(t);}else if(lookId===null){lookId=t.identifier;lx=t.clientX;ly=t.clientY;}}},{passive:false});
addEventListener("touchmove",e=>{if(!started)return;e.preventDefault();for(const t of e.changedTouches){if(t.identifier===joyId)moveStick(t);if(t.identifier===lookId){const dx=t.clientX-lx,dy=t.clientY-ly;lx=t.clientX;ly=t.clientY;player.yaw+=dx*.0037;player.pitch=THREE.MathUtils.clamp(player.pitch-dy*.003,-1.05,.65);}}},{passive:false});
addEventListener("touchend",e=>{for(const t of e.changedTouches){if(t.identifier===joyId)resetStick();if(t.identifier===lookId)lookId=null;}});addEventListener("touchcancel",resetStick);

let last=performance.now(); function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(started){const f=-joyY,s=joyX,sp=18,sn=Math.sin(player.yaw),cs=Math.cos(player.yaw);player.x+=(s*cs+f*sn)*sp*dt;player.z+=(s*-sn+f*cs)*sp*dt;}const y=heightAt(player.x,player.z)+4.5;camera.position.set(player.x,y,player.z);camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;sun.position.set(player.x-120,y+160,player.z+80);sun.target.position.set(player.x,y,player.z);if(coords)coords.innerHTML=`x: ${player.x.toFixed(1)}<br>z: ${player.z.toFixed(1)}`;renderer.render(scene,camera);} 
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
frame(performance.now());
