// A small Chrome DevTools Protocol client: launch headless Chrome, open pages, evaluate, send real input. No packages.
// Nothing here sleeps: every wait is for an event, or for a condition the page reports on its own animation frames.
import { spawn } from 'node:child_process'; import { mkdtempSync, rmSync, existsSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const CANDIDATES = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
export const FAIL_AFTER_FRAMES = 600;   // a condition that hasn't come true in this many frames never will: the test fails, it doesn't wait
export const FAIL_AFTER_MS = 30000;     // and anything the page is asked that hasn't answered by now has hung: fail, saying what it was doing
export async function launch() {
  const bin = CANDIDATES.find(p => p && existsSync(p)); if (!bin) throw new Error('no Chrome found: set CHROME');
  const profile = mkdtempSync(join(tmpdir(), 'brackish-test-'));
  const proc = spawn(bin, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,720', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  // Chrome says where it's listening once it is: that line is the signal, not a delay
  const wsBase = await new Promise((ok, fail) => { let buf = ''; proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) ok(m[1]); }); proc.on('exit', c => fail(new Error('Chrome exited ' + c))); });
  const http = wsBase.replace(/^ws:/, 'http:').replace(/\/devtools\/.*$/, '');
  const browser = {
    async page() {
      const t = await (await fetch(`${http}/json/new?about:blank`, { method: 'PUT' })).json();
      const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
      let id = 0, heard = 0; const pend = {}, errors = [];
      ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
        if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
        if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) errors.push(m.params.entry.text);
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' ')); };
      const cmd = (method, params = {}) => new Promise((r, j) => { pend[++id] = m => m.error ? j(new Error(`${method}: ${m.error.message}`)) : r(m.result); ws.send(JSON.stringify({ id, method, params })); });
      await cmd('Runtime.enable'); await cmd('Log.enable'); await cmd('Page.enable');
      if (process.env.SLOW) await cmd('Emulation.setCPUThrottlingRate', { rate: +process.env.SLOW });   // SLOW=4: play on a machine four times slower, to flush out races
      const page = {
        cmd, errors,
        async eval(expr, what = expr.slice(0, 80)) { let guard; const hung = new Promise((_, no) => { guard = setTimeout(() => no(new Error('hung: ' + what)), FAIL_AFTER_MS); });
          const r = await Promise.race([cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }), hung]).finally(() => clearTimeout(guard)); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; },
        // resolves on the first animation frame where `expr` is true (and returns its value)
        until(expr, what = expr) { return page.eval(`new Promise((ok, no) => { let n = 0; const f = () => { let v; try { v = (${expr}); } catch (e) { v = false; } if (v) ok(v); else if (++n > ${FAIL_AFTER_FRAMES}) no(new Error(${JSON.stringify('never happened: ' + what)})); else requestAnimationFrame(f); }; f(); })`); },
        // listen for something, *then* cause it: input reaches the page by a different road than evaluate does, so a key can
        // arrive before a listener installed in the same breath. this installs it, waits until the page says so, and hands back the wait
        async listen(installExpr) { const slot = `__heard${++heard}`; await page.eval(`window.${slot} = (${installExpr}); 1`); return () => page.eval(`window.${slot}`, `waiting on ${installExpr}`); },
        event(type) { return page.listen(`once(${JSON.stringify(type)})`); },   // a game event (src/core/events.js)
        domEvent(type) { return page.listen(`new Promise(r => addEventListener(${JSON.stringify(type)}, r, { once: true }))`); },
        async open(url, { mobile = false, w = 1280, h = 720, angle = 0 } = {}) {
          await page.metrics({ mobile, w, h, angle });
          if (mobile) await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
          await fetch(`${http}/json/activate/${t.id}`);   // the page under test is the one in front: a tab behind gets no animation frames
          await cmd('Page.navigate', { url });
          await page.until('window.__game', 'the game loaded'); await page.eval('__game.ready');
        },
        metrics: ({ mobile = false, w, h, angle = 0 }) => cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile, screenOrientation: { type: angle ? 'landscapePrimary' : 'portraitPrimary', angle } }),
        key: async (code, key = code, vk = 0) => { await cmd('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk }); await cmd('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk }); },
        keyDown: (code, key = code, vk = 0) => cmd('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk }),
        keyUp: (code, key = code, vk = 0) => cmd('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk }),
        touchDown: (x, y) => cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }),
        touchUp: () => cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
        activate: () => fetch(`${http}/json/activate/${t.id}`),   // to the front: a tab behind gets no animation frames
        close: async () => { ws.close(); await fetch(`${http}/json/close/${t.id}`).catch(() => {}); },
      };
      return page;
    },
    async closeWhere(test) { for (const t of await (await fetch(`${http}/json/list`)).json()) if (test(t.url)) await fetch(`${http}/json/close/${t.id}`); },
    close() { proc.kill(); proc.on('exit', () => { try { rmSync(profile, { recursive: true, force: true }); } catch {} }); },
  };
  return browser;
}
