const HOME='/';
const docPaths={about:HOME+'about.md',bio:HOME+'about.md',life:HOME+'life',notes:HOME+'Notes',activity:HOME+'空间动态.md',blog:HOME+'blog',
  projects:HOME+'projects',skills:HOME+'skills.json'};
for(const x of P.projects)docPaths['projects/'+x.slug]=HOME+'projects/'+x.slug+'.md';
let current={path:docPaths.about,mode:'preview',source:'',type:'file'}, history=[],busy=false,toastTimer;
function liveCore(){return new IceyShellCore(files,shell.state);}
function prettyPath(p){return p===HOME?'~':'~'+p;}
function heading(eyebrow,title,sub=''){return `<p class="screen-eyebrow">${E(eyebrow)}</p><h2 class="screen-title">${E(title)}</h2>${sub?`<p class="screen-subtitle">${E(sub)}</p>`:''}`;}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
window.iceyToast=toast;
function safeHref(href){
  if(typeof href!=='string')return null;
  const s=href.trim();
  if(/[\x00-\x20\\]/.test(s.replace(/ /g,''))||s.startsWith('//'))return null;
  if(/^[a-z][a-z\d+.-]*:/i.test(s)){
    try{const u=new URL(s);return ['https:','http:','mailto:'].includes(u.protocol)?s:null;}catch(e){return null;}
  }
  if(s.includes(':'))return null;
  return s;
}
/* Raw HTML is displayed as text. Remote images never load automatically. */
const mdRenderer=new marked.Renderer();
mdRenderer.html=html=>E(html);
mdRenderer.image=(href,title,text)=>`<span class="image-note">[图片：${E(text||'未命名')} · 不自动加载外部资源]</span>`;
mdRenderer.link=(href,title,text)=>{const safe=safeHref(href);return safe===null?text:`<a href="${E(safe)}"${title?' title="'+E(title)+'"':''}>${text}</a>`;};
function renderMarkdown(text){
  if(text.length>131072)throw new Error('预览上限为 128 KiB。');
  const template=document.createElement('template');
  template.innerHTML=marked.parse(text,{gfm:true,breaks:false,headerIds:false,mangle:false,renderer:mdRenderer});
  // Keep a small, explicit set of document elements. No script, style, SVG, iframe or event attributes.
  const allowed=new Set('P BR HR H1 H2 H3 H4 H5 H6 STRONG EM DEL BLOCKQUOTE UL OL LI PRE CODE TABLE THEAD TBODY TR TH TD A SPAN INPUT'.split(' '));
  const clean=parent=>{for(const el of [...parent.children]){
    if(!allowed.has(el.tagName)){el.replaceWith(document.createTextNode(el.textContent));continue;}
    const attrs={href:el.getAttribute('href'),title:el.getAttribute('title'),align:el.getAttribute('align'),start:el.getAttribute('start'),class:el.getAttribute('class'),checked:el.hasAttribute('checked'),type:el.getAttribute('type')};
    for(const attr of [...el.attributes])el.removeAttribute(attr.name);
    if(el.tagName==='A'){
      const url=safeHref(attrs.href);if(url!==null)el.setAttribute('href',url);
      if(attrs.title)el.title=attrs.title;
      if(url&&/^https?:/i.test(url)){el.target='_blank';el.rel='noopener noreferrer';}
    }
    if(['TD','TH'].includes(el.tagName)&&['left','right','center'].includes(attrs.align))el.setAttribute('align',attrs.align);
    if(el.tagName==='OL'&&/^\d+$/.test(attrs.start||''))el.setAttribute('start',attrs.start);
    if(el.tagName==='CODE'&&/^language-[\w+-]+$/.test(attrs.class||''))el.className=attrs.class;
    if(el.tagName==='SPAN'&&attrs.class==='image-note')el.className='image-note';
    if(el.tagName==='INPUT'){
      if(attrs.type!=='checkbox'){el.remove();continue;}
      el.type='checkbox';el.disabled=true;el.checked=attrs.checked;el.setAttribute('aria-label',attrs.checked?'已完成':'未完成');
      el.closest('li')?.classList.add('task-list-item');
    }
    clean(el);
  }};
  clean(template.content);
  const used=new Map();
  for(const h of template.content.querySelectorAll('h1,h2,h3,h4,h5,h6')){
    const slug=h.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s+/g,'-')||'section';
    const n=used.get(slug)||0;used.set(slug,n+1);h.id='md-'+slug+(n?'-'+n:'');
  }
  for(const table of template.content.querySelectorAll('table')){const box=document.createElement('div');box.className='table-scroll';table.replaceWith(box);box.append(table);}
  return template.content;
}
function syntaxJSON(text){
  const re=/"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
  let out='',pos=0,m;
  while((m=re.exec(text))){out+=E(text.slice(pos,m.index));const raw=m[0];const kind=raw.startsWith('"')?(/^\s*:/.test(text.slice(re.lastIndex))?'key':'string'):/^(true|false|null)$/.test(raw)?'literal':'number';out+=`<span class="json-${kind}">${E(raw)}</span>`;pos=re.lastIndex;}
  return out+E(text.slice(pos));
}
function renderSource(text,highlight=false){
  const pre=document.createElement('div');pre.className='source-code'+(highlight?' json-code':'');
  const lines=text.replace(/\n$/,'').split('\n');
  lines.forEach((line,i)=>{const row=document.createElement('div');row.className='source-line';const n=document.createElement('span');n.className='line-number';n.textContent=i+1;n.setAttribute('aria-hidden','true');const code=document.createElement('code');if(highlight)code.innerHTML=syntaxJSON(line);else code.textContent=line||' ';row.append(n,code);pre.append(row);});
  return pre;
}
const categoryFilters=new Map();
function travelDate(path){return P.travelDates?.[path.slice(1)]||'';}
function directoryChildren(path){
  const core=liveCore(),children=core.children(path,false);
  const order=path===HOME+'projects'?P.projects.map(x=>x.slug+'.md'):(P.directories[path.slice(1)]?.order||[]);
  return children.sort((a,b)=>{
    if(path===HOME+'life/Travel')return travelDate(b).localeCompare(travelDate(a))||a.localeCompare(b,'zh-CN');
    const rank=p=>{const i=order.indexOf(p.split('/').pop());return i<0?999:i;};
    return rank(a)-rank(b)||a.localeCompare(b,'zh-CN');
  });
}
function directoryMarkdown(path){
  const core=liveCore(),config=P.directories[path.slice(1)],isProjects=path===HOME+'projects';
  const title=config?.title||prettyPath(path)+'/';
  const children=directoryChildren(path);
  const intro=config?.description?config.description+'\n\n':'';
  if(!children.length)return `# ${title}\n\n${intro}*${prettyPath(path)}/ · 0 items*\n`;
  const rows=children.map(p=>{
    const name=p.split('/').pop(),node=core.nodes[p],isDir=node.type==='dir';
    const project=isProjects?P.projects.find(x=>x.slug+'.md'===name):null;
    const summary=project?.subtitle||(isDir?P.directories[p.slice(1)]?.description||'目录':node.text.match(/^# (.+)$/m)?.[1]||'');
    return `| [${name}${isDir?'/':''}](#${encodeURI(window.ICEY_ROUTES.routeForPath(p,core.nodes))}) | ${summary.replace(/\|/g,'\\|')} |`;
  });
  const header=`# ${title}\n\n${intro}*${prettyPath(path)}/ · ${rows.length} items*\n\n`;
  const table=items=>'| 文件 | 简介 |\n| --- | --- |\n'+items.join('\n');
  if(path===HOME+'life/Travel'){
    const months=new Map();
    children.forEach((p,i)=>{const month=travelDate(p)||'未注明时间';if(!months.has(month))months.set(month,[]);months.get(month).push(rows[i]);});
    return header+[...months].map(([month,items])=>`## ${month}\n\n${table(items)}`).join('\n\n');
  }
  return header+table(rows);
}
function categoryControls(view,path){
  const categories=P.directories[path.slice(1)]?.categories;if(!categories)return;
  view.classList.add('article-directory');
  const children=directoryChildren(path).filter(p=>p.endsWith('.md'));
  const selected=categoryFilters.get(path)||'全部';
  const controls=document.createElement('div');controls.className='category-filters';controls.setAttribute('role','group');controls.setAttribute('aria-label','文章分类');
  for(const category of ['全部',...categories]){
    const count=children.filter(p=>category==='全部'||P.articles[p.slice(1)]?.category===category).length;
    const button=document.createElement('button');button.type='button';button.dataset.category=category;
    button.setAttribute('aria-pressed',String(category===selected));button.innerHTML=`${E(category)} <span>${count}</span>`;
    button.addEventListener('click',()=>{categoryFilters.set(path,category);renderDocument(true);});controls.append(button);
  }
  const table=view.querySelector('.table-scroll');
  (table||view.lastElementChild).before(controls);
  for(const row of view.querySelectorAll('tbody tr')){
    const link=row.querySelector('a'),route=decodeURI(link.hash.slice(1)),file=window.ICEY_ROUTES.pathForRoute(route,liveCore().nodes);
    const category=P.articles[file.slice(1)]?.category;
    row.hidden=selected!=='全部'&&category!==selected;
    const filename=link.textContent,summary=row.lastElementChild.textContent;
    link.textContent=summary||filename;row.lastElementChild.textContent=filename;
    if(category){const badge=document.createElement('span');badge.className='article-category';badge.textContent=category;row.lastElementChild.append(badge);}
  }
}
function decorateDocument(view,path){
  if(path==='/about.md')view.querySelector('a[href="#空间动态"]')?.classList.add('activity-link');
  if(path==='/空间动态.md'){
    view.classList.add('activity-document');
    const entrances=view.querySelector('#md-动态入口 + ul');entrances?.classList.add('entry-grid');
    for(const item of entrances?.children||[]){
      const link=item.querySelector('a'),description=item.textContent.slice(link.textContent.length).replace(/^ · /,'');
      link.innerHTML=`<strong>${E(link.textContent)}</strong>${description?`<span class="entry-description">${E(description)}</span>`:''}<span class="entry-arrow" aria-hidden="true">↗</span>`;
      item.replaceChildren(link);
    }
    for(const id of ['md-知识更新','md-空间更新']){
      const list=view.querySelector('#'+id+' + ul');if(!list)continue;
      list.classList.add('update-list');
      for(const item of list.children){
        const date=item.firstChild.textContent.split(' · ')[0],link=item.querySelector('a');
        const time=document.createElement('time');time.dateTime=date;time.textContent=date;
        item.replaceChildren(time,link);link.insertAdjacentHTML('beforeend','<span aria-hidden="true">↗</span>');
      }
    }
  }
  if(P.directories[path.slice(1)]){
    view.classList.add('directory-document');
    if(path==='/life/Travel'){
      view.classList.add('travel-directory');
      for(const link of view.querySelectorAll('tbody a'))link.textContent=link.textContent.replace(/\.md$/,'');
    }
  }
}
let navigationSignature='';
function syncNavigation(){
  const core=liveCore(),root=$('#file-nav');
  const paths=Object.keys(core.nodes).filter(p=>p!=='/'&&!p.split('/').some(part=>part.startsWith('.')));
  const signature=paths.map(p=>p+':'+core.nodes[p].type).sort().join('|');
  if(signature===navigationSignature)return;
  const states=new Map([...root.querySelectorAll('details')].map(el=>[el.dataset.folder,el.open]));
  navigationSignature=signature;root.replaceChildren();
  function append(parent,path){
    const node=core.nodes[path],name=path.split('/').pop();
    if(node.type==='dir'){
      const key=path.slice(1),config=P.directories[key],folder=document.createElement('details');folder.className='nav-folder';folder.dataset.folder=key;
      folder.open=states.get(key)??!config?.collapsed;
      const children=directoryChildren(path);
      const summary=document.createElement('summary');
      summary.innerHTML=`<span class="folder-chevron">›</span>${icon('folder')}<a class="folder-label" data-doc="${E(path)}" href="#${encodeURI(key)}">${E(name)}</a><small${key==='blog'?' id="blog-count"':''}>${children.length}</small>`;
      const box=document.createElement('div');box.className='folder-children';
      for(const child of children)append(box,child);
      folder.append(summary,box);parent.append(folder);
    }else{
      const button=document.createElement('button');button.type='button';button.className='file-item';button.dataset.doc=path===HOME+'about.md'?'about':path===HOME+'skills.json'?'skills':path;
      button.innerHTML=`<span class="file-glyph${path.endsWith('.json')?' json':''}">${path.endsWith('.json')?'{ }':'M↓'}</span><span>${E(name)}</span>`;
      parent.append(button);
    }
  }
  const top=core.children(HOME,false),order=P.navigation.map(name=>HOME+name);
  for(const path of [...order.filter(p=>top.includes(p)),...top.filter(p=>!order.includes(p))])append(root,path);
}
function setRoute(path){
  try{window.history.replaceState(null,'','#'+encodeURI(window.ICEY_ROUTES.routeForPath(path,shell.state.nodes)));}catch(e){}
}
function renderDocument(preserveScroll=false){
  const core=liveCore(),node=core.nodes[current.path];if(!node)throw new Error('文件已不存在：'+prettyPath(current.path));
  const sc=$('#document-scroll'),oldY=sc.scrollTop,oldX=sc.scrollLeft,view=$('#doc-view');
  current.type=node.type;if(node.type==='dir')current.mode='preview';
  current.source=node.type==='dir'?directoryMarkdown(current.path):node.text;
  $('.editor-tabs').hidden=node.type==='dir';
  $('.preview-switch').hidden=node.type==='dir';
  $('#document-pane').setAttribute('aria-label',node.type==='dir'?'目录浏览':'文件预览');
  const isMd=current.path.endsWith('.md')||node.type==='dir',isJson=current.path.endsWith('.json');
  const name=(current.path.split('/').pop()||'/')+(node.type==='dir'?'/':'');
  const transition=interactionMotion.beforeRender(view,current.mode==='preview'&&!preserveScroll);
  view.replaceChildren();view.className='markdown-body';
  if(current.mode==='source') {view.classList.add('source-view');view.append(renderSource(current.source));}
  else if(isMd){view.append(renderMarkdown(current.source));decorateDocument(view,current.path);if(node.type==='dir')categoryControls(view,current.path);}
  else {view.classList.add('source-view');view.append(renderSource(current.source,isJson));}
  $('#doc-tab-label').textContent=name;$('#tab-glyph').textContent=isJson?'{ }':node.type==='dir'?'▱':'M↓';
  $('#doc-language').textContent=node.type==='dir'?'Directory':isJson?'JSON':isMd?'Markdown':'Text';
  $('#breadcrumb-file').textContent=prettyPath(current.path).replace(/^~\//,'');
  $('#breadcrumb-file').title=current.path;$('#status-location').textContent=prettyPath(current.path);
  $('#preview-button').setAttribute('aria-pressed',String(current.mode==='preview'));$('#source-button').setAttribute('aria-pressed',String(current.mode==='source'));
  $('#preview-button').textContent=isJson?'高亮':node.type==='dir'?'目录':'预览';
  $('#source-button').disabled=node.type==='dir';
  syncNavigation();
  document.querySelectorAll('#file-nav [data-doc]').forEach(el=>{const active=(docPaths[el.dataset.doc]||el.dataset.doc)===current.path;el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');if(active){let folder=el.parentElement.closest('details');while(folder){folder.open=true;folder=folder.parentElement.closest('details');}}});
  if(!preserveScroll)$('#file-nav [aria-current="page"]')?.scrollIntoView({block:'nearest'});
  if(preserveScroll){sc.scrollTop=oldY;sc.scrollLeft=oldX;}else{sc.scrollTop=0;sc.scrollLeft=0;}
  interactionMotion.afterRender(view,transition);
  document.title=`${name} — icey / 张一铭`;
}
function openFile(path,mode='preview',hash=true){
  const resolved=docPaths[path]||liveCore().norm(path);
  if(!shell.state.nodes[resolved])throw new Error(prettyPath(resolved)+': No such file or directory');
  current={path:resolved,mode,type:'file',source:''};renderDocument();if(hash)setRoute(resolved);closeSidebar();return resolved;
}
function openDoc(name,hash=true){return openFile(window.ICEY_ROUTES.pathForRoute(name,shell.state.nodes),'preview',hash);}
function showDocumentMode(mode){current.mode=mode;renderDocument();}
function closeSidebar(){document.body.classList.remove('sidebar-open');$('#sidebar-scrim').hidden=true;}
function status(code=0){
  shell.state.last=code; shell.core.last=code; shell.worker?.postMessage({setLast:code});
  $('#input-status').textContent=code ? 'exit '+code : 'ready';
  $('.shell-state').classList.toggle('error',code!==0);$('.shell-state').classList.remove('busy');
}
function helpText(){return `icey websh

浏览文档
  about / activity / life / skills
  notes [article]
  blog [article]
  projects [name]
    ${P.projects.map(x=>x.slug).join(" / ")}
  preview <file>   打开 Markdown 预览
  source [file]    查看原文

文件与文本
  ls -la / tree -a / cd / pwd / cat
  head / tail / grep / wc / sort / uniq / cut / find
  echo / printf / seq / mkdir / touch / cp / mv / rm
  less <file>     分页阅读；j/k ↑↓ / Space / q

Shell 语法
  |  >  >>  <  ;  &&  ||  引号 / 变量 / 基础通配符
  cat ~/about.md | grep -n Agent
  echo hello > ~/hello.txt; cat ~/hello.txt

小工具
  neofetch / fortune / achievements / ls -a
  demo            看一段行内进度更新
  clear / history / resetfs

Tab 补全 · ↑↓ 历史 · Ctrl R 反向搜索
Ctrl A/E 行首/尾 · Ctrl W/U/K 删除 · Ctrl Y 恢复
Shift PageUp/PageDown 翻阅 · Ctrl C 中断
`;}
