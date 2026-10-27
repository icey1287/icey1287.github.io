/* Public routes are relative to the site root, independently of the shell cwd. */
(function(root){
  const aliases={about:'/about.md',bio:'/about.md',life:'/life',notes:'/Notes',activity:'/空间动态.md',skills:'/skills.json',blog:'/blog',projects:'/projects'};
  function routeForPath(path,nodes){
    if(path==='/')return '/';
    const alias=Object.keys(aliases).find(key=>aliases[key]===path);
    const relative=path.slice(1);
    return alias||(nodes[path]?.type==='file'?relative.replace(/\.md$/,''):relative);
  }
  function pathForRoute(route,nodes){
    // Preserve previously shared URLs while canonicalizing them on load.
    route=route.replace(/^\/home\/icey(?=\/|$)/,'').replace(/^\/home\/?$/,'/');
    if(route==='/'||route==='~')return '/';
    route=route.replace(/^\/+|\/+$/g,'');
    if(aliases[route])return aliases[route];
    const parts=[];
    for(const part of route.split('/')){if(!part||part==='.')continue;if(part==='..')parts.pop();else parts.push(part);}
    const path='/'+parts.join('/');
    return nodes[path]?path:path+'.md';
  }
  const routes={routeForPath,pathForRoute};
  if(typeof module==='object'&&module.exports)module.exports=routes;
  else root.ICEY_ROUTES=routes;
})(typeof window==='object'?window:globalThis);
