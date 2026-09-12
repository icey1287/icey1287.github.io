"""Capture the actual built page with Chromium."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];OUT=R/'previews';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
    page.set_content((R/'index.html').read_text(),wait_until='load')
    page.evaluate('ICEY_APP.terminal.ready');page.wait_for_timeout(150)
    page.screenshot(path=str(OUT/'about-light.png'))
    for cmd,name in [('projects','projects'),('projects cookmind','cookmind'),('blog','blog')]:
        page.evaluate('(cmd)=>ICEY_APP.run(cmd)',cmd);page.wait_for_timeout(150);page.screenshot(path=str(OUT/f'{name}.png'))
    page.evaluate("ICEY_APP.run('about')");page.evaluate("ICEY_APP.run('clear')")
    page.locator('#palette-trigger').click();page.locator('#palette-search').fill('dark');page.keyboard.press('Enter')
    page.wait_for_timeout(150);page.screenshot(path=str(OUT/'about-dark.png'))
    page.locator('#palette-trigger').click();page.locator('#palette-search').fill('light');page.keyboard.press('Enter')
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
    page.screenshot(path=str(OUT/'about-mobile.png'))
    browser.close()
