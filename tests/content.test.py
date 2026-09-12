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
        check('Default page is about.md',js('ICEY_APP.current.path==="/home/icey/about.md"'))
        for name in ['about.md','life.md']:
            actual=js('(name)=>ICEY_APP.shell.core.file("/home/icey/"+name)',name)
            check(name+' exactly matches editable Markdown',actual==(R/'content'/name).read_bytes().decode('utf-8'))
        check('Document copy/download controls absent',page.locator('#copy-document,#download-document,a[download]').count()==0)
        app=(R/'src/app.js').read_text()
        check('Document export handlers removed',not any(s in app for s in ['copy-document','download-document','downloadDocument','current.source)?']))
        check('Terminal selection clipboard shortcut retained','copyTerminalText(this.term.getSelection())' in app)
        deleted=['README.md','education.md','experience','resume.md','sources.md','links.json']
        nodes=js('Object.keys(ICEY_APP.shell.state.nodes)')
        check('Deleted sections do not exist in filesystem',all('/home/icey/'+n not in nodes for n in deleted))
        check('Deleted sections do not exist in explorer',page.locator('[data-doc="home"],[data-doc="education"],[data-folder="experience"],[data-doc="resume"],[data-doc="sources"]').count()==0)
        run('clear');run('help');help_result=js('ICEY_APP.terminal.snapshot()')
        check('Help lists current project commands',all(x in help_result for x in ['foucs-rabbit','cookmind','feynman-s-cat','blog']))
        check('Help no longer advertises removed sections',not re.search(r'education|experience|README|resume',help_result))
        run('blog')
        check('Blog is a real directory',js('ICEY_APP.shell.state.nodes["/home/icey/blog"].type==="dir"'))
        check('Blog starts with zero entries',core('ls -a ~/blog')['out']=='')
        check('Blog has no articles or placeholder links',page.locator('#doc-view a').count()==0 and '0 articles' in page.locator('#doc-view').inner_text())
        check('Empty directory appears in tree','blog/' in core('tree ~')['out'])
        check('Change working directory to empty blog',core('cd ~/blog; pwd')['out']=='/home/icey/blog\n')
        core('cd ~')
        # Test directory behaviour with a temporary article, then remove it.
        run("printf '# Temporary article\\n\\nHello.\\n' > ~/blog/temporary.md")
        check('Directory refreshes after writing a file',page.locator('#doc-view a').count()==1 and page.locator('#blog-count').inner_text()=='1')
        page.locator('#doc-view a').click()
        check('Blog entry opens actual Markdown',page.locator('#doc-view h1').inner_text()=='Temporary article')
        run('blog temporary');check('Blog command opens an article',js('ICEY_APP.current.path.endsWith("blog/temporary.md")'))
        run('rm ~/blog/temporary.md');run('blog')
        check('Blog returns to genuinely empty',core('ls -a ~/blog')['out']=='' and page.locator('#blog-count').inner_text()=='0')
        projects=json.loads((R/'content/manifest.json').read_text())['projects']
        run('projects')
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
