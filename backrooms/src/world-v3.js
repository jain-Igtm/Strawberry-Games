export const CELL=4;
export const GRID=12;
export const CHUNK=CELL*GRID;
export const WALL_H=3.25;
export const EYE_H=1.67;
export const LOAD_RADIUS=2;
export const PLAYER_RADIUS=.34;
export const WALK_SPEED=6.4;
export const RUN_SPEED=9;
const KEEP_DATA=180;
const WORLD_SEED=0x41a7f29d;

export const THEMES=[
 {id:'classic',name:'LEVEL 0 // YELLOW ROOMS',weight:32,wall:0xcac078,floor:0x7f7041,ceiling:0xd9d3a0,light:0xfff6bc,fog:0x9f955f,carpet:true},
 {id:'pool',name:'POOL ROOMS',weight:15,wall:0xc7e8e3,floor:0x7ed3d7,ceiling:0xe8fbf5,light:0xc8ffff,fog:0x8fc9cb,water:true},
 {id:'play',name:'PASTEL PLAYROOMS',weight:13,wall:0xf0b6c7,floor:0xb3d9c2,ceiling:0xffe6b8,light:0xffddda,fog:0xc9b1b6,slides:true},
 {id:'service',name:'SERVICE LEVEL',weight:16,wall:0x696b68,floor:0x343532,ceiling:0x4b4d48,light:0xd9d3b5,fog:0x343531,pipes:true},
 {id:'gallery',name:'LIMINAL GALLERY',weight:13,wall:0xd6d0c8,floor:0x8e887f,ceiling:0xefebe4,light:0xf7f1db,fog:0xb2aca2,tall:true},
 {id:'mint',name:'MINT HALLS',weight:11,wall:0xa9cbbb,floor:0x6f8d80,ceiling:0xd7e6dd,light:0xd8fff0,fog:0x7f9d91}
];

