/* Content is generated from content/*.md and content/projects/*.md. */
window.ICEY_PROFILE = /*__MANIFEST__*/;
window.ICEY_CONTENT = /*__CONTENT__*/;
window.makeIceyFiles = function () {
  const base = '/';
  const files = Object.fromEntries(Object.entries(window.ICEY_CONTENT).map(([path,text]) => [base+path,text]));
  for (const path of Object.keys(window.ICEY_PROFILE.directories)) files[base+path] = {type:'dir'};
  files[base+'.curiosity'] = '# You found a little door.\n\n保持好奇。普通的一天，也值得认真保存。\n\n'
    + '这里有 6 个小彩蛋。线索：\n1. 一只会说话的猫：mew\n2. 偶尔敲错 ls，也会有好事：sl\n'
    + '3. 代码也会下雨：matrix\n4. 给键盘一个不同的工作：piano\n'
    + '5. 请管理员做一份三明治：sudo make me a sandwich\n6. 古老的方向键序列：↑ ↑ ↓ ↓ ← → ← → B A\n\n'
    + '用 achievements 查看已发现的彩蛋。\n';
  files[base+'.config/motd'] = 'Welcome, curious human.\nYou do not need root to make something meaningful.\n';
  return files;
};
