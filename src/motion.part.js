/* Pointer feedback and document transitions share the existing theme ink. */
const interactionMotion=(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const events=new AbortController();
  let canvas,ctx,frame=0,trail=[],ripples=[],card=null;
  let ink='',pageAnimations=[],ghost=null;
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
    cancelAnimationFrame(frame);frame=0;trail=[];ripples=[];
    ctx?.clearRect(0,0,innerWidth,innerHeight);resetCard();
  }
  function resize(){
    const scale=Math.min(devicePixelRatio,2);
    canvas.width=Math.round(innerWidth*scale);canvas.height=Math.round(innerHeight*scale);
    ctx.setTransform(scale,0,0,scale,0,0);stopPointer();
  }
  function wake(){if(!frame)frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;ctx.clearRect(0,0,innerWidth,innerHeight);
    trail=trail.filter(point=>now-point.time<160);
    ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=1;ctx.lineCap='round';
    for(let i=0;i<trail.length;i++){
      const point=trail[i],life=1-(now-point.time)/160;
      ctx.globalAlpha=.16*life*point.strength;
      if(i){ctx.beginPath();ctx.moveTo(trail[i-1].x,trail[i-1].y);ctx.lineTo(point.x,point.y);ctx.stroke();}
      ctx.beginPath();ctx.arc(point.x,point.y,life,0,Math.PI*2);ctx.fill();
    }
    ripples=ripples.filter(ripple=>now-ripple.time<380);
    for(const ripple of ripples){
      const progress=(now-ripple.time)/380,radius=8+46*(1-(1-progress)**3);
      ctx.globalAlpha=.24*(1-progress)**2;ctx.strokeStyle=ink;ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(ripple.x,ripple.y,radius,0,Math.PI*2);ctx.stroke();
    }
    ctx.globalAlpha=1;
    if(trail.length||ripples.length)wake();
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
    const quiet=target.closest('.shell-panel,.source-view')||target.closest('#doc-view')&&current.type==='file'&&current.path!=='/空间动态.md';
    const now=performance.now();
    const point={x:event.clientX,y:event.clientY,time:now,strength:quiet ? .28 : 1};
    const last=trail.at(-1);
    if(!last||Math.hypot(last.x-point.x,last.y-point.y)>5)trail.push(point);
    if(trail.length>12)trail.shift();
    ink=getComputedStyle(document.documentElement).getPropertyValue('--green').trim();wake();
  }
  function press(event){
    if(event.pointerType!=='mouse'||event.button!==0||reduced.matches)return;
    if(!event.target.closest('#file-nav [data-doc],#file-nav summary,.interaction-card,.category-filters button,#doc-view a[href^="#"]'))return;
    ripples.push({x:event.clientX,y:event.clientY,time:performance.now()});
    if(ripples.length>4)ripples.shift();
    ink=getComputedStyle(document.documentElement).getPropertyValue('--green').trim();wake();
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
