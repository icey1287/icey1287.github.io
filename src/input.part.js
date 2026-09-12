/* Clipboard shortcuts apply only to selected terminal text. */
async function copyTerminalText(text){
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch(e){}
  const el=document.createElement('textarea');el.value=text;el.style.cssText='position:fixed;left:-9999px';
  document.body.append(el);el.select();let ok=false;
  try{ok=document.execCommand('copy');}catch(e){}el.remove();return ok;
}
/* Terminal buffer and readline-like editor. xterm owns rendering, selections,
   wheel/touch scrolling, soft-wrapped output, IME and the blinking cursor.
   Only the active input is repainted; committed output is never rebuilt. */
class PortfolioTerminal {
  constructor(container){
    this.container=container;this.line='';this.pos=0;this.drawn=false;this.drawnRow=0;
    this.historyIndex=0;this.draft='';this.kill='';this.search=null;this.pager=null;
    this.queue=Promise.resolve();this.job=Promise.resolve();this.controller=null;
    this.resizing=false;this.pendingFit=false;this.bellTimer=null;
    this.pagerFrame=null;this.pagerWheelRemainder=0;this.disposed=false;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.term=new IceyTerminal.Terminal({
      fontFamily:"'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize:innerWidth<=760?16:17,lineHeight:1.45,letterSpacing:0,
      cursorBlink:!reduced,cursorStyle:'block',cursorInactiveStyle:'outline',
      // Apply wheel deltas directly: no synthetic easing or added inertia.
      smoothScrollDuration:0,scrollback:5000,scrollSensitivity:1,
      fastScrollSensitivity:3,convertEol:true,minimumContrastRatio:4.5,
      screenReaderMode:false,allowProposedApi:true,altClickMovesCursor:true,
      macOptionIsMeta:true,rightClickSelectsWord:true,scrollOnUserInput:true,
      linkHandler:{activate:()=>{}},logLevel:'off',theme:this.colors()
    });
    this.fit=new IceyTerminal.FitAddon();this.term.loadAddon(this.fit);
    this.term.open(container);this.fit.fit();
    const ta=this.term.textarea;ta.id='command-input';ta.setAttribute('aria-label','输入 Shell 命令');
    ta.setAttribute('enterkeyhint','send');ta.setAttribute('autocapitalize','none');ta.setAttribute('autocomplete','off');
    this.term.onData(data=>this.enqueue(()=>this.onData(data)));
    this.term.attachCustomKeyEventHandler(e=>this.keyFilter(e));
    this.term.onBell(()=>this.bell());
    this.term.onResize(()=>{$('#terminal-size').textContent=`${this.term.cols} × ${this.term.rows}`;});
    this.pagerWheel=e=>{
      // Normal scrollback stays with xterm. Only less uses this handler.
      if(!this.pager)return;
      e.preventDefault();e.stopImmediatePropagation();
      const cellHeight=this.term._core._renderService.dimensions.css.cell.height||24;
      const delta=e.deltaMode===1?e.deltaY:e.deltaMode===2?
        e.deltaY*Math.max(1,this.term.rows-1):e.deltaY/cellHeight;
      if(!Number.isFinite(delta)||!delta)return;
      // Preserve small touchpad deltas; a tiny gesture must not force a row.
      if(this.pagerWheelRemainder&&Math.sign(delta)!==Math.sign(this.pagerWheelRemainder))this.pagerWheelRemainder=0;
      this.pagerWheelRemainder+=delta;
      const rows=Math.trunc(this.pagerWheelRemainder);
      if(!rows)return;
      this.pagerWheelRemainder-=rows;
      const p=this.pager,max=Math.max(0,p.lines.length-this.term.rows+1);
      const top=Math.max(0,Math.min(p.top+rows,max));
      if(top===p.top){this.pagerWheelRemainder=0;return;}
      p.top=top;
      // Paint only the latest position, never a queue of old wheel events.
      this.schedulePageRender();
    };
    container.addEventListener('wheel',this.pagerWheel,{passive:false,capture:true});
    this.resizeObserver=new ResizeObserver(()=>this.requestFit());this.resizeObserver.observe(container);
    this.ready=this.enqueue(async()=>{
      await this.write('\x1b[?2004h\x1b[90mWelcome, curious human.\r\nType help to explore.\x1b[0m\r\n\r\n');
      await this.drawLine();$('#terminal-size').textContent=`${this.term.cols} × ${this.term.rows}`;
    });
  }
  colors(){
    const s=getComputedStyle(document.documentElement),v=x=>s.getPropertyValue(x).trim();
    const dark=document.documentElement.dataset.theme!=='light';
    return {background:v('--shell'),foreground:v('--text'),cursor:v('--cursor'),cursorAccent:v('--shell'),
      selectionBackground:v('--selection'),selectionInactiveBackground:v('--green-bg'),
      black:dark?'#26352b':'#354536',red:dark?'#e19b91':'#b15447',green:v('--green'),yellow:v('--orange'),
      blue:dark?'#9fbed1':'#3d6c83',magenta:dark?'#c9aec9':'#88628b',cyan:dark?'#91c6b5':'#3c8072',
      white:dark?'#d9e5ca':'#6d7963',brightBlack:v('--muted'),brightRed:dark?'#eeb3a6':'#9e483f',
      brightGreen:v('--green-dark'),brightYellow:dark?'#e9c89c':'#987137',brightBlue:dark?'#bdd4e4':'#356785',
      brightMagenta:dark?'#e3c3df':'#855984',brightCyan:dark?'#a3dcc5':'#37806c',brightWhite:v('--text')};
  }
  updateTheme(){this.term.options.theme=this.colors();}
  enqueue(fn){const next=this.queue.then(fn);this.queue=next.catch(e=>{console.error(e);toast('终端操作未完成：'+e.message);});return next;}
  write(text){return new Promise(resolve=>this.term.write(String(text),resolve));}
  output(text){
    // OSC/DCS control strings cannot change titles, make links or reach a clipboard.
    const clean=String(text).replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g,'').replace(/\x1bP[\s\S]*?\x1b\\/g,'');
    return this.write(clean);
  }
  prompt(){return `\x1b[1;32mvisitor\x1b[0m@icey:\x1b[34m${prettyPath(shell.state.cwd)}\x1b[0m\x1b[33m$\x1b[0m `;}
  width(c){
    // Use the bundled terminal's own Unicode width provider, including CJK.
    return this.term._core.unicodeService.wcwidth(c.codePointAt(0));
  }
  model(text=this.line,pos=this.pos){
    const cols=Math.max(2,this.term.cols),rows=[{text:'',ansi:''}];let col=0,r=0,cursor=null;
    const next=()=>{rows.push({text:'',ansi:''});r++;col=0;};
    const add=(str,color='')=>{
      for(const c of str){const w=this.width(c);if(w>0&&col+w>cols)next();rows[r].text+=c;rows[r].ansi+=(color?color+c+'\x1b[0m':c);col+=w;}
    };
    if(this.search){
      add('(reverse-i-search)', '\x1b[90m');add('`'+this.search.query+"': ",'\x1b[33m');
      add(this.search.match||'');cursor={row:r,col};
    }else{
      add('visitor','\x1b[1;32m');add('@icey:');add(prettyPath(shell.state.cwd),'\x1b[34m');add('$','\x1b[33m');add(' ');
      let index=0;
      for(const c of text){
        if(col>=cols||(c!=='\n'&&col+this.width(c)>cols))next();if(index===pos)cursor={row:r,col};
        if(c==='\n'){next();add('> ','\x1b[90m');}else add(c);
        index+=c.length;
      }
      if(col>=cols)next();if(pos===text.length||!cursor)cursor={row:r,col};
    }
    if(cursor.col>=cols){next();cursor={row:r,col:0};}
    const maxRows=Math.max(2,this.term.rows-1);
    const top=Math.max(0,Math.min(cursor.row-maxRows+1,rows.length-maxRows));
    return {rows:rows.slice(top,top+maxRows),row:cursor.row-top,col:cursor.col,top,total:rows.length};
  }
  eraseSequence(){return this.drawn?'\r'+(this.drawnRow?'\x1b['+this.drawnRow+'A':'')+'\x1b[0J':'';}
  async drawLine(){
    if(busy||this.pager)return;
    const m=this.model(),bottom=m.rows.length-1;
    const seq='\x1b[?25l'+this.eraseSequence()+m.rows.map(x=>x.ansi).join('\r\n')+'\x1b[0m\r'+
      (bottom>m.row?'\x1b['+(bottom-m.row)+'A':'')+(m.col?'\x1b['+m.col+'C':'')+'\x1b[?25h';
    await this.write(seq);this.drawn=true;this.drawnRow=m.row;this.lastModel=m;
  }
  setLine(text,pos=text.length){
    this.line=text.slice(0,4096);this.pos=Math.min(pos,this.line.length);this.term.scrollToBottom();return this.drawLine();
  }
  prev(pos=this.pos){if(pos<=0)return 0;return pos-((this.line.charCodeAt(pos-1)&0xFC00)===0xDC00?2:1);}
  next(pos=this.pos){if(pos>=this.line.length)return this.line.length;return pos+(this.line.codePointAt(pos)>0xffff?2:1);}
  wordLeft(){return this.line.slice(0,this.pos).replace(/\S+\s*$/,'').length;}
  wordRight(){const m=this.line.slice(this.pos).match(/^\s*\S+\s*/);return this.pos+(m?m[0].length:0);}
  async insert(text){
    text=text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');
    const room=4096-this.line.length;if(text.length>room){text=text.slice(0,room);this.bell();}
    return this.setLine(this.line.slice(0,this.pos)+text+this.line.slice(this.pos),this.pos+text.length);
  }
  async remove(start,end,save=false){if(save)this.kill=this.line.slice(start,end);return this.setLine(this.line.slice(0,start)+this.line.slice(end),start);}
  bell(){this.container.classList.add('terminal-bell');clearTimeout(this.bellTimer);this.bellTimer=setTimeout(()=>this.container.classList.remove('terminal-bell'),140);}
  keyFilter(e){
    if(e.type!=='keydown')return true;
    const k=e.key.toLowerCase();
    if((e.metaKey&&k==='k')||(e.ctrlKey&&e.shiftKey&&k==='p')){e.preventDefault();openPalette();return false;}
    if(e.ctrlKey&&k==='c'&&this.term.hasSelection()){
      if(!e.shiftKey)return false;
      e.preventDefault();copyTerminalText(this.term.getSelection());return false;
    }
    if((e.metaKey&&k==='c')||(e.ctrlKey&&e.shiftKey&&k==='c')){
      if(this.term.hasSelection()){e.preventDefault();copyTerminalText(this.term.getSelection());}return false;
    }
    if(e.metaKey&&k==='v'||e.ctrlKey&&e.shiftKey&&k==='v')return false;
    if(e.shiftKey&&(e.key==='PageUp'||e.key==='PageDown')){
      e.preventDefault();this.term.scrollPages(e.key==='PageUp'?-1:1);return false;
    }
    if(e.ctrlKey&&e.key==='Home'){e.preventDefault();this.term.scrollToTop();return false;}
    if(e.ctrlKey&&e.key==='End'){e.preventDefault();this.term.scrollToBottom();return false;}
    if(e.shiftKey&&e.key==='Enter'){e.preventDefault();this.enqueue(()=>busy?undefined:this.insert('\n'));return false;}
    if(e.key==='Escape'){stopEffect();}
    return true;
  }
  async onData(data){
    if(data.startsWith('\x1b[200~')){
      if(!busy&&!this.pager)await this.insert(data.replace(/^\x1b\[200~/,'').replace(/\x1b\[201~$/,''));return;
    }
    if(this.pager){await this.pagerKey(data);return;}
    if(busy){if(data==='\x03'){this.controller?.abort();shell.interrupt();}return;}
    if(this.search){await this.searchKey(data);return;}
    if(data==='\r'){await this.submit();return;}
    if(data==='\t'){await this.complete();return;}
    if(data==='\x03'){
      await this.write(this.eraseSequence()+this.prompt()+this.line.replace(/\n/g,'\r\n> ')+'^C\r\n');
      this.drawn=false;this.line='';this.pos=0;status(130);await this.drawLine();return;
    }
    if(data==='\x0c'){await this.clear();await this.drawLine();return;}
    if(data==='\x12'){this.search={query:'',match:'',index:history.length};await this.findHistory(true);return;}
    if(data==='\x1b[A'||data==='\x1bOA'){
      if(this.historyIndex===history.length)this.draft=this.line;
      if(this.historyIndex>0)await this.setLine(history[--this.historyIndex]);else this.bell();return;
    }
    if(data==='\x1b[B'||data==='\x1bOB'){
      if(this.historyIndex<history.length)await this.setLine(++this.historyIndex===history.length?this.draft:history[this.historyIndex]);else this.bell();return;
    }
    if(['\x1b[D','\x1bOD','\x02'].includes(data)){this.pos=this.prev();await this.drawLine();return;}
    if(['\x1b[C','\x1bOC','\x06'].includes(data)){this.pos=this.next();await this.drawLine();return;}
    if(['\x1b[H','\x1bOH','\x1b[1~','\x01'].includes(data)){this.pos=0;await this.drawLine();return;}
    if(['\x1b[F','\x1bOF','\x1b[4~','\x05'].includes(data)){this.pos=this.line.length;await this.drawLine();return;}
    if(['\x1b[1;5D','\x1b[1;3D','\x1bb'].includes(data)){this.pos=this.wordLeft();await this.drawLine();return;}
    if(['\x1b[1;5C','\x1b[1;3C','\x1bf'].includes(data)){this.pos=this.wordRight();await this.drawLine();return;}
    if(data==='\x7f'||data==='\x08'){await this.remove(this.prev(),this.pos);return;}
    if(data==='\x1b[3~'){await this.remove(this.pos,this.next());return;}
    if(data==='\x17'||data==='\x1b\x7f'){await this.remove(this.wordLeft(),this.pos,true);return;}
    if(data==='\x15'){await this.remove(0,this.pos,true);return;}
    if(data==='\x0b'){await this.remove(this.pos,this.line.length,true);return;}
    if(data==='\x19'){await this.insert(this.kill);return;}
    if(data==='\x04'){if(this.line)await this.remove(this.pos,this.next());else await this.submit('exit');return;}
    if(data==='\x1b[5~'){this.term.scrollPages(-1);return;}
    if(data==='\x1b[6~'){this.term.scrollPages(1);return;}
    if(data==='\x1b')return;
    if(data.startsWith('\x1b')){this.bell();return;}
    await this.insert(data);
  }
  async submit(explicit){
    if(busy)return {job:this.job};
    const line=explicit===undefined?this.line:String(explicit);
    if(explicit===undefined&&incomplete(line)){await this.insert('\n');return {job:Promise.resolve()};}
    if(line.length>4096){this.bell();return {job:Promise.resolve()};}
    busy=true;this.controller=new AbortController();
    this.term.scrollToBottom();
    await this.write(this.eraseSequence()+this.prompt()+line.replace(/\n/g,'\r\n\x1b[90m> \x1b[0m')+'\r\n');
    this.drawn=false;this.line='';this.pos=0;this.draft='';this.search=null;
    if(line.trim()){history.push(line);if(history.length>500)history.shift();}this.historyIndex=history.length;
    const controller=this.controller;
    this.job=(async()=>{
      let code=0;
      $('.shell-state').classList.add('busy');$('#input-status').textContent='running';
      try{
        if(line.trim()){
          const result=await dispatch(line,{
            signal:controller.signal,write:t=>this.output(t),clear:()=>this.clear(),page:(t,name)=>this.page(t,name)
          });
          code=result.code||0;
          if(result.out)await this.output((code?'\x1b[31m':'')+result.out+(code?'\x1b[0m':''));
        }
      }catch(e){code=e.code||1;await this.output('\x1b[31mwebsh: '+e.message+'\x1b[0m\r\n');}
      finally{
        await this.write('\x1b[0m\x1b[?25h');
        if(this.term.buffer.active.cursorX>0)await this.write('\r\n');
        busy=false;this.controller=null;status(code);this.drawn=false;
        await this.drawLine();
      }
      return {code};
    })();
    return {job:this.job};
  }
  async execute(line){await this.ready;const r=await this.enqueue(()=>this.submit(line));return r?.job;}
  async clear(){await this.write('\x1b[2J\x1b[3J\x1b[H');this.drawn=false;}
  async complete(){
    const text=this.line.slice(0,this.pos),m=text.match(/^(.*\s)?([^\s]*)$/s),before=m?.[1]||'',last=m?.[2]||'';
    if(/["']/.test(last)){this.bell();return;}
    let items=[];
    if(!before)items=shell.core.commands.filter(c=>c.startsWith(last));
    else{
      const core=liveCore(),slash=last.lastIndexOf('/'),prefix=slash>=0?last.slice(0,slash+1):'',part=last.slice(slash+1),parent=core.norm(prefix||'.');
      items=core.children(parent,true).filter(p=>p.split('/').pop().startsWith(part)&&(!/^cd\s/.test(text)||core.nodes[p].type==='dir')).map(p=>prefix+p.split('/').pop()+(core.nodes[p].type==='dir'?'/':''));
    }
    items=[...new Set(items)].sort();if(!items.length){this.bell();return;}
    let common=items[0];for(const s of items)while(common&&!s.startsWith(common))common=common.slice(0,-1);
    if(items.length===1||common.length>last.length){
      const replacement=items.length===1?items[0]+(items[0].endsWith('/')?'':' '):common;
      await this.setLine(before+replacement+this.line.slice(this.pos),before.length+replacement.length);return;
    }
    await this.write(this.eraseSequence()+this.prompt()+this.line.replace(/\n/g,'\r\n> ')+'\r\n');this.drawn=false;
    const width=Math.min(Math.max(...items.map(s=>s.length))+3,this.term.cols),columns=Math.max(1,Math.floor(this.term.cols/width));
    for(let i=0;i<items.length;i+=columns)await this.write('\x1b[32m'+items.slice(i,i+columns).map(x=>x.padEnd(width)).join('').trimEnd()+'\x1b[0m\r\n');
    await this.drawLine();
  }
  async findHistory(next=false){
    const s=this.search;if(!s)return;let i=next?s.index-1:history.length-1;
    for(;i>=0;i--)if(history[i].includes(s.query)){s.index=i;s.match=history[i];await this.drawLine();return;}
    if(!next){s.index=history.length;s.match='';}else this.bell();await this.drawLine();
  }
  async searchKey(data){
    if(data==='\x12'){await this.findHistory(true);return;}
    if(data==='\x03'||data==='\x1b'){
      const value=data==='\x03'?'':this.search.match;this.search=null;await this.setLine(value);return;
    }
    if(data==='\r'){
      const value=this.search.match;this.search=null;await this.setLine(value);await this.submit();return;
    }
    if(data==='\x7f'){this.search.query=[...this.search.query].slice(0,-1).join('');await this.findHistory();return;}
    if(!data.startsWith('\x1b')){this.search.query+=data.replace(/[\x00-\x1f\x7f]/g,'');await this.findHistory();}
  }
  async page(text,label){
    this.cancelPageRender();
    $('#input-status').textContent='less';
    await this.write('\x1b[?1049h\x1b[?25l');
    return new Promise(resolve=>{
      this.pager={text:String(text),label,top:0,renderedTop:-1,resolve,lines:[],searching:false,query:'',found:-1};
      this.paginate();this.renderPage();
    });
  }
  paginate(){
    if(!this.pager)return;const out=[],cols=this.term.cols;
    for(const raw of this.pager.text.replace(/\n$/,'').split('\n')){
      let line='',width=0;
      for(const c of raw.replace(/\t/g,'    ')){const w=this.width(c);if(width+w>cols){out.push(line);line='';width=0;}line+=c;width+=w;}
      out.push(line);
    }
    this.pager.lines=out;this.pager.top=Math.max(0,Math.min(this.pager.top,Math.max(0,out.length-this.term.rows+1)));
  }
  schedulePageRender(){
    if(this.pagerFrame!==null||!this.pager||this.disposed)return;
    const p=this.pager;
    const frame=requestAnimationFrame(()=>{
      this.enqueue(async()=>{
        try{if(this.pager===p&&!this.disposed)await this.renderPage();}
        finally{
          if(this.pagerFrame===frame){
            this.pagerFrame=null;
            if(this.pager===p&&p.renderedTop!==p.top)this.schedulePageRender();
          }
        }
      });
    });
    this.pagerFrame=frame;
  }
  cancelPageRender(){
    if(this.pagerFrame!==null)cancelAnimationFrame(this.pagerFrame);
    this.pagerFrame=null;this.pagerWheelRemainder=0;
  }
  async renderPage(){
    const p=this.pager;if(!p)return;
    const top=p.top,height=Math.max(1,this.term.rows-1),body=p.lines.slice(top,top+height);
    while(body.length<height)body.push('~');
    const pct=Math.min(100,Math.round((top+height)/Math.max(1,p.lines.length)*100));
    const footer=p.searching?'/'+p.query:`${p.label}  ${pct}%  ·  ↑↓ j/k  Space  /  q`;
    await this.write('\x1b[H\x1b[2J'+body.map(x=>x==='~'?'\x1b[90m~\x1b[0m':x).join('\r\n')+'\x1b['+this.term.rows+';1H\x1b[7m'+footer.slice(0,this.term.cols-1).padEnd(this.term.cols-1)+'\x1b[0m\x1b[?25l');
    p.renderedTop=top;
  }
  async movePage(delta){if(!this.pager)return;this.pager.top=Math.max(0,Math.min(this.pager.top+delta,Math.max(0,this.pager.lines.length-this.term.rows+1)));await this.renderPage();}
  async pagerKey(data){
    const p=this.pager;if(!p)return;
    if((data==='q'&&!p.searching)||data==='\x03'||data==='\x1b'){
      if(p.searching&&data!=='\x03'){p.searching=false;await this.renderPage();return;}
      this.pager=null;this.cancelPageRender();await this.write('\x1b[?1049l\x1b[?25h');p.resolve(data==='\x03'?130:0);return;
    }
    if(p.searching){
      if(data==='\r'){p.searching=false;const found=p.lines.findIndex((s,i)=>i>=p.top&&s.toLowerCase().includes(p.query.toLowerCase()));if(found>=0)p.top=Math.min(found,Math.max(0,p.lines.length-this.term.rows+1));else this.bell();}
      else if(data==='\x7f')p.query=[...p.query].slice(0,-1).join('');
      else p.query+=data.replace(/[\x00-\x1f\x7f]/g,'');await this.renderPage();return;
    }
    if(data==='/'){p.searching=true;p.query='';await this.renderPage();return;}
    if(['j','\x1b[B','\r'].includes(data))await this.movePage(1);
    else if(['k','\x1b[A'].includes(data))await this.movePage(-1);
    else if([' ','f','\x1b[6~'].includes(data))await this.movePage(this.term.rows-2);
    else if(['b','\x1b[5~'].includes(data))await this.movePage(-(this.term.rows-2));
    else if(data==='g')await this.movePage(-Infinity);
    else if(data==='G')await this.movePage(Infinity);
  }
  requestFit(){
    if(this.pendingFit)return;this.pendingFit=true;
    requestAnimationFrame(()=>this.enqueue(async()=>{
      this.pendingFit=false;const size=innerWidth<=760?16:17;
      const dims=this.fit.proposeDimensions();if(!dims)return;
      if(this.term.options.fontSize===size&&dims.cols===this.term.cols&&dims.rows===this.term.rows)return;
      if(this.drawn&&!busy){await this.write(this.eraseSequence());this.drawn=false;}
      this.term.options.fontSize=size;this.fit.fit();
      if(this.pager){this.paginate();await this.renderPage();}else if(!busy)await this.drawLine();
    }));
  }
  focus(force=false){if(!document.querySelector('dialog[open]')&&(force||matchMedia('(pointer:fine)').matches))this.term.focus();}
  snapshot(){
    const b=this.term.buffer.active;return Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)||'').join('\n');
  }
  dispose(){this.disposed=true;this.cancelPageRender();this.container.removeEventListener('wheel',this.pagerWheel,true);clearTimeout(this.bellTimer);this.resizeObserver.disconnect();this.controller?.abort();this.term.dispose();}
}
const consoleShell=new PortfolioTerminal($('#terminal'));
function focusInput(force=false){consoleShell.focus(force);}
/* Accessible split-pane resize. */
const divider=$('#shell-resizer'),mainPanel=$('#main-panel'),shellPanel=$('#shell-panel');
let resizeStart=null,manualShellHeight=null;
function sizeBounds(){const total=mainPanel.clientHeight;return {min:Math.min(160,Math.max(120,total-100)),max:Math.max(160,total-125)};}
function setShellHeight(height){const b=sizeBounds(),h=Math.round(Math.max(b.min,Math.min(b.max,height)));shellPanel.style.setProperty('--shell-height',h+'px');manualShellHeight=h;divider.setAttribute('aria-valuenow',h);divider.setAttribute('aria-valuemin',b.min);divider.setAttribute('aria-valuemax',b.max);consoleShell.requestFit();return h;}
function updateDivider(){const b=sizeBounds();if(manualShellHeight!==null)setShellHeight(manualShellHeight);else{if(shellPanel.clientHeight>b.max)setShellHeight(b.max);divider.setAttribute('aria-valuenow',Math.round(shellPanel.clientHeight));divider.setAttribute('aria-valuemin',b.min);divider.setAttribute('aria-valuemax',b.max);}consoleShell.requestFit();}
function resetShellHeight(){manualShellHeight=null;shellPanel.style.removeProperty('--shell-height');updateDivider();}
divider.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();resizeStart={y:e.clientY,h:shellPanel.clientHeight};divider.setPointerCapture(e.pointerId);document.body.classList.add('resizing-shell');});
divider.addEventListener('pointermove',e=>{if(resizeStart)setShellHeight(resizeStart.h+resizeStart.y-e.clientY);});
function endResize(){resizeStart=null;document.body.classList.remove('resizing-shell');}
for(const event of ['pointerup','pointercancel','lostpointercapture'])divider.addEventListener(event,endResize);
divider.addEventListener('dblclick',resetShellHeight);
divider.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const b=sizeBounds(),h=shellPanel.clientHeight;setShellHeight(e.key==='Home'?b.min:e.key==='End'?b.max:h+(e.key==='ArrowUp'?24:-24));}else if(e.key==='Enter'){e.preventDefault();resetShellHeight();}});
window.addEventListener('resize',()=>{updateDivider();if(innerWidth>760)closeSidebar();});
