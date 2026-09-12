/* icey v4 — Markdown workbench + terminal buffer. */
(() => {
'use strict';
const P=window.ICEY_PROFILE, files=window.makeIceyFiles(P), shell=new IceyShellHost(files);
const $=s=>document.querySelector(s);
const E=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
