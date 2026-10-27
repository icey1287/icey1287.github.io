
/*
 * icey Web Shell: an explicitly documented, sandboxed POSIX-like subset.
 * No eval(), no network, no host filesystem. Work happens inside a Worker.
 */
(function(root) {
'use strict';
class ShellCore {
  constructor(files, snapshot) {
    this.env = { HOME:'/', USER:'visitor', SHELL:'icey-web-shell', TERM:'xterm-256color', LANG:'zh_CN.UTF-8', PATH:'', PWD:'/' };
    this.cwd = '/'; this.last = 0; this.nodes = {};
    this.commands = ('help ls ll pwd cd cat head tail grep wc sort uniq cut find tree echo printf touch mkdir rmdir rm cp mv date uname whoami id env export unset which type basename dirname true false sleep clear history about bio blog notes activity projects skills life neofetch fortune mew cowsay coffee sl matrix piano open preview view source man achievements resetfs seq less demo exit').split(' ');
    if (snapshot) { this.nodes=snapshot.nodes; this.cwd=snapshot.cwd; this.env=snapshot.env; this.last=snapshot.last; return; }
    // The site content is the filesystem root; no synthetic OS directories.
    this.nodes['/']={type:'dir',protected:true};
    for (const [p, text] of Object.entries(files)) {
      const parts=p.split('/'); parts.pop(); let dir='';
      for (const part of parts.filter(Boolean)) { dir += '/'+part; if(!this.nodes[dir]) this.nodes[dir]={type:'dir',protected:true}; }
      this.nodes[p]=text && typeof text==='object' && text.type==='dir'
        ? {type:'dir',protected:true} : {type:'file',text,protected:true};
    }
  }
  snapshot(){ return {nodes:this.nodes,cwd:this.cwd,env:this.env,last:this.last}; }
  fail(message, code=1){ const e=new Error(message); e.code=code; throw e; }
  norm(path='.', base=this.cwd){
    if(path==='~') path=this.env.HOME;
    else if(path.startsWith('~/')) path=this.env.HOME+path.slice(1);
    const out=[]; for(const x of ((path.startsWith('/')?'':base+'/')+path).split('/')) { if(!x||x==='.')continue; if(x==='..')out.pop();else out.push(x); }
    return '/'+out.join('/');
  }
  dir(path){ const p=this.norm(path);const n=this.nodes[p];if(!n)this.fail(`${path}: No such file or directory`);if(n.type!=='dir')this.fail(`${path}: Not a directory`);return p; }
  file(path){const p=this.norm(path),n=this.nodes[p];if(!n)this.fail(`${path}: No such file or directory`);if(n.type!=='file')this.fail(`${path}: Is a directory`);return n.text;}
  parent(p){return p.slice(0,p.lastIndexOf('/'))||'/';}
  children(path,hidden=true){return Object.keys(this.nodes).filter(x=>x!==path&&this.parent(x)===path&&(hidden||!x.split('/').pop().startsWith('.'))).sort();}
  write(path,text,append=false){
    const p=this.norm(path),n=this.nodes[p];this.dir(this.parent(p));
    if(n?.protected)this.fail(`${path}: Permission denied`);
    if(n?.type==='dir')this.fail(`${path}: Is a directory`);
    const next=(append&&n?n.text:'')+text;
    if(next.length>131072)this.fail('write: file too large');
    if(!n&&Object.keys(this.nodes).length>=512)this.fail('write: too many files');
    const total=Object.values(this.nodes).reduce((s,x)=>s+(x.text?.length||0),0)-(n?.text?.length||0)+next.length;
    if(total>1048576)this.fail('write: no space left on device');
    this.nodes[p]={type:'file',text:next,protected:false};
  }
  lex(line){
    if(line.length>4096)this.fail('Command is too long (4096 characters maximum).',2);
    const tokens=[];let parts=[],buf='',quote=null,started=false;
    const part=()=>{if(buf){parts.push({text:buf,q:quote});buf='';}};
    const word=()=>{part();if(started){tokens.push({word:parts});parts=[];started=false;}};
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(quote){if(c===quote){part();quote=null;}else if(c==='\\'&&quote==='"'&&['"','\\','$'].includes(line[i+1])){part();parts.push({text:line[++i],q:"'"});}else buf+=c;continue;}
      if(c==='"'||c==="'"){part();quote=c;started=true;continue;}
      if(c==='\\'){if(i===line.length-1)this.fail('Incomplete escape.',2);part();parts.push({text:line[++i],q:"'"});started=true;continue;}
      if(/\s/.test(c)){word();continue;}
      if(c==='#'&&!started)break;
      if(c==='`'||(c==='$'&&line[i+1]==='('))this.fail('syntax error: unexpected command substitution',2);
      if('|;&<>'.includes(c)){
        word();let op=c;if(line[i+1]===c&&['|','&','>'].includes(c))op+=line[++i];
        if(op==='&')this.fail('syntax error: unexpected &',2);
        tokens.push({op});continue;
      }
      buf+=c;started=true;
    }
    if(quote)this.fail('Unclosed quote.',2);word();return tokens;
  }
  expand(token, glob=true){
    if(!token?.word)this.fail('Expected a word.',2);
    let wildcard=false;
    const s=token.word.map(p=>{if(p.q!=="'"&&p.q!=='"'&&/[*?]/.test(p.text))wildcard=true;return p.q==="'"?p.text:p.text.replace(/\$(?:\{([A-Za-z_][\w]*)\}|([A-Za-z_][\w]*|\?))/g,(_,a,b)=>(a||b)==='?'?String(this.last):this.env[a||b]||'');}).join('');
    let val=s;if(token.word[0]?.q===null&&(s==='~'||s.startsWith('~/')))val=this.env.HOME+s.slice(1);
    if(!wildcard||!glob)return [val];
    const abs=this.norm(val),re=this.globRegex(abs),matches=Object.keys(this.nodes).filter(p=>re.test(p)&&(!p.split('/').pop().startsWith('.')||val.split('/').pop().startsWith('.'))).sort();
    if(!matches.length)return [val];
    const prefix=this.cwd==='/'?'/':this.cwd+'/';
    return matches.map(p=>val.startsWith('/')?p:(p.startsWith(prefix)?p.slice(prefix.length):p));
  }
  globRegex(s){return new RegExp('^'+s.split('').map(c=>c==='*'?'[^/]*':c==='?'?'[^/]':/[.+^${}()|[\]\\]/.test(c)?'\\'+c:c).join('')+'$');}
  async execute(line){
    try{
      const tokens=this.lex(line);if(!tokens.length)return {out:'',code:0};
      let groups=[],cur=[],connector=';';
      for(const t of tokens){if(t.op&&[';','&&','||'].includes(t.op)){if(!cur.length)this.fail('Unexpected operator: '+t.op,2);groups.push({tokens:cur,connector});cur=[];connector=t.op;}else cur.push(t);}
      if(cur.length)groups.push({tokens:cur,connector});else if(connector!==';')this.fail('Incomplete conditional command.',2);
      let output='',lastCode=0;
      for(const g of groups){
        if((g.connector==='&&'&&lastCode!==0)||(g.connector==='||'&&lastCode===0))continue;
        const stages=[];let stage=[];
        for(const t of g.tokens){if(t.op==='|'){if(!stage.length)this.fail('Empty pipeline stage.',2);stages.push(stage);stage=[];}else stage.push(t);}
        if(!stage.length)this.fail('Incomplete pipeline.',2);stages.push(stage);if(stages.length>12)this.fail('Pipeline limit: 12 stages.',2);
        let input='',pipelineErr='';
        for(const st of stages){
          try {
            const args=[];let redirect=null,infile=null;
            for(let i=0;i<st.length;i++){
              const t=st[i];if(t.op){if(!['>','>>','<'].includes(t.op))this.fail('Unsupported operator: '+t.op,2);const target=this.expand(st[++i],false)[0];if(t.op==='<')infile=target;else redirect={path:target,append:t.op==='>>'};}
              else args.push(...this.expand(t));
            }
            if(infile!==null)input=this.file(infile);
            const result=await this.run(args,input);input=result.out||'';lastCode=result.code||0;
            if(input.length>131072)this.fail('Output exceeds 128 KiB limit; narrow the command.');
            if(redirect){this.write(redirect.path,input,redirect.append);input='';}
          }catch(e){pipelineErr+=(e.message||String(e))+'\n';input='';lastCode=e.code||1;}
          this.last=lastCode;
        }
        output+=pipelineErr+input;
        if(output.length>131072)this.fail('Output exceeds 128 KiB limit.');
      }
      return {out:output,code:lastCode};
    }catch(e){this.last=e.code||2;return {out:'websh: '+e.message+'\n',code:this.last};}
  }
  result(out='',code=0){return {out,code};}
  async run(a,stdin){
    if(!a.length)return this.result();
    let cmd=a.shift();
    const singleAliases={bio:'about',ll:'ls'};if(cmd==='ll')a.unshift('-al');cmd=singleAliases[cmd]||cmd;
    const aliases={about:'about.md',skills:'skills.json',activity:'空间动态.md'};
    if(aliases[cmd])return this.result(this.file('/'+aliases[cmd]));
    if(['projects','blog','notes','life'].includes(cmd)){
      const dir='/'+(cmd==='notes'?'Notes':cmd);
      if(a.length>1)this.fail(cmd+': expected zero or one section name');
      if(a.length)return this.result(this.file(dir+'/'+a[0].replace(/\.md$/,'')+'.md'));
      return this.result(this.children(dir).filter(p=>p.endsWith('.md')).map(p=>this.file(p)).join('\n'));
    }
    if(cmd==='help')return this.result('icey websh\n\n'+this.commands.join('  ')+'\n');
    if(cmd==='pwd')return this.result(this.cwd+'\n');
    if(cmd==='cd'){if(a.length>1)this.fail('cd: too many arguments');const dest=a[0]==='-'?this.env.OLDPWD:(a[0]||this.env.HOME);if(!dest)this.fail('cd: OLDPWD not set');const p=this.dir(dest);this.env.OLDPWD=this.cwd;this.cwd=p;this.env.PWD=p;return this.result(a[0]==='-'?p+'\n':'');}
    if(cmd==='true'||cmd==='false')return this.result('',cmd==='true'?0:1);
    if(cmd==='echo'){let newline=true,escape=false;while(a[0]==='-n'||a[0]==='-e'){const x=a.shift();if(x==='-n')newline=false;else escape=true;}let s=a.join(' ');if(escape)s=this.unescape(s);return this.result(s+(newline?'\n':''));}
    if(cmd==='printf'){if(!a.length)return this.result();let fmt=this.unescape(a.shift()),idx=0;const s=fmt.replace(/%([%sd])/g,(_,t)=>t==='%'?'%':t==='d'?String(parseInt(a[idx++]||'0',10)||0):(a[idx++]||''));return this.result(s);}
    if(cmd==='ls'){
      let all=false,long=false,dirs=[];
      for(const x of a){if(x==='--color=never'||x==='--color=auto')continue;if(x.startsWith('-')&&x!=='-'){for(const c of x.slice(1)){if(c==='a'||c==='A')all=true;else if(c==='l')long=true;else if(c!=='1')this.fail('ls: invalid option -- '+c);}}else dirs.push(x);}
      if(!dirs.length)dirs=['.'];let out=[];
      for(const d of dirs){const p=this.norm(d),n=this.nodes[p];if(!n)this.fail('ls: '+d+': No such file or directory');const files=n.type==='dir'?this.children(p,all):[p];if(dirs.length>1)out.push(d+':');
        for(const f of files){const node=this.nodes[f],name=f.split('/').pop()+(node.type==='dir'?'/':'');out.push(long?`${node.type==='dir'?'d':'-'}${node.protected?'r-xr-xr-x':'rw-r--r--'}  visitor  ${String(node.text?new TextEncoder().encode(node.text).length:0).padStart(6)}  ${name}`:name);}
      }return this.result(out.join('\n')+(out.length?'\n':''));
    }
    if(cmd==='cat'){
      let numbered=false,paths=[];for(const x of a){if(x==='-n')numbered=true;else if(x.startsWith('-')&&x!=='-')this.fail('cat: unsupported option '+x);else paths.push(x);}
      let text=paths.length?paths.map(p=>p==='-'?stdin:this.file(p)).join(''):stdin;if(numbered)text=this.lines(text).map((x,i)=>String(i+1).padStart(5)+'  '+x).join('\n')+(text.endsWith('\n')?'\n':'');return this.result(text);
    }
    if(cmd==='head'||cmd==='tail'){
      let n=10,paths=[];for(let i=0;i<a.length;i++){if(a[i]==='-n'){n=Number(a[++i]);}else if(/^-\d+$/.test(a[i]))n=Number(a[i].slice(1));else if(a[i].startsWith('-')&&a[i]!=='-')this.fail(cmd+': unsupported option '+a[i]);else paths.push(a[i]);}if(!Number.isInteger(n)||n<0)this.fail(cmd+': invalid line count');
      const get=text=>{const arr=this.lines(text);return (cmd==='head'?arr.slice(0,n):n?arr.slice(-n):[]).join('\n')+(n&&arr.length?'\n':'');};return this.result(paths.length?paths.map(p=>(paths.length>1?'==> '+p+' <==\n':'')+get(p==='-'?stdin:this.file(p))).join(''):get(stdin));
    }
    if(cmd==='grep'){
      let insensitive=false,number=false,invert=false,count=false,recursive=false,onlynames=false,extended=false,fixed=false,patterns=[];
      let options=true;for(const x of a){if(options&&x==='--'){options=false;continue;}if(options&&x.startsWith('-')&&x!=='-'){for(const c of x.slice(1)){if(c==='i')insensitive=true;else if(c==='n')number=true;else if(c==='v')invert=true;else if(c==='c')count=true;else if(c==='r'||c==='R')recursive=true;else if(c==='l')onlynames=true;else if(c==='E')extended=true;else if(c==='F')fixed=true;else this.fail('grep: unsupported option '+c);}}else patterns.push(x);}
      if(!patterns.length)this.fail('grep: usage: grep [-invcFlrE] pattern [file ...]',2);const pattern=patterns.shift();if(pattern.length>128)this.fail('grep: pattern limit 128 characters');
      let re;try{re=new RegExp(fixed?pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'):pattern,insensitive?'i':'');}catch(e){this.fail('grep: invalid pattern: '+e.message,2);}
      let paths=[];for(const p of patterns){const path=this.norm(p);if(this.nodes[path]?.type==='dir'&&recursive)paths.push(...Object.keys(this.nodes).filter(x=>x.startsWith(path==='/'?'/':path+'/')&&this.nodes[x].type==='file'));else paths.push(p);}
      if(!paths.length&&recursive)paths=Object.keys(this.nodes).filter(x=>x.startsWith(this.cwd==='/'?'/':this.cwd+'/')&&this.nodes[x].type==='file');
      const inputs=paths.length?paths.map(p=>({name:p,text:p==='-'?stdin:this.file(p)})):[{name:'',text:stdin}];let out=[],total=0;
      for(const {name,text} of inputs){let matches=[];this.lines(text).forEach((line,i)=>{const found=re.test(line);if(found!==invert)matches.push({line,n:i+1});});total+=matches.length;
        if(onlynames){if(matches.length&&name)out.push(name);}else if(count)out.push((inputs.length>1?name+':':'')+matches.length);else for(const m of matches)out.push((inputs.length>1?name+':':'')+(number?m.n+':':'')+m.line);
      }return this.result(out.join('\n')+(out.length?'\n':''),total?0:1);
    }
    if(cmd==='wc'){
      let flags='',paths=[];for(const x of a){if(x.startsWith('-')&&x!=='-'){if(!/^-([lwc]+)$/.test(x))this.fail('wc: supported options: -l -w -c');flags+=x.slice(1);}else paths.push(x);}if(!flags)flags='lwc';
      const count=text=>({l:(text.match(/\n/g)||[]).length,w:(text.match(/\S+/g)||[]).length,c:new TextEncoder().encode(text).length});const sum={l:0,w:0,c:0},rows=[];
      for(const p of paths.length?paths:['']){const c=count(p&&p!=='-'?this.file(p):stdin);for(const k of 'lwc')sum[k]+=c[k];rows.push([...new Set(flags)].map(k=>c[k]).join(' ')+(p?' '+p:''));}if(paths.length>1)rows.push([...new Set(flags)].map(k=>sum[k]).join(' ')+' total');return this.result(rows.join('\n')+'\n');
    }
    if(cmd==='sort'||cmd==='uniq'){
      let flags='',paths=[];for(const x of a){if(x.startsWith('-'))flags+=x.slice(1);else paths.push(x);}const allowed=cmd==='sort'?'rnu':'cd';if([...flags].some(c=>!allowed.includes(c)))this.fail(cmd+': unsupported flag');
      let lines=this.lines(paths.length?paths.map(p=>this.file(p)).join(''):stdin);
      if(cmd==='sort'){lines.sort(flags.includes('n')?(x,y)=>(parseFloat(x)||0)-(parseFloat(y)||0):undefined);if(flags.includes('r'))lines.reverse();if(flags.includes('u'))lines=[...new Set(lines)];}
      else {const runs=[];for(const s of lines){if(runs.length&&runs[runs.length-1].s===s)runs[runs.length-1].n++;else runs.push({s,n:1});}lines=runs.filter(r=>!flags.includes('d')||r.n>1).map(r=>(flags.includes('c')?r.n+' ':'')+r.s);}
      return this.result(lines.join('\n')+(lines.length?'\n':''));
    }
    if(cmd==='cut'){
      let delim='\t',fields=null,paths=[];for(let i=0;i<a.length;i++){if(a[i]==='-d')delim=a[++i];else if(a[i].startsWith('-d'))delim=a[i].slice(2);else if(a[i]==='-f')fields=a[++i];else if(a[i].startsWith('-f'))fields=a[i].slice(2);else if(a[i].startsWith('-'))this.fail('usage: cut -d delimiter -f fields [file ...]');else paths.push(a[i]);}
      if(!fields||delim.length!==1)this.fail('cut: usage: cut -d : -f 1,2');const indices=[];for(const x of fields.split(',')){if(/^\d+$/.test(x))indices.push(Number(x)-1);else{const m=x.match(/^(\d+)-(\d+)$/);if(!m)this.fail('cut: invalid field list');for(let i=+m[1];i<=Math.min(+m[2],256);i++)indices.push(i-1);}}if(indices.some(i=>i<0))this.fail('cut: fields are numbered from 1');
      const txt=paths.length?paths.map(p=>this.file(p)).join(''):stdin;return this.result(this.lines(txt).map(l=>l.includes(delim)?indices.map(i=>l.split(delim)[i]).filter(x=>x!==undefined).join(delim):l).join('\n')+(txt?'\n':''));
    }
    if(cmd==='tree'){
      let all=false,depth=6,where='.';for(let i=0;i<a.length;i++){if(a[i]==='-a')all=true;else if(a[i]==='-L')depth=Number(a[++i]);else if(a[i].startsWith('-'))this.fail('usage: tree [-a] [-L depth] [path]');else where=a[i];}if(!Number.isInteger(depth)||depth<0||depth>20)this.fail('tree: depth must be 0–20');const p=this.dir(where);let rows=[where],dirs=0,files=0;
      const walk=(path,prefix,d)=>{if(d>=depth)return;const arr=this.children(path,all);arr.forEach((f,i)=>{const n=this.nodes[f],last=i===arr.length-1;rows.push(prefix+(last?'└── ':'├── ')+f.split('/').pop()+(n.type==='dir'?'/':''));if(n.type==='dir'){dirs++;walk(f,prefix+(last?'    ':'│   '),d+1);}else files++;});};walk(p,'',0);rows.push(`\n${dirs} directories, ${files} files`);return this.result(rows.join('\n')+'\n');
    }
    if(cmd==='find'){
      let where='.',name=null,type=null,i=0;if(a[0]&&!a[0].startsWith('-')){where=a[0];i++;}for(;i<a.length;i++){if(a[i]==='-name')name=a[++i];else if(a[i]==='-type')type=a[++i];else this.fail('usage: find [path] [-name pattern] [-type f|d]');}if(type&&!['f','d'].includes(type))this.fail('find: -type must be f or d');const p=this.norm(where);if(!this.nodes[p])this.fail('find: No such path');const re=name?this.globRegex(name):null;const found=Object.keys(this.nodes).filter(x=>(x===p||x.startsWith(p==='/'?'/':p+'/'))&&(!re||re.test(x.split('/').pop()))&&(!type||this.nodes[x].type===(type==='f'?'file':'dir'))).sort();return this.result(found.map(x=>where==='.'?(x===p?'.':'./'+x.slice(p==='/'?1:p.length+1)):x).join('\n')+(found.length?'\n':''));
    }
    if(cmd==='touch'){if(!a.length)this.fail('touch: missing operand');for(const p of a){const n=this.nodes[this.norm(p)];if(n?.protected)this.fail('touch: Permission denied');if(!n)this.write(p,'');}return this.result();}
    if(cmd==='mkdir'){
      let parents=false,paths=[];for(const x of a){if(x==='-p')parents=true;else if(x.startsWith('-'))this.fail('usage: mkdir [-p] directory ...');else paths.push(x);}if(!paths.length)this.fail('mkdir: missing operand');
      for(const p of paths){const n=this.norm(p);if(this.nodes[n]){if(parents&&this.nodes[n].type==='dir')continue;this.fail('mkdir: '+p+': File exists');}const list=parents?n.split('/').filter(Boolean).map((_,i)=>'/'+n.split('/').filter(Boolean).slice(0,i+1).join('/')):[n];for(const d of list){if(!this.nodes[d]){this.dir(this.parent(d));if(Object.keys(this.nodes).length>=512)this.fail('mkdir: too many files');this.nodes[d]={type:'dir',protected:false};}else if(this.nodes[d].type!=='dir')this.fail('mkdir: Not a directory');}}return this.result();
    }
    if(cmd==='rm'||cmd==='rmdir'){
      let recursive=false,force=false,paths=[];for(const x of a){if(x.startsWith('-')){for(const c of x.slice(1)){if(c==='r'||c==='R')recursive=true;else if(c==='f')force=true;else this.fail(cmd+': unsupported option '+c);}}else paths.push(x);}if(!paths.length&&!force)this.fail(cmd+': missing operand');
      for(const path of paths){const p=this.norm(path),n=this.nodes[p];if(!n){if(force)continue;this.fail(cmd+': No such file: '+path);}const descendants=Object.keys(this.nodes).filter(x=>x===p||x.startsWith(p==='/'?'/':p+'/'));if(descendants.some(x=>this.nodes[x].protected))this.fail(cmd+': Permission denied');if(cmd==='rmdir'&&n.type!=='dir')this.fail('rmdir: Not a directory');if(n.type==='dir'&&descendants.length>1&&(cmd==='rmdir'||!recursive))this.fail(cmd+': Directory not empty; rm requires -r');if(n.type==='dir'&&cmd==='rm'&&!recursive)this.fail('rm: Is a directory');descendants.forEach(x=>delete this.nodes[x]);if(!this.nodes[this.cwd]){this.cwd=this.env.HOME;this.env.PWD=this.cwd;}}
      return this.result();
    }
    if(cmd==='cp'||cmd==='mv'){
      if(a.some(x=>x.startsWith('-')))this.fail(cmd+': invalid option');if(a.length!==2)this.fail(cmd+': usage: '+cmd+' source destination');const src=this.norm(a[0]),n=this.nodes[src];if(!n||n.type!=='file')this.fail(cmd+': source must be a file');if(cmd==='mv'&&n.protected)this.fail('mv: Permission denied');let dest=this.norm(a[1]);if(this.nodes[dest]?.type==='dir')dest+='/'+src.split('/').pop();if(src===dest)this.fail(cmd+': source and destination are the same file');this.write(dest,n.text);if(cmd==='mv')delete this.nodes[src];return this.result();
    }
    if(cmd==='date'){if(a[0]==='-I')return this.result(new Date().toISOString().slice(0,10)+'\n');if(a[0]&&a[0]!=='-u')this.fail('usage: date [-u|-I]');return this.result((a[0]==='-u'?new Date().toUTCString():new Date().toString())+'\n');}
    if(cmd==='uname')return this.result('icey-websh 4\n');
    if(cmd==='whoami')return this.result('visitor\n');
    if(cmd==='id')return this.result('visitor (websh)\n');
    if(cmd==='env')return this.result(Object.entries(this.env).map(([k,v])=>k+'='+v).join('\n')+'\n');
    if(cmd==='export'){if(!a.length)return this.run(['env'],stdin);for(const x of a){const m=x.match(/^([A-Za-z_]\w*)=(.*)$/s);if(!m)this.fail('export: use NAME=value');if(['HOME','PWD','SHELL','USER'].includes(m[1]))this.fail('export: readonly variable: '+m[1]);this.env[m[1]]=m[2];}return this.result();}
    if(cmd==='unset'){for(const key of a){if(['HOME','PWD','SHELL','USER'].includes(key))this.fail('unset: readonly variable: '+key);delete this.env[key];}return this.result();}
    if(cmd==='which'||cmd==='type'){return this.result(a.map(x=>this.commands.includes(x)?x+' is a shell builtin':x+' not found').join('\n')+'\n',a.every(x=>this.commands.includes(x))?0:1);}
    if(cmd==='basename')return this.result((a[0]||'').replace(/\/$/,'').split('/').pop()+'\n');
    if(cmd==='dirname')return this.result(this.parent(a[0]||'.')==='/'&&!a[0]?.includes('/')?'.\n':this.parent(a[0]||'.')+'\n');
    if(cmd==='seq'){const v=a.map(Number);if(!v.length||v.length>3||v.some(n=>!Number.isFinite(n)))this.fail('seq: expected [first [step]] last');const first=v.length===1?1:v[0],step=v.length===3?v[1]:1,last=v[v.length-1];if(step===0)this.fail('seq: step must not be zero');let out=[],n=first;while(step>0?n<=last:n>=last){if(out.length>=5000)this.fail('seq: maximum 5000 values');out.push(String(+n.toFixed(10)));n+=step;}return this.result(out.join('\n')+(out.length?'\n':''));}
    if(cmd==='sleep'){const n=Number(a[0]);if(!Number.isFinite(n)||n<0||n>5)this.fail('sleep: duration must be between 0 and 5');await new Promise(r=>setTimeout(r,n*1000));return this.result();}
    if(/^[A-Za-z_]\w*=/.test(cmd)){if(a.length)this.fail('usage: export NAME=value');return this.run(['export',cmd],stdin);}
    if(this.commands.includes(cmd))this.fail(`${cmd}: invalid command context`,2);
    this.fail(`${cmd}: command not found`,127);
  }
  lines(s){if(!s)return [];const a=s.split('\n');if(a[a.length-1]==='')a.pop();return a;}
  unescape(s){return s.replace(/\\(0[0-7]{1,3}|x[0-9a-fA-F]{2}|[entbr\\])/g,(_,c)=>c[0]==='0'?String.fromCharCode(parseInt(c,8)):c[0]==='x'?String.fromCharCode(parseInt(c.slice(1),16)):({e:'\x1b',n:'\n',t:'\t',r:'\r',b:'\b','\\':'\\'}[c]));}
}

class ShellHost {
  constructor(files){this.files=files;this.core=new ShellCore(files);this.state=this.core.snapshot();this.pending=null;this.worker=null;this.start();}
  start(){
    if(typeof Worker==='undefined')return;
    const source=`'use strict'; const ShellCore=${ShellCore.toString()}; let sh; onmessage=async e=>{if(e.data.setLast!==undefined){sh.last=e.data.setLast;return;}if(e.data.init){sh=new ShellCore(e.data.files,e.data.state);return;}try{const result=await sh.execute(e.data.line);postMessage({result,state:sh.snapshot()});}catch(err){postMessage({result:{out:'websh: '+err.message+'\\n',code:1},state:sh.snapshot()});}};`;
    try {const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));this.worker=new Worker(url);URL.revokeObjectURL(url);this.worker.postMessage({init:true,files:this.files,state:this.state});this.worker.onmessage=e=>{this.state=e.data.state;if(this.pending){clearTimeout(this.pending.timer);const {resolve}=this.pending;this.pending=null;resolve(e.data.result);}};this.worker.onerror=()=>this.interrupt('websh: command interrupted');}catch(e){this.worker=null;}
  }
  async run(line){
    if(this.pending)throw new Error('A command is already running.');
    if(!this.worker){return {out:'websh: unable to start command\n',code:1};}
    return new Promise(resolve=>{const timer=setTimeout(()=>this.interrupt('websh: command timed out'),/^\s*sleep\b/.test(line)?6000:2500);this.pending={resolve,timer};this.worker.postMessage({line});});
  }
  interrupt(message='^C'){
    if(this.worker){this.worker.terminate();this.worker=null;}if(this.pending){clearTimeout(this.pending.timer);const {resolve}=this.pending;this.pending=null;resolve({out:message+'\n',code:130});}this.start();
  }
  reset(){if(this.worker)this.worker.terminate();this.core=new ShellCore(this.files);this.state=this.core.snapshot();this.start();}
  dispose(){if(this.worker)this.worker.terminate();if(this.pending)clearTimeout(this.pending.timer);}
}
root.IceyShellCore=ShellCore;root.IceyShellHost=ShellHost;
if(typeof module!=='undefined'&&module.exports)module.exports={ShellCore,ShellHost};
})(typeof window!=='undefined'?window:globalThis);

