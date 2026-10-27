from pathlib import Path
import os
from playwright.sync_api import sync_playwright
import json,hashlib,traceback
R=Path(__file__).resolve().parents[1];results=[]
def check(name,ok,detail=None):
 results.append({'name':name,'status':'pass' if ok else 'fail',**({'detail':str(detail)} if not ok else {})});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium') or None,headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':900},device_scale_factor=1);page.set_default_timeout(5000)
 def js(s):return page.evaluate(s)
 def idle():js('async()=>{await ICEY_APP.terminal.queue;await ICEY_APP.terminal.job;}')
 try:
  page.set_content((R/'index.html').read_text());js('ICEY_APP.terminal.ready');page.wait_for_timeout(150)
  js('ICEY_APP.terminal.focus(true)');page.keyboard.type('echo real-keyboard',delay=12);page.keyboard.press('Enter');idle()
  check('Per-key physical typing, no duplication',js('ICEY_APP.terminal.snapshot().includes("\\nreal-keyboard\\n")'))
  # Sample the actual native cursor pixels across its blink cycle.
  page.wait_for_timeout(180);cursor_box=page.locator('.xterm-cursor').last.bounding_box()
  hashes=[]
  for i in range(9):
   hashes.append(hashlib.sha256(page.screenshot(clip=cursor_box)).hexdigest());page.wait_for_timeout(140)
  check('Post-command cursor pixels actually blink',len(set(hashes))>1)
  # No animation: a dispatched wheel delta reaches the viewport in the same task.
  js("ICEY_APP.run('seq 1 120')");js('ICEY_APP.terminal.term.scrollToBottom()');page.wait_for_timeout(80)
  movement=js("""()=>{const el=document.querySelector('.xterm-viewport'),start=el.scrollTop;
    el.dispatchEvent(new WheelEvent('wheel',{deltaY:-180,bubbles:true,cancelable:true}));
    return {start,end:el.scrollTop,moved:start-el.scrollTop};}""")
  check('Wheel delta applied immediately',abs(movement['moved']-180)<1,movement)
  page.wait_for_timeout(240)
  check('No delayed scroll tail',abs(js("document.querySelector('.xterm-viewport').scrollTop")-movement['end'])<1)
  js('ICEY_APP.terminal.term.scrollToBottom()');js('ICEY_APP.terminal.focus(true)')
  js("()=>{void ICEY_APP.run('seq 1 120 | less');}");page.wait_for_function('!!ICEY_APP.terminal.pager');check('Pipe into less',js('ICEY_APP.terminal.pager.lines.length===120'))
  page.keyboard.press('G');js('ICEY_APP.terminal.queue');check('Pager end navigation',js('ICEY_APP.terminal.pager.top>90'))
  page.keyboard.press('q');idle();check('Alternate buffer restored after pipe',js('ICEY_APP.terminal.term.buffer.active.type==="normal"&&!ICEY_APP.busy'))
  # CJK double-cell character wrapping immediately before a line boundary.
  js('async()=>{const t=ICEY_APP.terminal;let p=t.model("",0).col;let s="x".repeat(t.term.cols-p-1)+"中";await t.setLine(s,s.length-1);}');check('Wide-character boundary cursor',js('ICEY_APP.terminal.lastModel.row===1&&ICEY_APP.terminal.lastModel.col===0'))
  page.keyboard.press('Control+c');js('ICEY_APP.terminal.queue')
  page.keyboard.type('echo alpha beta');page.keyboard.press('Control+w');js('ICEY_APP.terminal.queue');check('Ctrl W word deletion',js('ICEY_APP.terminal.line==="echo alpha "'))
  page.keyboard.press('Control+y');js('ICEY_APP.terminal.queue');check('Ctrl Y restores word',js('ICEY_APP.terminal.line==="echo alpha beta"'));page.keyboard.press('Control+c');js('ICEY_APP.terminal.queue')
  page.keyboard.type('echo two');page.keyboard.press('Shift+Enter');page.keyboard.type('echo lines');js('ICEY_APP.terminal.queue');check('Shift Enter edits multiline',js('ICEY_APP.terminal.line==="echo two\\necho lines"'));page.keyboard.press('Enter');idle();check('Multiline execution via real keypress','two\nlines\n' in js('ICEY_APP.terminal.snapshot()'))
  # Selecting terminal text does not produce a new shell command.
  js('ICEY_APP.terminal.term.selectAll()');check('Native terminal text selection',bool(js('ICEY_APP.terminal.term.getSelection()')));js('ICEY_APP.terminal.term.clearSelection()')
 except Exception:
  check('Advanced runner completed',False,traceback.format_exc())
 finally:
  report={'passed':sum(x['status']=='pass' for x in results),'total':len(results),'results':results,'method':'Real Chromium keyboard, viewport scroll samples, screenshot pixel hashes; no mocked terminal.'}
  (R/'tests/terminal-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report['passed'],'/',report['total']);b.close()
