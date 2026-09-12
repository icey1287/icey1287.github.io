const paths={
  github:'<path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7m12 5v-3.5a3 3 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6a4.7 4.7 0 0 0-1.3-3.3 4.4 4.4 0 0 0-.1-3.3s-1-.3-3.5 1.3a12 12 0 0 0-6.4 0C6 2.6 5 2.9 5 2.9a4.4 4.4 0 0 0-.1 3.3A4.7 4.7 0 0 0 3.6 9.5c0 4.7 2.9 5.7 5.6 6a3 3 0 0 0-.8 2.3v3.5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon:'<path d="M20 14a8.7 8.7 0 0 1-10-10 8.8 8.8 0 1 0 10 10Z"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m-3-11v6"/>',
  folder:'<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/>',
  'folder-open':'<path d="M3 9V5h6l2 3h9v3M3 9l2 11h15l2-9H7L5 20"/>',
  'chevron-down':'<path d="m6 9 6 6 6-6"/>',
  terminal:'<path d="m5 6 6 6-6 6m8 0h6"/>',
  cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01"/>',
  branch:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m12-9c0 5-12 2-12 7"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  external:'<path d="M13 4h7v7m0-7L10 14m-2-9H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  bilibili:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="m7 2 3 5m7-5-3 5M8 12v3m8-3v3m-7 3h6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  cat:'<path d="m4 11-1-8 7 5h4l7-5-1 8a8 8 0 1 1-16 0Z"/><path d="M8 13h.01M16 13h.01m-6 4 2 1 2-1"/>',
  code:'<path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  piano:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 5v14m5-14v14m5-14v14M5 5v8h3V5m2 0v8h3V5m2 0v8h3V5"/>',
  game:'<path d="M7 7h10c3 0 4 4 5 10 .3 3-2 4-4 1l-2-2H8l-2 2c-2 3-4.3 2-4-1C3 11 4 7 7 7Z"/><path d="M7 10v5m-2.5-2.5h5M16 11h.01M18 14h.01"/>',
  award:'<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
  leaf:'<path d="M20 3c-9 0-16 2-16 9a7 7 0 0 0 8 7c7-1 8-8 8-16Z"/><path d="M3 21 15 9"/>',
  book:'<path d="M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3V4Zm9 2v15"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3"/>',
  zap:'<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
  apple:'<path d="M15 2c0 3-2 5-4 5 0-3 2-5 4-5Zm2 6c-2-1-3 0-5 0S9 7 7 8c-5 2-4 8-1 12 2 3 4 0 6 0s4 3 6 0c1-1 2-3 2-4-4-2-4-6-1-8l-2-0Z" fill="currentColor" stroke="none"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.code}</svg>`;}
window.iceyIcon=icon;
function icons(){document.querySelectorAll('[data-icon]').forEach(el=>{el.outerHTML=icon(el.dataset.icon);});}
const marks={ i:['11','00','11','11','11','11','11'], c:['01110','11000','11000','11000','11000','11000','01110'], e:['01110','11011','11011','11111','11000','11000','01111'], y:['11011','11011','11011','01111','00011','00011','11110'] };
function pixelName(){let rects='',x=0;for(const ch of 'icey'){const m=marks[ch];for(let y=0;y<m.length;y++)for(let c=0;c<m[y].length;c++)if(m[y][c]==='1')rects+=`<rect x="${x+c*6}" y="${y*6}" width="5.6" height="5.6"/>`;x+=(m[0].length+1)*6;}return `<svg class="pixel-name" viewBox="0 0 ${x-6} 42" role="img" aria-label="icey" fill="currentColor">${rects}</svg>`;}
function pixelCat(){return `<svg class="pixel-cat" viewBox="0 0 32 30" fill="currentColor" role="img" aria-label="一只像素小猫"><path d="M3 2h4v3h3v3h12V5h3V2h4v19h-3v3h-4v3H10v-3H6v-3H3Z" opacity=".15"/><path d="M3 2h3v3H3zm3 3h3v3H6zm-3 0h3v15H3zm23-3h3v18h-3zm-3 3h3v3h-3zM9 8h14v3H9zM6 20h3v3H6zm3 3h14v3H9zm14-3h3v3h-3zM8 13h4v4H8zm12 0h4v4h-4zm-5 5h3v2h-3zm-3 2h3v2h-3zm6 0h3v2h-3z"/><path d="M0 17h6v1H0zm26 0h6v1h-6zM9 28h14v2H9z" opacity=".6"/></svg>`;}
