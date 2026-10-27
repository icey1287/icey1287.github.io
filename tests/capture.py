"""Desktop screenshots and an optional recording of real pointer interactions."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile
from playwright.sync_api import sync_playwright

R = Path(__file__).resolve().parents[1]
OUT = R / 'previews'
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 960}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content((R/'index.html').read_text(), wait_until='load')
    page.evaluate('ICEY_APP.terminal.ready')

    def appearance(theme):
        page.locator('#palette-trigger').click()
        page.locator('#palette-search').fill(theme)
        page.keyboard.press('Enter')

    def capture(route, name, height=960):
        page.set_viewport_size({'width': 1440, 'height': height})
        page.evaluate('()=>{for(const folder of document.querySelectorAll("details.nav-folder"))folder.open=!ICEY_APP.profile.directories[folder.dataset.folder]?.collapsed;}')
        page.evaluate('(route)=>ICEY_APP.openDoc(route)', route)
        page.mouse.move(-20,-20)
        page.wait_for_timeout(350)
        assert page.evaluate('document.documentElement.scrollWidth===innerWidth'), name+' has outer overflow'
        assert page.evaluate('document.querySelector("#document-scroll").scrollWidth<=document.querySelector("#document-scroll").clientWidth+1'), name+' has document overflow'
        page.screenshot(path=str(OUT/(name+'.png')))
        print('PASS desktop capture', name, flush=True)

    if '--video-only' not in sys.argv:
        capture('about', 'about-light')
        capture('activity', 'activity', height=1320)
        capture('life', 'life')
        capture('life/Travel', 'travel')
        capture('Notes', 'notes')
        capture('blog', 'blog')
        capture('projects', 'projects')
        capture('projects/cookmind', 'cookmind')
        for theme in ['dark','amber']:
            appearance(theme)
            for route,name in [('about','about'),('activity','activity'),('Notes','notes'),('life/Travel','travel')]:
                capture(route, name+'-'+theme)
        appearance('light')
        capture('activity','activity')
        card=page.locator('#doc-view .entry-grid a').first.bounding_box()
        page.mouse.move(card['x']+card['width']*.8,card['y']+card['height']*.2,steps=16)
        page.wait_for_timeout(80)
        page.screenshot(path=str(OUT/'activity-hover.png'))
        assert not errors, errors
    page.close()

    if '--video' in sys.argv or '--video-only' in sys.argv:
        with tempfile.TemporaryDirectory(prefix='icey-recording-') as recordings:
            context=browser.new_context(viewport={'width':1440,'height':960},device_scale_factor=1,
                record_video_dir=recordings,record_video_size={'width':1440,'height':960})
            demo=context.new_page()
            demo.on('pageerror',lambda error:errors.append(str(error)))
            demo.goto('http://127.0.0.1:4173/#about',wait_until='load')
            demo.evaluate('ICEY_APP.terminal.ready')
            # Browser video omits the OS cursor; this marker follows the actual pointer events.
            demo.evaluate('''()=>{const cursor=document.createElement('div');cursor.setAttribute('aria-hidden','true');
              cursor.innerHTML='<svg width="15" height="20" viewBox="0 0 15 20"><path d="M1 1v15l4-4 3 6 2-1-3-6h6Z" fill="#fff" stroke="#273726" stroke-width="1"/></svg>';
              Object.assign(cursor.style,{position:'fixed',left:'0',top:'0',pointerEvents:'none',zIndex:'1000',display:'none'});document.body.append(cursor);
              document.addEventListener('pointermove',event=>{cursor.style.display='block';cursor.style.transform=`translate(${event.clientX}px,${event.clientY}px)`;});}''')
            demo.wait_for_timeout(500)

            def glide(x,y,steps=24):
                demo.mouse.move(x,y,steps=steps)
                demo.wait_for_timeout(100)

            def click(selector):
                locator=demo.locator(selector).first
                locator.scroll_into_view_if_needed()
                box=locator.bounding_box()
                glide(box['x']+box['width']*.5,box['y']+box['height']*.5)
                demo.mouse.click(box['x']+box['width']*.5,box['y']+box['height']*.5,delay=90)
                demo.wait_for_timeout(400)

            glide(650,250)
            glide(1080,400)
            click('#file-nav [data-doc="/空间动态.md"]')
            for i in [0,1,3,2]:
                box=demo.locator('#doc-view .entry-grid a').nth(i).bounding_box()
                glide(box['x']+box['width']*.2,box['y']+box['height']*.25)
                glide(box['x']+box['width']*.8,box['y']+box['height']*.7,steps=28)
            demo.wait_for_timeout(450)
            click('#doc-view .entry-grid a[href="#blog"]')
            box=demo.locator('#doc-view tbody tr').first.bounding_box()
            glide(box['x']+box['width']*.8,box['y']+box['height']*.25)
            glide(box['x']+box['width']*.25,box['y']+box['height']*.7)
            click('#doc-view a[href="#blog/2026.10.7"]')
            glide(1000,350)
            demo.mouse.wheel(0,230)
            demo.wait_for_timeout(700)
            click('#file-nav [data-doc="/空间动态.md"]')
            click('#doc-view .entry-grid a[href="#life/Travel"]')
            for i in [0,1,4]:
                box=demo.locator('#doc-view tbody tr').nth(i).bounding_box()
                glide(box['x']+box['width']*.75,box['y']+box['height']*.25,steps=20)
            click('#file-nav [data-doc="/Notes"]')
            click('#doc-view [data-category="课程笔记"]')
            demo.wait_for_timeout(600)
            click('#file-nav [data-doc="about"]')
            glide(1090,220)
            demo.wait_for_timeout(800)
            video=demo.video
            context.close()
            recording=video.path()
            subprocess.run(['ffmpeg','-y','-i',str(recording),'-an','-c:v','libx264','-preset','fast','-crf','20',
                '-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'interactions.mp4')],capture_output=True,check=True)
            print('PASS desktop recording',OUT/'interactions.mp4',flush=True)
    assert not errors, errors
    browser.close()
