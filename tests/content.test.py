"""Content/navigation checks for the current revision, using the built HTML."""
from pathlib import Path
import json,os,re,traceback
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
results=[];errors=[]
def check(name,value):
    results.append({'name':name,'status':'pass' if value else 'fail'})
    print(('PASS ' if value else 'FAIL ')+name,flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':960});page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((R/'index.html').read_text(),wait_until='load')
    page.evaluate('ICEY_APP.terminal.ready');page.wait_for_timeout(100)
    js=page.evaluate
    run=lambda s:js('(s)=>ICEY_APP.run(s)',s)
    core=lambda s:js('(s)=>ICEY_APP.shell.run(s)',s)
    try:
        check('Default page is about.md',js('ICEY_APP.current.path==="/about.md"'))
        for name in ['about.md','life.md']:
            actual=js('(name)=>ICEY_APP.shell.core.file("/"+name)',name)
            check(name+' exactly matches editable Markdown',actual==(R/'content'/name).read_bytes().decode('utf-8'))
        check('Document copy/download controls absent',page.locator('#copy-document,#download-document,a[download]').count()==0)
        app=(R/'src/app.js').read_text()
        check('Document export handlers removed',not any(s in app for s in ['copy-document','download-document','downloadDocument','current.source)?']))
        check('Terminal selection clipboard shortcut retained','copyTerminalText(this.term.getSelection())' in app)
        deleted=['README.md','education.md','experience','resume.md','sources.md','links.json']
        nodes=js('Object.keys(ICEY_APP.shell.state.nodes)')
        check('Deleted sections do not exist in filesystem',all('/'+n not in nodes for n in deleted))
        check('Deleted sections do not exist in explorer',page.locator('[data-doc="home"],[data-doc="education"],[data-folder="experience"],[data-doc="resume"],[data-doc="sources"]').count()==0)
        run('clear');run('help');help_result=js('ICEY_APP.terminal.snapshot()')
        check('Help lists current project commands',all(x in help_result for x in ['foucs-rabbit','cookmind','feynman-s-cat','blog']))
        check('Help no longer advertises removed sections',not re.search(r'education|experience|README|resume',help_result))
        run('blog')
        check('Blog is a real directory',js('ICEY_APP.shell.state.nodes["/blog"].type==="dir"'))
        articles=sorted((R/'content/blog').glob('*.md'))
        check('Blog and projects use expandable folders',page.locator('details.nav-folder[data-folder="blog"] > summary').count()==1 and page.locator('details.nav-folder[data-folder="projects"] > summary').count()==1)
        check('Directory view has no file tab or source switch',not page.locator('.editor-tabs').is_visible() and not page.locator('.preview-switch').is_visible())
        check('Blog explorer contains published files',page.locator('[data-folder="blog"] .folder-children [data-doc]').count()==len(articles))
        check('Blog lists published articles',core('ls -a ~/blog')['out']==''.join(f'{a.name}\n' for a in articles))
        check('Blog links and count match published articles',page.locator('#doc-view a').count()==len(articles) and page.locator('#blog-count').inner_text()==str(len(articles)))
        for article in articles:
            path='/blog/'+article.name
            folder=page.locator('[data-folder="blog"]')
            before=js('ICEY_APP.current.path')
            folder.locator('summary').click()
            check('Collapsing blog does not open a file',js('ICEY_APP.current.path')==before and not js('document.querySelector("[data-folder=blog]").open'))
            folder.locator('summary').click()
            folder.locator('[data-doc="'+path+'"]').click()
            check(article.name+' is active in explorer',folder.locator('[data-doc="'+path+'"].active').count()==1)
            check('Article has file tab and source switch',page.locator('.editor-tabs').is_visible() and page.locator('.preview-switch').is_visible())
            check(article.name+' uses canonical Markdown',js('ICEY_APP.current.source')==article.read_bytes().decode('utf-8'))
            check(article.name+' renders its title',page.locator('#doc-view h1').inner_text()==article.read_text().splitlines()[0].removeprefix('# '))
            run('blog '+article.stem)
            check(article.name+' opens by date command',js('ICEY_APP.current.path')=='/blog/'+article.name)
            check(article.name+' has canonical short URL',js('location.hash')=='#blog/'+article.stem)
            js('(hash)=>{location.hash=hash}', '#/home/icey/blog/'+article.name);page.wait_for_timeout(100)
            check('Legacy blog URL redirects to short URL',js('location.hash')=='#blog/'+article.stem and js('ICEY_APP.current.path')==path)
            core('cd projects')
            js('(hash)=>{location.hash=hash}', '#life');page.wait_for_timeout(100)
            js('(hash)=>{location.hash=hash}', '#blog/'+article.stem);page.wait_for_timeout(100)
            check('Blog deep link ignores shell working directory',js('ICEY_APP.current.path')==path)
            core('cd ~')
            run('blog')
            check('Blog directory links use shareable routes',page.locator('#doc-view a').filter(has_text=article.name).get_attribute('href')=='#blog/'+article.stem)
        check('Blog directory appears in tree','blog/' in core('tree ~')['out'])
        check('Change working directory to blog',core('cd ~/blog; pwd')['out']=='/blog\n')
        core('cd ~')
        # Test directory behaviour with a temporary article, then remove it.
        run("printf '# Temporary article\\n\\nHello.\\n' > ~/blog/temporary.md")
        check('Directory refreshes after writing a file',page.locator('#doc-view a').count()==len(articles)+1 and page.locator('#blog-count').inner_text()==str(len(articles)+1))
        check('New article appears in explorer',page.locator('[data-folder="blog"] [data-doc="/blog/temporary.md"]').count()==1)
        page.locator('#doc-view a').filter(has_text='temporary.md').click()
        check('Blog entry opens actual Markdown',page.locator('#doc-view h1').inner_text()=='Temporary article')
        run('blog temporary');check('Blog command opens an article',js('ICEY_APP.current.path.endsWith("blog/temporary.md")'))
        run('rm ~/blog/temporary.md');run('blog')
        check('Removing temporary article preserves published articles',core('ls -a ~/blog')['out']==''.join(f'{a.name}\n' for a in articles) and page.locator('#blog-count').inner_text()==str(len(articles)))
        check('Removed article disappears from explorer',page.locator('[data-folder="blog"] [data-doc="/blog/temporary.md"]').count()==0)
        projects=json.loads((R/'content/manifest.json').read_text())['projects']
        run('projects')
        check('Project directory also has no file tab',not page.locator('.editor-tabs').is_visible() and not page.locator('.preview-switch').is_visible())
        check('Project directory contains five summaries',page.locator('#doc-view tbody tr').count()==5)
        for x in projects:
            run('projects '+x['slug'])
            source=(R/'content/projects'/f"{x['slug']}.md").read_text()
            check(x['name']+' uses canonical Markdown',js('ICEY_APP.current.source')==source)
            check(x['name']+' has detailed sections',page.locator('#doc-view h2').count()>=4 and len(source)>1000)
            check(x['name']+' has one repository link',page.locator('#doc-view a[href^="https://github.com/"]').count()==1)
            page.locator('#source-button').click()
            check(x['name']+' source view works',page.locator('#doc-view .source-line').count()==len(source.rstrip('\n').split('\n')))
            page.locator('#preview-button').click()
        check('All three added projects present in ls',all(x['slug']+'.md' in core('ls ~/projects')['out'] for x in projects))
        run('about')
        check('Profile link only in about',page.locator('a[href="https://github.com/icey1287"]').count()==1)
        check('Contact link target preserved',page.locator('a[href="mailto:zynn32@foxmail.com"]').count()==1)
        # Old bookmarks degrade to the current entry document, not removed content.
        js('location.hash="#education"');page.wait_for_timeout(100)
        check('Old bookmark lands on about.md',js('ICEY_APP.current.path.endsWith("/about.md")'))
        check('Direct scroll option unchanged',js('ICEY_APP.terminal.term.options.smoothScrollDuration===0'))
        check('Block cursor unchanged',js('ICEY_APP.terminal.term.options.cursorBlink&&ICEY_APP.terminal.term.options.cursorStyle==="block"'))
        check('No runtime errors',not errors)
    except Exception:
        results.append({'name':'Test runner','status':'fail','error':traceback.format_exc()})
    finally:
        report={'passed':sum(x['status']=='pass' for x in results),'total':len(results),'results':results,'errors':errors}
        (R/'tests/content-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(f"RESULT {report['passed']} / {report['total']}")
        b.close()
