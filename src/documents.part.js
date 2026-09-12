const HOME='/home/icey';
const docPaths={about:HOME+'/about.md',bio:HOME+'/about.md',life:HOME+'/life.md',blog:HOME+'/blog',
  projects:HOME+'/projects',skills:HOME+'/skills.json'};
for(const x of P.projects)docPaths['projects/'+x.slug]=HOME+'/projects/'+x.slug+'.md';
let current={path:docPaths.about,mode:'preview',source:'',type:'file'}, history=[],busy=false,toastTimer;
function liveCore(){return new IceyShellCore(files,shell.state);}
function prettyPath(p){return p===HOME?'~':p.startsWith(HOME+'/')?'~'+p.slice(HOME.length):p;}
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
function directoryMarkdown(path){
  const core=liveCore(),isProjects=path===HOME+'/projects',isBlog=path===HOME+'/blog';
  const title=isProjects?'开源与个人项目':isBlog?'Blog':prettyPath(path)+'/';
  let children=core.children(path,false);
  if(isProjects){
    const order=new Map(P.projects.map((x,i)=>[x.slug+'.md',i]));
    children.sort((a,b)=>(order.get(a.split('/').pop())??999)-(order.get(b.split('/').pop())??999));
  }
  const intro=isProjects?'从 Agent 系统、模型训练，到学习工具和生活里的小项目。\n\n':'';
  if(!children.length)return `# ${title}\n\n*${prettyPath(path)}/ · 0 ${isBlog?'articles':'items'}*\n`;
  const rows=children.map(p=>{
    const name=p.split('/').pop(),node=core.nodes[p],isDir=node.type==='dir';
    const data=isProjects?P.projects.find(x=>x.slug+'.md'===name):null;
    const summary=data?.subtitle || (isBlog&&node.type==='file'?(node.text.match(/^# (.+)$/m)?.[1]||'文章'):isDir?'目录':'文件');
    return `| [${name}${isDir?'/':''}](${p}) | ${summary.replace(/\|/g,'\\|')} |`;
  });
  return `# ${title}\n\n${intro}*${prettyPath(path)}/ · ${rows.length} items*\n\n| 文件 | 简介 |\n| --- | --- |\n`+rows.join('\n');
}
function setRoute(path){const alias=Object.keys(docPaths).find(k=>docPaths[k]===path)||path;
  try{window.history.replaceState(null,'','#'+encodeURI(alias));}catch(e){}
}
function renderDocument(preserveScroll=false){
  const core=liveCore(),node=core.nodes[current.path];if(!node)throw new Error('文件已不存在：'+prettyPath(current.path));
  const sc=$('#document-scroll'),oldY=sc.scrollTop,oldX=sc.scrollLeft,view=$('#doc-view');
  current.type=node.type;current.source=node.type==='dir'?directoryMarkdown(current.path):node.text;
  const isMd=current.path.endsWith('.md')||node.type==='dir',isJson=current.path.endsWith('.json');
  const name=(current.path.split('/').pop()||'/')+(node.type==='dir'?'/':'');
  view.replaceChildren();view.className='markdown-body';
  if(current.mode==='source') {view.classList.add('source-view');view.append(renderSource(current.source));}
  else if(isMd){view.append(renderMarkdown(current.source));}
  else {view.classList.add('source-view');view.append(renderSource(current.source,isJson));}
  $('#doc-tab-label').textContent=name;$('#tab-glyph').textContent=isJson?'{ }':node.type==='dir'?'▱':'M↓';
  $('#doc-language').textContent=node.type==='dir'?'Directory':isJson?'JSON':isMd?'Markdown':'Text';
  $('#breadcrumb-file').textContent=prettyPath(current.path).replace(/^~\//,'');
  $('#breadcrumb-file').title=current.path;$('#status-location').textContent=prettyPath(current.path);
  $('#preview-button').setAttribute('aria-pressed',String(current.mode==='preview'));$('#source-button').setAttribute('aria-pressed',String(current.mode==='source'));
  $('#preview-button').textContent=isJson?'高亮':node.type==='dir'?'目录':'预览';
  $('#source-button').disabled=node.type==='dir';
  $('#blog-count').textContent=core.children(HOME+'/blog',false).length;
  document.querySelectorAll('#file-nav [data-doc]').forEach(el=>{const active=docPaths[el.dataset.doc]===current.path;el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');if(active&&el.closest('details'))el.closest('details').open=true;});
  if(preserveScroll){sc.scrollTop=oldY;sc.scrollLeft=oldX;}else{sc.scrollTop=0;sc.scrollLeft=0;}
  document.title=`${name} — icey / 张一铭`;
}
function openFile(path,mode='preview',hash=true){
  const resolved=docPaths[path]||liveCore().norm(path);
  if(!shell.state.nodes[resolved])throw new Error(prettyPath(resolved)+': No such file or directory');
  current={path:resolved,mode,type:'file',source:''};renderDocument();if(hash)setRoute(resolved);closeSidebar();return resolved;
}
function openDoc(name,hash=true){return openFile(docPaths[name]||name,'preview',hash);}
function showDocumentMode(mode){current.mode=mode;renderDocument();}
function closeSidebar(){document.body.classList.remove('sidebar-open');$('#sidebar-scrim').hidden=true;}
function status(code=0){
  shell.state.last=code; shell.core.last=code; shell.worker?.postMessage({setLast:code});
  $('#input-status').textContent=code ? 'exit '+code : 'ready';
  $('.shell-state').classList.toggle('error',code!==0);$('.shell-state').classList.remove('busy');
}
function helpText(){return `icey websh

浏览文档
  about / life / skills
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
  echo hello > /tmp/hello.txt; cat /tmp/hello.txt

小工具
  neofetch / fortune / achievements / ls -a
  demo            看一段行内进度更新
  clear / history / resetfs

Tab 补全 · ↑↓ 历史 · Ctrl R 反向搜索
Ctrl A/E 行首/尾 · Ctrl W/U/K 删除 · Ctrl Y 恢复
Shift PageUp/PageDown 翻阅 · Ctrl C 中断
`;}