const dataCache=new Map();
export function mix32(x){x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return(x^(x>>>16))>>>0;}
export function hash2(x,z,salt=0){return mix32((Math.imul(x|0,0x1f123bb5)^Math.imul(z|0,0x6c8e9cf5)^WORLD_SEED^salt)>>>0);}
export function mulberry32(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
export function chunkKey(cx,cz){return`${cx},${cz}`;}
export function cellIndex(x,z){return z*GRID+x;}
function shuffle(arr,rng){for(let i=arr.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function chooseTheme(cx,cz){const bx=Math.floor(cx/3),bz=Math.floor(cz/3);let roll=(hash2(bx,bz,0x9911)/4294967296)*100;for(const t of THEMES){if((roll-=t.weight)<0)return t;}return THEMES[0];}
function sharedGate(cx,cz,side){if(side==='N')return 2+(hash2(cx,cz-1,0x1001)%(GRID-4));if(side==='S')return 2+(hash2(cx,cz,0x1001)%(GRID-4));if(side==='W')return 2+(hash2(cx-1,cz,0x2002)%(GRID-4));return 2+(hash2(cx,cz,0x2002)%(GRID-4));}
function carvePath(grid,x0,z0,x1,z1,rng,width=1){let x=x0,z=z0;const carve=(cx,cz)=>{for(let dz=-width+1;dz<width;dz++)for(let dx=-width+1;dx<width;dx++){const nx=cx+dx,nz=cz+dz;if(nx>=0&&nx<GRID&&nz>=0&&nz<GRID)grid[cellIndex(nx,nz)]=1;}};carve(x,z);const stepX=()=>{while(x!==x1){x+=Math.sign(x1-x);carve(x,z);}},stepZ=()=>{while(z!==z1){z+=Math.sign(z1-z);carve(x,z);}};if(rng()>.5){stepX();stepZ();}else{stepZ();stepX();}}
function carveRect(grid,x,z,w,h){for(let zz=z;zz<z+h;zz++)for(let xx=x;xx<x+w;xx++)if(xx>=0&&xx<GRID&&zz>=0&&zz<GRID)grid[cellIndex(xx,zz)]=1;}
function isOpen(grid,x,z){return x>=0&&z>=0&&x<GRID&&z<GRID&&!!grid[cellIndex(x,z)];}
function isRoomInterior(grid,x,z){return isOpen(grid,x,z)&&isOpen(grid,x-1,z)&&isOpen(grid,x+1,z)&&isOpen(grid,x,z-1)&&isOpen(grid,x,z+1);}

function candidateCells(data){const cells=[];for(let z=1;z<GRID-1;z++)for(let x=1;x<GRID-1;x++){if(!isRoomInterior(data.grid,x,z))continue;if(Math.abs(x-data.center.x)<=1&&Math.abs(z-data.center.z)<=1)continue;cells.push({x,z,wx:(x+.5)*CELL,wz:(z+.5)*CELL});}return cells;}
function addObstacle(data,x,z,hx,hz){data.obstacles.push({x,z,hx,hz});}
function takeCell(cells,rng){if(!cells.length)return null;return cells.splice(Math.floor(rng()*cells.length),1)[0];}
function placeBox(data,cells,rng,list,type,w,d,h,count=1,obstacle=true){for(let i=0;i<count;i++){const c=takeCell(cells,rng);if(!c)return;const rot=rng()>.5?0:Math.PI/2,ww=rot?d:w,dd=rot?w:d;list.push({type,x:c.wx+(rng()-.5)*.5,z:c.wz+(rng()-.5)*.5,y:h/2,w,d,h,rot});if(obstacle)addObstacle(data,c.wx,c.wz,ww*.5,dd*.5);}}
function makeWallSign(data,rng,art=false){const side=Math.floor(rng()*4),along=1.5+rng()*(CHUNK-3),y=art?2.35:1.75;if(side===0)return{type:art?'art':'sign',x:along,z:.12,y,rot:0};if(side===1)return{type:art?'art':'sign',x:along,z:CHUNK-.12,y,rot:Math.PI};if(side===2)return{type:art?'art':'sign',x:.12,z:along,y,rot:-Math.PI/2};return{type:art?'art':'sign',x:CHUNK-.12,z:along,y,rot:Math.PI/2};}
function makeDecorPlan(data){
 const rng=mulberry32(data.decorSeed),cells=shuffle(candidateCells(data),rng),p={boxes:[],cylinders:[],planes:[],signs:[],slides:[],pools:[]},id=data.theme.id;
 if(id==='classic'){
  placeBox(data,cells,rng,p.boxes,'desk',2.1,1.05,.78,2+Math.floor(rng()*3));placeBox(data,cells,rng,p.boxes,'cabinet',.72,.55,1.55,2+Math.floor(rng()*4));placeBox(data,cells,rng,p.boxes,'chair',.7,.7,.82,3+Math.floor(rng()*4));
  for(let i=0;i<5+Math.floor(rng()*7);i++){const c=takeCell(cells,rng);if(!c)break;p.planes.push({type:'stain',x:c.wx+(rng()-.5)*1.6,z:c.wz+(rng()-.5)*1.6,y:.075,w:.7+rng()*1.9,d:.5+rng()*1.5,rot:rng()*Math.PI});}
  for(let i=0;i<2+Math.floor(rng()*4);i++)p.signs.push(makeWallSign(data,rng));
 }else if(id==='pool'){
  placeBox(data,cells,rng,p.boxes,'poolBench',2.4,.55,.5,1+Math.floor(rng()*3));placeBox(data,cells,rng,p.boxes,'towelCart',1.05,.72,1.05,1+Math.floor(rng()*2));
  for(let i=0;i<2+Math.floor(rng()*3);i++){const c=takeCell(cells,rng);if(!c)break;p.cylinders.push({type:'ladder',x:c.wx,z:c.wz,rot:rng()>.5?0:Math.PI/2});}
  for(let i=0;i<2;i++){const c=takeCell(cells,rng);if(!c)break;p.pools.push({x:c.wx,z:c.wz,w:3.25+rng()*.4,d:3.25+rng()*.4});}
  for(let i=0;i<3+Math.floor(rng()*4);i++){const c=takeCell(cells,rng);if(!c)break;p.planes.push({type:'drain',x:c.wx+(rng()-.5)*1.2,z:c.wz+(rng()-.5)*1.2,y:.08,w:.38,d:.38,rot:0});}
 }else if(id==='play'){
  placeBox(data,cells,rng,p.boxes,'foamBlock',.8,.8,.8,5+Math.floor(rng()*5));placeBox(data,cells,rng,p.boxes,'playBench',2,.7,.55,1+Math.floor(rng()*2));
  for(let i=0;i<2+Math.floor(rng()*3);i++){const c=takeCell(cells,rng);if(!c)break;p.cylinders.push({type:'tunnel',x:c.wx,z:c.wz,y:.72,r:.72,rot:rng()>.5?0:Math.PI/2});addObstacle(data,c.wx,c.wz,.78,.78);}const c=takeCell(cells,rng);if(c)p.slides.push({x:c.wx,z:c.wz,rot:rng()*Math.PI*2});
 }else if(id==='service'){
  placeBox(data,cells,rng,p.boxes,'machine',1.7,1.25,1.65,2+Math.floor(rng()*3));placeBox(data,cells,rng,p.boxes,'locker',.72,.55,1.85,3+Math.floor(rng()*4));placeBox(data,cells,rng,p.boxes,'crate',.95,.95,.8,3+Math.floor(rng()*4));
  for(let i=0;i<7+Math.floor(rng()*5);i++)p.cylinders.push({type:'pipe',x:1+rng()*(CHUNK-2),z:1+rng()*(CHUNK-2),y:2.7+rng()*.2,r:.08+rng()*.07,h:4+rng()*3,rot:rng()>.5?0:Math.PI/2});
 }else if(id==='gallery'){
  placeBox(data,cells,rng,p.boxes,'galleryBench',2.6,.7,.52,2+Math.floor(rng()*3));placeBox(data,cells,rng,p.boxes,'planter',1.05,1.05,.72,2+Math.floor(rng()*2));placeBox(data,cells,rng,p.boxes,'plinth',.85,.85,1.05,1+Math.floor(rng()*3));for(let i=0;i<4+Math.floor(rng()*5);i++)p.signs.push(makeWallSign(data,rng,true));
 }else{
  placeBox(data,cells,rng,p.boxes,'mintBench',2.15,.68,.52,2+Math.floor(rng()*2));placeBox(data,cells,rng,p.boxes,'utilityCart',1.15,.7,.92,2+Math.floor(rng()*2));placeBox(data,cells,rng,p.boxes,'cabinetMint',.8,.55,1.65,2+Math.floor(rng()*3));for(let i=0;i<2+Math.floor(rng()*3);i++)p.signs.push(makeWallSign(data,rng));
 }
 return p;
}

export function generateChunkData(cx,cz){
 const key=chunkKey(cx,cz);if(dataCache.has(key)){const cached=dataCache.get(key);dataCache.delete(key);dataCache.set(key,cached);return cached;}
 const rng=mulberry32(hash2(cx,cz,0xabc123)),theme=chooseTheme(cx,cz),grid=new Uint8Array(GRID*GRID),gates={N:sharedGate(cx,cz,'N'),S:sharedGate(cx,cz,'S'),W:sharedGate(cx,cz,'W'),E:sharedGate(cx,cz,'E')},center={x:Math.floor(GRID/2),z:Math.floor(GRID/2)};
 carveRect(grid,center.x-1,center.z-1,3,3);carvePath(grid,gates.N,0,center.x,center.z,rng,theme.id==='gallery'?2:1);carvePath(grid,gates.S,GRID-1,center.x,center.z,rng);carvePath(grid,0,gates.W,center.x,center.z,rng);carvePath(grid,GRID-1,gates.E,center.x,center.z,rng);
 const roomCount=theme.id==='pool'?6:theme.id==='classic'?9:7;for(let i=0;i<roomCount;i++){const w=2+Math.floor(rng()*(theme.id==='pool'?6:4)),h=2+Math.floor(rng()*(theme.id==='pool'?6:4)),x=1+Math.floor(rng()*Math.max(1,GRID-w-2)),z=1+Math.floor(rng()*Math.max(1,GRID-h-2));carveRect(grid,x,z,w,h);carvePath(grid,x+Math.floor(w/2),z+Math.floor(h/2),center.x,center.z,rng);}
 if(theme.id==='classic')for(let i=0;i<5;i++){const x=1+Math.floor(rng()*(GRID-3)),z=1+Math.floor(rng()*(GRID-3));carveRect(grid,x,z,2+Math.floor(rng()*3),1+Math.floor(rng()*2));carvePath(grid,x,z,center.x,center.z,rng);}
 const data={cx,cz,key,theme,grid,gates,center,decorSeed:hash2(cx,cz,0x51eed),obstacles:[],decor:null};data.decor=makeDecorPlan(data);dataCache.set(key,data);if(dataCache.size>KEEP_DATA)dataCache.delete(dataCache.keys().next().value);return data;
}
function floorAtWorld(x,z){const cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK),lx=x-cx*CHUNK,lz=z-cz*CHUNK,gx=Math.floor(lx/CELL),gz=Math.floor(lz/CELL);if(gx<0||gz<0||gx>=GRID||gz>=GRID)return false;return!!generateChunkData(cx,cz).grid[cellIndex(gx,gz)];}
function hitsObstacle(x,z){const ccx=Math.floor(x/CHUNK),ccz=Math.floor(z/CHUNK);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const data=generateChunkData(ccx+dx,ccz+dz),ox=data.cx*CHUNK,oz=data.cz*CHUNK;for(const o of data.obstacles)if(Math.abs(x-(ox+o.x))<o.hx+PLAYER_RADIUS&&Math.abs(z-(oz+o.z))<o.hz+PLAYER_RADIUS)return true;}return false;}
export function canStand(x,z){const r=PLAYER_RADIUS;return!hitsObstacle(x,z)&&floorAtWorld(x-r,z-r)&&floorAtWorld(x+r,z-r)&&floorAtWorld(x-r,z+r)&&floorAtWorld(x+r,z+r);}
