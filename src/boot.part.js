/* Visible entry points: documents in the explorer; external links in about.md;
   appearance in the palette; playful commands in the terminal only. */
$('#preview-button').addEventListener('click',()=>showDocumentMode('preview'));
$('#source-button').addEventListener('click',()=>showDocumentMode('source'));
$('#toggle-sidebar').addEventListener('click',()=>{
  if(innerWidth<=760){const on=document.body.classList.toggle('sidebar-open');$('#sidebar-scrim').hidden=!on;}
  else document.body.classList.toggle('sidebar-collapsed');consoleShell.requestFit();
});
$('#sidebar-scrim').addEventListener('click',closeSidebar);
$('.skip-link').addEventListener('click',e=>{e.preventDefault();focusInput(true);});
document.addEventListener('click',e=>{
  const close=e.target.closest('[data-close]');if(close){$('#'+close.dataset.close)?.close();return;}
  const nav=e.target.closest('[data-doc]');if(nav){e.preventDefault();try{openDoc(nav.dataset.doc);}catch(err){toast(err.message);}return;}
  const link=e.target.closest('#doc-view a');if(!link)return;
  const href=link.getAttribute('href');if(!href||/^(https?:|mailto:)/i.test(href))return;
  e.preventDefault();
  if(href.startsWith('#')){let anchor=href.slice(1);try{anchor=decodeURI(anchor);}catch(err){}const target=[...$('#doc-view').querySelectorAll('[id]')].find(x=>x.id===anchor||x.id==='md-'+anchor);
    if(target)target.scrollIntoView({block:'start'});else try{openDoc(anchor);}catch(err){toast(err.message);}return;}
  try{const [path,anchor]=href.split('#'),base=current.type==='dir'?current.path:liveCore().parent(current.path);openFile(liveCore().norm(decodeURIComponent(path),base));
    if(anchor){const target=[...$('#doc-view').querySelectorAll('[id]')].find(x=>x.id==='md-'+decodeURIComponent(anchor)||x.id===decodeURIComponent(anchor));target?.scrollIntoView({block:'start'});}
  }catch(err){toast(err.message);}
});
const paletteItems=[
  {id:'light',label:'浅色 · Paper & sage',keywords:'light 白天 亮色 浅色 主题 theme 配色 appearance',ico:'sun'},
  {id:'dark',label:'深色 · After hours',keywords:'dark 夜晚 暗色 深色 主题 theme 配色 appearance',ico:'moon'},
  {id:'amber',label:'琥珀 · Warm terminal',keywords:'amber 琥珀 暖色 主题 theme 配色 appearance',ico:'sun'}
];
let filtered=[],paletteIndex=0;
function renderPalette(){
  const q=$('#palette-search').value.trim().toLowerCase();filtered=paletteItems.filter(x=>(x.label+' '+x.keywords).toLowerCase().includes(q));
  paletteIndex=Math.min(paletteIndex,Math.max(0,filtered.length-1));const box=$('#palette-results');box.replaceChildren();
  if(!filtered.length){box.innerHTML='<p class="empty-screen">没有匹配的主题。</p>';return;}
  filtered.forEach((x,i)=>{
    const b=document.createElement('button');b.type='button';b.className='palette-result'+(i===paletteIndex?' active':'');b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===paletteIndex));
    b.innerHTML=icon(x.ico)+`<span><strong>${E(x.label)}</strong></span><small>${document.documentElement.dataset.theme===x.id?'✓ current':E(x.id)}</small>`;
    b.addEventListener('click',()=>choosePalette(i));box.append(b);
  });
}
function choosePalette(i){const x=filtered[i];if(!x)return;theme(x.id);$('#palette').close();}
function openPalette(){
  if($('#palette').open){$('#palette').close();return;}if(document.querySelector('dialog[open]'))return;
  paletteIndex=0;$('#palette-search').value='';renderPalette();$('#palette').showModal();$('#palette-search').focus();
}
$('#palette-trigger').addEventListener('click',openPalette);
$('#palette-search').addEventListener('input',()=>{paletteIndex=0;renderPalette();});
$('#palette-search').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();paletteIndex=Math.max(0,Math.min(filtered.length-1,paletteIndex+(e.key==='ArrowDown'?1:-1)));renderPalette();$('#palette-results .active')?.scrollIntoView({block:'nearest'});}
  else if(e.key==='Enter'){e.preventDefault();choosePalette(paletteIndex);}
});
document.querySelectorAll('dialog').forEach(d=>{
  d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
  d.addEventListener('close',()=>focusInput());
});
const secret=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];let seq=0;
document.addEventListener('keydown',e=>{
  if(e.isComposing)return;
  const key=e.key.toLowerCase();
  if((e.metaKey&&key==='k')||(e.ctrlKey&&e.shiftKey&&key==='p')){
    if(e.defaultPrevented)return;e.preventDefault();openPalette();return;
  }
  if(e.ctrlKey&&e.key==='`'){e.preventDefault();focusInput(true);return;}
  if(e.key==='Escape'){stopEffect();closeSidebar();}
  if($('#piano-dialog').open&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const i=pianoKeys.indexOf(key);if(i>=0&&e.key.length===1&&!e.repeat){e.preventDefault();note(i);}return;}
  if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!document.querySelector('dialog[open]')){
    const k=e.key.length===1?key:e.key;seq=k===secret[seq]?seq+1:k===secret[0]?1:0;if(seq===secret.length){seq=0;konami();}
  }
});
function loadRoute(){let h='';try{h=decodeURI(location.hash.slice(1));}catch(e){}try{openDoc(h||'about',false);}catch(e){openDoc('about',false);}setRoute(current.path);}
window.addEventListener('hashchange',loadRoute);
window.addEventListener('beforeunload',()=>{shell.dispose();consoleShell.dispose();stopEffect();});
icons();$('#sidebar-cat').innerHTML=pixelCat();theme(document.documentElement.dataset.theme||'light');loadRoute();updateDivider();
if(!/Mac|iPhone|iPad/.test(navigator.platform))$('.palette-trigger kbd').textContent='Ctrl ⇧ P';
consoleShell.ready.then(()=>focusInput());
window.ICEY_APP={run,openDoc,openFile,shell,files,profile:P,renderMarkdown,setShellHeight,terminal:consoleShell,
  get current(){return {...current};},get busy(){return busy;},get history(){return [...history];}};
})();
