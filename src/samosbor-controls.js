(()=>{
  const joy=document.getElementById('joystick');
  const stick=document.getElementById('stick');
  if(!joy||!stick)return;

  const active=new Set();
  let pointerId=null;

  const send=(code,down)=>{
    if(down){
      if(active.has(code))return;
      active.add(code);
      window.dispatchEvent(new KeyboardEvent('keydown',{code,key:code.replace('Key','').toLowerCase(),bubbles:true}));
    }else{
      if(!active.has(code))return;
      active.delete(code);
      window.dispatchEvent(new KeyboardEvent('keyup',{code,key:code.replace('Key','').toLowerCase(),bubbles:true}));
    }
  };

  const releaseAll=()=>{
    for(const code of [...active])send(code,false);
    stick.style.transform='translate(0px,0px)';
  };

  const update=(clientX,clientY)=>{
    const r=joy.getBoundingClientRect();
    const cx=r.left+r.width/2;
    const cy=r.top+r.height/2;
    let dx=clientX-cx;
    let dy=clientY-cy;
    const max=r.width*.34;
    const len=Math.hypot(dx,dy)||1;
    if(len>max){dx=dx/len*max;dy=dy/len*max;}
    const nx=dx/max;
    const ny=dy/max;
    stick.style.transform=`translate(${dx}px,${dy}px)`;
    const dead=.18;
    send('KeyW',ny<-dead);
    send('KeyS',ny>dead);
    send('KeyA',nx<-dead);
    send('KeyD',nx>dead);
  };

  joy.style.touchAction='none';
  joy.addEventListener('pointerdown',e=>{
    e.preventDefault();
    e.stopPropagation();
    pointerId=e.pointerId;
    joy.setPointerCapture?.(pointerId);
    update(e.clientX,e.clientY);
  });
  joy.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointerId)return;
    e.preventDefault();
    e.stopPropagation();
    update(e.clientX,e.clientY);
  });
  const end=e=>{
    if(pointerId!==null&&e.pointerId!==pointerId)return;
    e.preventDefault();
    e.stopPropagation();
    pointerId=null;
    releaseAll();
  };
  joy.addEventListener('pointerup',end);
  joy.addEventListener('pointercancel',end);
  joy.addEventListener('lostpointercapture',()=>{pointerId=null;releaseAll();});
  window.addEventListener('blur',releaseAll);
})();