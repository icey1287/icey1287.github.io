"""Scroll/copy regression checks against the final bundled HTML."""
from pathlib import Path
import json, os, traceback
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
results = []

def check(name, good, detail=None):
    results.append(dict(name=name, status='pass' if good else 'fail', **({'detail': detail} if detail is not None else {})))
    print(('PASS ' if good else 'FAIL ') + name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium') or None,
                                headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 960})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_default_timeout(5000)
    js = page.evaluate
    def command(text): return page.evaluate('(s)=>ICEY_APP.run(s)', text)
    def idle(): return js('async()=>{await ICEY_APP.terminal.queue;await ICEY_APP.terminal.job;await ICEY_APP.terminal.queue;}')
    try:
        page.set_content((ROOT/'index.html').read_text())
        js('ICEY_APP.terminal.ready')
        page.wait_for_timeout(120)
        command('seq 1 3000')
        check('Large real scrollback available', js('ICEY_APP.terminal.term.buffer.active.baseY>2900'))
        check('No xterm scrolling animation', js('ICEY_APP.terminal.term.options.smoothScrollDuration===0'))
        check('No CSS scrolling animation', js('getComputedStyle(document.querySelector(".xterm-viewport")).scrollBehavior==="auto"'))
        js('ICEY_APP.terminal.term.scrollToLine(2000)')
        page.wait_for_timeout(50)
        immediate = js('''()=>{const v=document.querySelector('.xterm-viewport'),before=v.scrollTop;
          v.dispatchEvent(new WheelEvent('wheel',{deltaY:-180,bubbles:true,cancelable:true}));
          return {before,after:v.scrollTop,delta:before-v.scrollTop};}''')
        check('Pixel wheel applied within dispatch, no timer', abs(immediate['delta']-180)<1, immediate)
        page.wait_for_timeout(240)
        check('No synthetic movement after wheel stops', abs(js("document.querySelector('.xterm-viewport').scrollTop")-immediate['after'])<1)
        burst = js('''()=>{const v=document.querySelector('.xterm-viewport'),before=v.scrollTop;
          for(let i=0;i<120;i++)v.dispatchEvent(new WheelEvent('wheel',{deltaY:-2,bubbles:true,cancelable:true}));
          return {before,after:v.scrollTop,delta:before-v.scrollTop};}''')
        check('Small touchpad deltas applied continuously', abs(burst['delta']-240)<1, burst)
        # Measure an actual browser wheel input, not only synthetic events.
        js('''()=>{window.wheelFrames=[];let n=0;function frame(){
          wheelFrames.push(document.querySelector('.xterm-viewport').scrollTop);
          if(++n<35)requestAnimationFrame(frame);}requestAnimationFrame(frame);}''')
        box=page.locator('#terminal').bounding_box()
        page.mouse.move(box['x']+100,box['y']+65)
        page.mouse.wheel(0,-240)
        page.wait_for_timeout(640)
        samples = js('wheelFrames')
        changed = [x for x in samples if abs(x-burst['after'])>0.1]
        check('Native wheel reaches target without animation trail', bool(changed) and max(changed)-min(changed)<1, samples)
        check('Native wheel does not scroll document pane', js('document.querySelector("#document-scroll").scrollTop===0'))
        command('clear')
        js("()=>{void ICEY_APP.run('seq 1 3000 | less');}")
        page.wait_for_function('!!ICEY_APP.terminal.pager')
        js('ICEY_APP.terminal.queue')
        page.wait_for_timeout(50)
        js('''()=>{const t=ICEY_APP.terminal;t.testPaints=0;const original=t.renderPage.bind(t);
          t.renderPage=async()=>{t.testPaints++;return original();};}''')
        pagerburst=js('''()=>{const t=ICEY_APP.terminal,h=t.term._core._renderService.dimensions.css.cell.height;
          for(let i=0;i<800;i++)t.container.dispatchEvent(new WheelEvent('wheel',{deltaY:3,bubbles:true,cancelable:true}));
          return {expected:Math.floor(2400/h),top:t.pager.top,paintCalls:t.testPaints};}''')
        check('Pager burst updates target synchronously', abs(pagerburst['expected']-pagerburst['top'])<=1,pagerburst)
        page.wait_for_function('ICEY_APP.terminal.pagerFrame===null&&ICEY_APP.terminal.pager.renderedTop===ICEY_APP.terminal.pager.top')
        paints=js('ICEY_APP.terminal.testPaints')
        check('800 pager wheel events coalesce, no paint backlog', paints<=2, {'events':800,'paint_calls':paints})
        check('Pager visible content matches latest position', js('''()=>{const t=ICEY_APP.terminal;
          return t.term.buffer.active.getLine(0).translateToString(true)===String(t.pager.top+1);}'''))
        reverse=js('''()=>{const t=ICEY_APP.terminal,h=t.term._core._renderService.dimensions.css.cell.height,start=t.pager.top;
          t.container.dispatchEvent(new WheelEvent('wheel',{deltaY:-h*10, bubbles:true,cancelable:true}));
          return {before:start,after:t.pager.top};}''')
        check('Pager direction changes immediately', reverse['before']-reverse['after']==10,reverse)
        page.wait_for_function('ICEY_APP.terminal.pagerFrame===null')
        # Queue a final wheel frame and quit before it can paint: no stale draw after q.
        js('''()=>{const t=ICEY_APP.terminal;t.container.dispatchEvent(new WheelEvent('wheel',{deltaY:200,bubbles:true,cancelable:true}));
          t.enqueue(()=>t.onData('q'));}''')
        idle();page.wait_for_timeout(100)
        check('Pager close cancels pending scroll frame', js('!ICEY_APP.terminal.pager&&ICEY_APP.terminal.pagerFrame===null&&ICEY_APP.terminal.term.buffer.active.type==="normal"'))
        command('echo still-ready')
        check('No stale pager output after return', js('ICEY_APP.terminal.snapshot().includes("still-ready\\nvisitor@icey:~$")'))
        command('clear');command('help')
        helptext=js('ICEY_APP.terminal.snapshot()')
        check('Help retains commands and shortcuts', all(s in helptext for s in ['文件与文本','grep','Ctrl','分页阅读']))
        check('Help has no implementation disclaimer', not any(s in helptext for s in ['JavaScript','Bash','browser-only','supported Web Shell','兜底','公开网页版本','模拟','子集']))
        for name in ['bash','python3','not-a-command']:
            command(name)
            got=page.evaluate('(s)=>ICEY_APP.shell.core.execute(s)',name)
            check(f'{name}: plain command error only',got['code']==127 and got['out']==name+': command not found\n',got)
        command('clear');command('help')
        js('ICEY_APP.terminal.focus(true)')
        (ROOT/'previews').mkdir(exist_ok=True)
        page.screenshot(path=str(ROOT/'previews/help-clean.png'))
        check('No runtime errors',not errors,errors)
    except Exception:
        check('Scroll regression completed',False,traceback.format_exc())
    finally:
        report={'passed':sum(r['status']=='pass' for r in results),'total':len(results),'results':results}
        (ROOT/'tests/scroll-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        browser.close()
        print(f"{report['passed']}/{report['total']} scroll/copy checks")
        if report['passed']!=report['total']:raise SystemExit(1)
