function theme(t){
  if(!['light','dark','amber'].includes(t))return false;
  document.documentElement.dataset.theme=t;
  try{localStorage.setItem('icey-theme',t);}catch(e){}
  $('meta[name="theme-color"]').content=t==='light'?'#f4f4ee':t==='dark'?'#1d231e':'#261f19';
  if(typeof consoleShell!=='undefined')consoleShell.updateTheme();return true;
}
/* Logical newlines become command separators except in quotes / after operators.
   Bracketed paste only edits the buffer. Nothing in pasted text auto-executes. */
function scriptText(source){
  let out='',quote=null;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(c==='\\'&&quote!=="'"){
      if(source[i+1]==='\n'){i++;continue;}
      out+=c;if(i+1<source.length)out+=source[++i];continue;
    }
    if(quote){out+=c;if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"){quote=c;out+=c;continue;}
    if(c==='#'&&(!out||/[\s;|&]/.test(out.at(-1)))){while(i<source.length&&source[i]!=='\n')i++;if(i>=source.length)break;}
    if(source[i]==='\n'){
      const before=out.trimEnd();out=before+(!before||/[|;&]$/.test(before)?' ':'; ');continue;
    }
    out+=c;
  }
  return out;
}
function incomplete(source){
  let quote=null,escaped=false;
  for(const c of source){if(escaped){escaped=false;continue;}if(c==='\\'&&quote!=="'"){escaped=true;continue;}if(quote){if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;}
  return !!quote||escaped||/(?:\|\||&&|[^|]\|)\s*$/.test(source);
}
function singleCommand(line){try{const tokens=liveCore().lex(line);if(tokens.some(t=>t.op))return null;return tokens.flatMap(t=>liveCore().expand(t,false));}catch(e){return null;}}
function refreshDocument(){
  syncBlogNavigation();
  if(current.type==='dir'){renderDocument(true);return;}
  if(current.type==='file'&&shell.state.nodes[current.path]?.text!==current.source){
    if(shell.state.nodes[current.path])renderDocument(true);else openDoc('about');
  }
}
async function dispatch(source,io){
  const line=scriptText(source).trim(),args=singleCommand(line),cmd=args?.[0],a=args?.slice(1)||[];
  let result={out:'',code:0};
  if(['about','bio','blog','projects','skills','life'].includes(cmd)){
    if(a.length>1||a.length&&!['projects','blog'].includes(cmd))throw new Error('Usage: '+cmd+(['projects','blog'].includes(cmd)?' [section]':''));
    const key=cmd+(a[0]?'/'+a[0].replace(/\.md$/,''):'');
    const path=docPaths[key]||(cmd==='blog'&&a[0]?HOME+'/blog/'+a[0].replace(/\.md$/,'')+'.md':null);
    if(!path)throw new Error('No such section: '+key);
    result.out='→ '+prettyPath(openFile(path))+'\n';
  }else if(['preview','view','source','open'].includes(cmd)){
    if(a.length>1||!a.length&&cmd!=='source')throw new Error('Usage: '+cmd+' <file>');
    result.out='→ '+prettyPath(openFile(a[0]||current.path,cmd==='source'?'source':'preview'))+'\n';
  }else if(cmd==='help'||cmd==='man')result.out=helpText();
  else if(cmd==='clear'&&!a.length)await io.clear();
  else if(cmd==='history'&&!a.length)result.out=history.map((x,i)=>`${String(i+1).padStart(4)}  ${x}`).join('\n')+'\n';
  else if(cmd==='exit'&&!a.length){openDoc('about');result.out='→ ~/about.md\n';}
  else if(cmd==='neofetch'&&!a.length)result.out=neofetch();
  else if(cmd==='achievements'&&!a.length)result.out=achievements();
  else if(cmd==='fortune'&&!a.length)result.out='✧ '+fortunes[Math.floor(Math.random()*fortunes.length)]+'\n';
  else if(cmd==='piano'&&!a.length){result.out='♫ A different kind of keyboard.\n';discover('piano');openPiano();}
  else if(cmd==='mew'&&!a.length||cmd==='cowsay'){
    result.out=' /\\_/\\\n( o.o )\n > ^ <\n\n'+(cmd==='mew'?'你好呀，欢迎来我的小小终端。':a.join(' '))+'\n';discover('mew');
  }else if(cmd==='coffee'&&!a.length)result.out='   ( (\n    ) )\n  .------.\n  |      |]\n  \\      /\n   `----\'\n\n休息一下，别忘了喝水。\n';
  else if(cmd==='sl'&&!a.length){result.out='Next stop: something interesting.\n';discover('sl');train();}
  else if(cmd==='matrix'&&!a.length){result.out='Follow the little green letters. Esc to return.\n';discover('matrix');matrix();}
  else if(line==='sudo make me a sandwich'){result.out='🥪 Okay. 这次就给你一点管理员的偏爱。\n';discover('sandwich');}
  else if(cmd==='demo'&&!a.length){
    await io.write('A small idea, coming together.\n');
    for(let n=0;n<=30;n++){
      if(io.signal.aborted)return {out:'^C\n',code:130};
      const filled=Math.round(n/30*20);
      await io.write(`\r\x1b[2K\x1b[32m[${'━'.repeat(filled)}${'·'.repeat(20-filled)}]\x1b[0m  ${String(Math.round(n/30*100)).padStart(3)}%`);
      await new Promise(r=>setTimeout(r,45));
    }
    result.out='\r\x1b[2K\x1b[32m✓\x1b[0m Something small. Something that works.\n';
  }else if(cmd==='less'){
    if(a.length!==1)throw new Error('Usage: less <file>');
    return {out:'',code:await io.page(liveCore().file(a[0]),prettyPath(liveCore().norm(a[0])))};
  }else if(/\|\s*less\s*$/.test(line)){
    const tokens=liveCore().lex(line),last=tokens.at(-1),before=tokens.at(-2);
    if(before?.op==='|'&&last?.word&&liveCore().expand(last,false)[0]==='less'){
      const r=await shell.run(line.replace(/\|\s*less\s*$/,''));
      if(r.code)return r;return {out:'',code:await io.page(r.out,'stdin')};
    }
    result=await shell.run(line);
  }else if(cmd==='resetfs'&&!a.length){
    if(confirm('重置工作文件？新建和修改的文件将被清除。')){shell.reset();result.out='Filesystem restored.\n';if(!shell.state.nodes[current.path])openDoc('about');else renderDocument(true);}
    else result.out='Cancelled.\n';
  }else result=await shell.run(line);
  refreshDocument();return result;
}
function run(line){return consoleShell.execute(line);}
