"""Desktop interaction checks using real pointer events and canvas pixels."""
from pathlib import Path
import json
import os
import traceback
from playwright.sync_api import sync_playwright

R = Path(__file__).resolve().parents[1]
results = []
errors = []


def check(name, value):
    results.append({'name': name, 'status': 'pass' if value else 'fail'})
    print(('PASS ' if value else 'FAIL ')+name, flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 960})
    page.on('pageerror', lambda error: errors.append(str(error)))

    def open_doc(route):
        page.evaluate('(route)=>ICEY_APP.openDoc(route)', route)
        page.wait_for_timeout(350)

    def alpha(x, y):
        return page.evaluate('''([x,y])=>{const c=document.querySelector('#interaction-canvas'),scale=c.width/innerWidth;
          const data=c.getContext('2d').getImageData(Math.floor(x*scale)-1,Math.floor(y*scale)-1,3,3).data;
          return Math.max(...Array.from(data).filter((value,i)=>i%4===3));}''', [x, y])

    def empty_canvas():
        return page.evaluate('''()=>{const c=document.querySelector('#interaction-canvas'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          for(let i=3;i<data.length;i+=4)if(data[i])return false;return true;}''')

    try:
        page.set_content((R/'index.html').read_text(), wait_until='load')
        page.evaluate('ICEY_APP.terminal.ready')
        page.wait_for_timeout(350)
        check('Canvas cannot intercept pointer events', page.locator('#interaction-canvas').evaluate('(el)=>getComputedStyle(el).pointerEvents')=='none')
        check('System cursor remains visible', page.locator('body').evaluate('(el)=>getComputedStyle(el).cursor')!='none')
        check('Removed illustration and decorative headings stay absent', page.locator('.exploration-art,.field-cover,.field-kicker').count()==0)
        banned=['好奇心的去向，都留在这里','随着好奇心生长','一些旋律，一些故事','城市、风景与沿途','慢慢整理成自己的知识','合上书之后的余韵','ICEY’S FIELD NOTES','a curious mind, an open world.','ALWAYS EXPLORING']
        check('Unapproved copy is absent from bundled content', page.evaluate('(words)=>!words.some(word=>JSON.stringify(ICEY_CONTENT).includes(word)||JSON.stringify(ICEY_APP.profile).includes(word))', banned))
        page.mouse.move(1120, 24)
        page.wait_for_timeout(35)
        normal_alpha=alpha(1120,24)
        check('Pointer motion paints a fine trail', normal_alpha>0)
        check('No broad shadow around the cursor',alpha(1120,44)==0 and alpha(1140,24)==0)
        page.wait_for_timeout(500)
        check('Pointer effects clear after idle', empty_canvas())
        paragraph=page.locator('#doc-view > p').first.bounding_box()
        x=paragraph['x']+paragraph['width']*.7
        y=paragraph['y']+paragraph['height']*.5
        before=page.locator('#doc-view').bounding_box()
        page.mouse.move(x,y)
        page.wait_for_timeout(35)
        reading_alpha=alpha(x,y)
        check('Article pointer feedback has lower opacity', 0<reading_alpha<normal_alpha)
        check('Article content does not move with the pointer', before==page.locator('#doc-view').bounding_box())
        terminal=page.locator('#terminal').bounding_box()
        x=terminal['x']+500
        y=terminal['y']+45
        page.mouse.move(x,y)
        page.wait_for_timeout(35)
        check('Terminal pointer feedback has lower opacity', 0<alpha(x,y)<normal_alpha)
        open_doc('activity')
        item=page.locator('#doc-view .entry-grid a').first
        box=item.bounding_box()
        page.mouse.move(box['x']+box['width']*.8,box['y']+box['height']*.2,steps=12)
        page.wait_for_timeout(90)
        tilt=item.evaluate('el=>[parseFloat(el.style.getPropertyValue("--tilt-x")),parseFloat(el.style.getPropertyValue("--tilt-y"))]')
        check('Card tilt is visible and bounded to three degrees', all(.5<abs(value)<=3 for value in tilt))
        check('Card reflection follows the pointer', item.evaluate('el=>parseFloat(el.style.getPropertyValue("--shine-x"))>65&&parseFloat(getComputedStyle(el,"::after").opacity)>.3'))
        page.mouse.move(1400,90)
        page.wait_for_timeout(350)
        check('Card returns to rest after pointer leaves', item.evaluate('el=>!el.classList.contains("is-tracking")&&!el.style.getPropertyValue("--tilt-x")'))
        page.mouse.move(box['x']+40,box['y']+40)
        page.wait_for_timeout(500)
        page.mouse.down()
        page.wait_for_timeout(40)
        check('Press produces a ripple', not empty_canvas())
        page.mouse.up()
        check('Card navigation takes effect immediately', page.evaluate('ICEY_APP.current.path==="/Notes"'))
        timings=page.evaluate('document.querySelector("#doc-view").getAnimations({subtree:true}).map(a=>a.effect.getTiming().duration+a.effect.getTiming().delay)')
        check('Document layers transition within 280ms', len(timings)>1 and max(timings)<=280)
        page.wait_for_timeout(500)
        check('Ripple and outgoing snapshot finish cleanly', empty_canvas() and page.locator('.page-ghost').count()==0)
        page.evaluate('()=>{for(const route of ["about","activity","blog","life/Travel","Notes","activity"])ICEY_APP.openDoc(route);}')
        check('Rapid navigation keeps one outgoing snapshot at most', page.locator('.page-ghost').count()<=1)
        page.wait_for_timeout(350)
        check('Rapid navigation leaves only the current page', page.locator('.page-ghost').count()==0 and page.locator('#doc-view h1').inner_text()=='空间动态')
        for route, selector in [('blog','#doc-view tbody tr'),('life/Travel','#doc-view tbody tr')]:
            open_doc(route)
            box=page.locator(selector).first.bounding_box()
            page.mouse.move(box['x']+box['width']*.7,box['y']+box['height']*.3,steps=8)
            check(route+' cards share pointer interaction', page.locator(selector+'.is-tracking').count()==1)
        page.mouse.move(-20,-20)
        page.wait_for_timeout(50)
        check('Leaving the window clears pointer effects', empty_canvas() and page.locator('#doc-view .is-tracking').count()==0)
        open_doc('activity')
        box=page.locator('#doc-view .entry-grid a').first.bounding_box()
        page.mouse.move(box['x']+50,box['y']+30)
        page.evaluate('ICEY_APP.openDoc("blog")')
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_timeout(50)
        check('Changing motion preference cancels active effects', empty_canvas() and page.locator('.page-ghost').count()==0 and page.locator('#doc-view').evaluate('el=>el.getAnimations({subtree:true}).length===0'))
        open_doc('activity')
        box=page.locator('#doc-view .entry-grid a').first.bounding_box()
        page.mouse.move(box['x']+box['width']*.8,box['y']+30)
        page.mouse.down()
        page.wait_for_timeout(60)
        check('Reduced motion suppresses trail, tilt and ripple', empty_canvas() and page.locator('#doc-view .is-tracking').count()==0)
        page.mouse.up()
        check('Reduced-motion navigation still works', page.evaluate('ICEY_APP.current.path==="/Notes"'))
        page.emulate_media(reduced_motion='no-preference')
        open_doc('activity')
        for theme in ['dark','amber']:
            page.locator('#palette-trigger').click()
            page.locator('#palette-search').fill(theme)
            page.keyboard.press('Enter')
            box=page.locator('#doc-view .entry-grid a').first.bounding_box()
            page.mouse.move(box['x']+60,box['y']+40)
            page.wait_for_timeout(50)
            check(theme+' theme retains visible interaction', not empty_canvas())
        check('No runtime errors', not errors)
    except Exception:
        check('Motion runner completed', False)
        print(traceback.format_exc())
    finally:
        report={'passed':sum(item['status']=='pass' for item in results),'total':len(results),'results':results,'errors':errors}
        (R/'tests/motion-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(f"RESULT {report['passed']} / {report['total']}")
        browser.close()
        if report['passed']!=report['total']:
            raise SystemExit(1)
