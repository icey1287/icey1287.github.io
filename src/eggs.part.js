const eggInfo=[['mew','🐈','一只小猫','mew'],['sl','🚂','没白敲错','sl'],['matrix','⌘','代码下雨','matrix'],['piano','♫','另一种键盘','piano'],['sandwich','◒','礼貌的管理员','sudo …'],['konami','✧','古老的暗号','↑ ↑ ↓ ↓ …']];
let eggs=new Set();try{const saved=JSON.parse(localStorage.getItem('icey-eggs')||'[]');if(Array.isArray(saved))eggs=new Set(saved.filter(x=>eggInfo.some(e=>e[0]===x)));}catch(e){}
function discover(id){if(eggs.has(id))return;eggs.add(id);try{localStorage.setItem('icey-eggs',JSON.stringify([...eggs]));}catch(e){}const info=eggInfo.find(x=>x[0]===id);toast(`${info[1]} 发现彩蛋：${info[2]} · ${eggs.size} / 6`);}
function achievements(){return `EXPLORER LOG  ${eggs.size} / 6\n\n`+eggInfo.map(([id,symbol,title,cmd])=>eggs.has(id)?`  [✓] ${title} — ${cmd}`:'  [·] 尚未发现').join('\n')+'\n';}
function neofetch(){return `\x1b[32m       .  +      .
     ▄▄▄       ▄▄▄
     █  ▀▄▄▄▄▄▀  █
     █           █
     █  ▄▄   ▄▄  █
     █  ▀▀   ▀▀  █
      ▀▄   ▄   ▄▀
        ▀▄▄▄▄▄▀
           ▀\x1b[0m

\x1b[1;32micey@a-curious-mind\x1b[0m
────────────────────────────
Name    ${P.name} / Yiming Zhang
Focus   AI Agents / Generative SE
Build   ${P.projects.map(x=>x.name).join(" / ")}
Fuel    Curiosity & small steps
Off     Travel / Piano / Indie games
\x1b[40m   \x1b[41m   \x1b[42m   \x1b[43m   \x1b[44m   \x1b[45m   \x1b[46m   \x1b[47m   \x1b[0m
`;}
const fortunes=['先把一个小问题解决好，远方会一点点变得具体。','代码可以重构，好奇心记得保留。','有证据的回答，比漂亮的回答更值得信任。','今天多理解了一点，也是一种值得庆祝的进展。','把“有一天我要做”改成“今天先写一行”。','认真对待那些很小的喜欢，它们也会长成作品。'];
