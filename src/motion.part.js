/* Pointer feedback and document transitions share the existing theme ink. */
const interactionMotion=(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const events=new AbortController();
  let canvas,ctx,frame=0,trail=[],blooms=[],card=null;
  let ink='',accent='',paletteTheme,leafSpacing=0,leafIndex=0,pageAnimations=[],ghost=null;
  const cards='.entry-grid a,.article-directory tbody tr,.travel-directory tbody tr';
  function cancelPage(){
    for(const animation of pageAnimations)animation.cancel();
    pageAnimations=[];ghost?.remove();ghost=null;
  }
  function resetCard(){
    if(!card)return;
    card.classList.remove('is-tracking');
    for(const name of ['--tilt-x','--tilt-y','--shine-x','--shine-y'])card.style.removeProperty(name);
    card=null;
  }
  function stopPointer(){
    cancelAnimationFrame(frame);frame=0;trail=[];blooms=[];leafSpacing=0;leafIndex=0;
    ctx?.clearRect(0,0,innerWidth,innerHeight);resetCard();
  }
  function resize(){
    const scale=Math.min(devicePixelRatio,2);
    canvas.width=Math.round(innerWidth*scale);canvas.height=Math.round(innerHeight*scale);
    ctx.setTransform(scale,0,0,scale,0,0);stopPointer();
  }
  function wake(){if(!frame)frame=requestAnimationFrame(draw);}
  function syncPalette(){
    const theme=document.documentElement.dataset.theme||'light';
    if(theme===paletteTheme)return;
    const style=getComputedStyle(document.documentElement);
    ink=style.getPropertyValue('--green').trim();accent=style.getPropertyValue('--orange').trim();
    paletteTheme=theme;
  }
  // A pointed, slightly asymmetric leaf in local coordinates, rooted at (x,y).
  function leaf(x,y,angle,length,width,color){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(0,0);
    ctx.quadraticCurveTo(length*.32,-width,length,0);
    ctx.quadraticCurveTo(length*.55,width*.82,0,0);ctx.fill();ctx.restore();
  }
  function draw(now){
    frame=0;ctx.clearRect(0,0,innerWidth,innerHeight);syncPalette();
    trail=trail.filter(point=>now-point.time<330);
    ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=1;ctx.lineCap='round';
    for(let i=0;i<trail.length;i++){
      const point=trail[i],life=Math.min(1,1-(now-point.time)/330);
      ctx.globalAlpha=.38*life*point.strength;
      if(i&&point.join){
        ctx.beginPath();ctx.moveTo(trail[i-1].x,trail[i-1].y);ctx.lineTo(point.x,point.y);ctx.stroke();
      }
      if(point.leaf){
        ctx.globalAlpha=.78*life*point.strength;
        leaf(point.x,point.y,point.angle,(6+3*life),3.4,point.warm?accent:ink);
      }
    }
    const tip=trail.at(-1);
    if(tip){
      ctx.globalAlpha=.65*tip.strength*Math.min(1,1-(now-tip.time)/330);
      ctx.beginPath();ctx.arc(tip.x,tip.y,1.4,0,Math.PI*2);ctx.fill();
    }
    blooms=blooms.filter(bloom=>now-bloom.time<460);
    for(const bloom of blooms){
      const progress=Math.max(0,(now-bloom.time)/460),open=1-(1-progress)**3;
      for(let i=0;i<6;i++){
        const angle=bloom.angle+i*Math.PI/3+.18*open;
        const radius=(i%2?15:22)*open+2;
        ctx.globalAlpha=(1-progress)**1.4*bloom.strength;
        leaf(bloom.x+Math.cos(angle)*radius,bloom.y+Math.sin(angle)*radius,
          angle+.36*open,(i%2?8:12)*(.4+.6*open),i%2?3:4,i%2?accent:ink);
      }
    }
    ctx.globalAlpha=1;
    if(trail.length||blooms.length)wake();
  }
  function pointerStrength(target){
    const reading=target.closest('#doc-view')&&current.type==='file'&&current.path!=='/空间动态.md';
    return reading||target.closest('.shell-panel,.source-view') ? .36 : 1;
  }
  function move(event){
    if(event.pointerType!=='mouse'||reduced.matches)return;
    const target=event.target,next=target.closest('.interaction-card');
    if(next!==card){resetCard();card=next;}
    if(card){
      const box=card.getBoundingClientRect();
      const x=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width));
      const y=Math.max(0,Math.min(1,(event.clientY-box.top)/box.height));
      card.style.setProperty('--tilt-x',((.5-y)*6).toFixed(2)+'deg');
      card.style.setProperty('--tilt-y',((x-.5)*6).toFixed(2)+'deg');
      card.style.setProperty('--shine-x',(x*100).toFixed(1)+'%');
      card.style.setProperty('--shine-y',(y*100).toFixed(1)+'%');
      card.classList.add('is-tracking');
    }
    const x=event.clientX,y=event.clientY,time=performance.now(),strength=pointerStrength(target);
    const last=trail.at(-1);
    const distance=last?Math.hypot(x-last.x,y-last.y):0;
    const join=last&&time-last.time<120&&distance<140;
    if(join){
      if(distance<2)return;
      const angle=Math.atan2(y-last.y,x-last.x);
      for(let offset=24-leafSpacing;offset<=distance;offset+=24){
        const fraction=offset/distance;
        trail.push({x:last.x+(x-last.x)*fraction,y:last.y+(y-last.y)*fraction,time,strength,join:true,
          leaf:true,angle:angle+(leafIndex%2?1:-1)*2.4,warm:leafIndex%4===3});
        leafIndex++;
      }
      leafSpacing=(leafSpacing+distance)%24;
    }else leafSpacing=0;
    trail.push({x,y,time,strength,join});
    if(trail.length>96)trail.splice(0,trail.length-96);
    wake();
  }
  function press(event){
    if(event.pointerType!=='mouse'||event.button!==0||reduced.matches)return;
    blooms.push({x:event.clientX,y:event.clientY,time:performance.now(),
      angle:-Math.PI/2+leafIndex*.4,strength:pointerStrength(event.target)});
    if(blooms.length>4)blooms.shift();
    wake();
  }
  function animate(element,keyframes,options){
    const animation=element.animate(keyframes,options);pageAnimations.push(animation);
    animation.onfinish=()=>{pageAnimations=pageAnimations.filter(item=>item!==animation);};
    return animation;
  }
  function beforeRender(view,enabled){
    cancelPage();resetCard();
    if(!enabled||reduced.matches)return false;
    const sc=$('#document-scroll'),pane=$('#document-pane');
    if(view.childElementCount&&!view.classList.contains('source-view')){
      const area=sc.getBoundingClientRect(),base=pane.getBoundingClientRect();
      ghost=document.createElement('div');ghost.className='page-ghost';ghost.inert=true;ghost.setAttribute('aria-hidden','true');
      Object.assign(ghost.style,{left:area.left-base.left+'px',top:area.top-base.top+'px',width:area.width+'px',height:area.height+'px'});
      const copy=view.cloneNode(true);copy.removeAttribute('id');
      for(const el of copy.querySelectorAll('[id]'))el.removeAttribute('id');
      copy.style.transform=`translate(${-sc.scrollLeft}px,${-sc.scrollTop}px)`;
      ghost.append(copy);pane.append(ghost);
    }
    return true;
  }
  function afterRender(view,enabled){
    for(const item of view.querySelectorAll(cards))item.classList.add('interaction-card');
    if(!enabled)return;
    if(ghost){
      const leaving=ghost;
      const animation=animate(leaving,[{opacity:1},{opacity:0,transform:'translateY(-3px)'}],{duration:100,easing:'ease-out'});
      animation.addEventListener('finish',()=>{leaving.remove();if(ghost===leaving)ghost=null;},{once:true});
    }
    animate(view,[{opacity:.3},{opacity:1}],{duration:180,easing:'ease-out'});
    const layers=[...view.children].filter(el=>!el.hidden).slice(0,8);
    layers.forEach((element,i)=>animate(element,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],
      {duration:210,delay:i*10,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'}));
  }
  function init(){
    canvas=document.createElement('canvas');canvas.id='interaction-canvas';canvas.setAttribute('aria-hidden','true');
    document.body.append(canvas);ctx=canvas.getContext('2d');resize();
    const options={passive:true,signal:events.signal};
    document.addEventListener('pointermove',move,options);
    document.addEventListener('pointerdown',press,options);
    document.documentElement.addEventListener('pointerleave',stopPointer,options);
    window.addEventListener('blur',stopPointer,options);
    window.addEventListener('resize',resize,options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPointer();cancelPage();}},options);
    reduced.addEventListener('change',()=>{stopPointer();cancelPage();},options);
  }
  function dispose(){events.abort();stopPointer();cancelPage();canvas.remove();}
  return {init,beforeRender,afterRender,dispose};
})();
