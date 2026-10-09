const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {ShellCore}=require('../src/shell.js');
const {routeForPath,pathForRoute}=require('../src/routes.js');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require.resolve('../src/profile.js'),'utf8'),ctx);
const shell=new ShellCore(ctx.window.makeIceyFiles());
const nodes=shell.nodes;
test('Every published document and directory has a reversible short route',()=>{
  for(const path of Object.keys(nodes)){
    const route=routeForPath(path,nodes);
    assert.doesNotMatch(route,/home\/icey/);
    assert.equal(pathForRoute(route,nodes),path);
  }
  assert.equal(routeForPath('/blog/2026.10.7.md',nodes),'blog/2026.10.7');
  assert.equal(routeForPath('/life.md',nodes),'life');
  assert.equal(routeForPath('/projects/feynman-s-cat.md',nodes),'projects/feynman-s-cat');
});
test('Old absolute bookmarks resolve to the same documents',()=>{
  for(const route of ['/home/icey/blog/2026.10.7.md','blog/2026.10.7.md','blog/2026.10.7']){
    const path=pathForRoute(route,nodes);
    assert.equal(path,'/blog/2026.10.7.md');
    assert.equal(routeForPath(path,nodes),'blog/2026.10.7');
  }
  assert.equal(pathForRoute('/home/icey',nodes),'/');
  assert.equal(pathForRoute('/home',nodes),'/');
  assert.equal(routeForPath(pathForRoute('bio',nodes),nodes),'about');
});
test('Routes work after navigating the shell to a different folder',async()=>{
  await shell.execute('cd projects');
  const path=pathForRoute('blog/2026.10.7',nodes);
  assert.match(shell.file(path),/^# 当代码越来越容易生成/);
  assert.equal(pathForRoute('life',nodes),'/life.md');
});
