// Headless check: start the game, swim for 25 seconds, report exceptions and save a screenshot.
//   python3 -m http.server 18437 &   then   node tools/smoke.mjs /tmp/brackish-smoke
// Needs Google Chrome; uses the DevTools protocol directly, no packages.
import { spawn } from 'node:child_process'; import { writeFileSync, mkdirSync } from 'node:fs';
const C = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', out = process.argv[2] || '/tmp/brackish-smoke';
mkdirSync(out, { recursive: true });
const ch = spawn(C, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,900', '--remote-debugging-port=19339', `--user-data-dir=${out}/chr-smoke`, 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tabs; for (let i = 0; i < 40; i++) { try { tabs = await (await fetch('http://127.0.0.1:19339/json')).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0, exc = 0; const pend = {}; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } if (m.method === 'Runtime.exceptionThrown') { exc++; console.log('EXC', (m.params.exceptionDetails.url || "").split("/").pop(), m.params.exceptionDetails.lineNumber + 1, (m.params.exceptionDetails.exception?.description || "").slice(0, 220).replace(/\n/g, " / ")); } };
const cmd = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = (type, code, key, vk) => cmd('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk });
await cmd('Runtime.enable'); await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await cmd('Page.navigate', { url: 'http://localhost:18437/?dev' }); await sleep(12000);
await ev('keyDown', 'Enter', 'Enter', 13); await ev('keyUp', 'Enter', 'Enter', 13); await sleep(2000);
await ev('keyDown', 'KeyW', 'w', 87); await sleep(25000); await ev('keyUp', 'KeyW', 'w', 87);
const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/smoke.png`, Buffer.from(r.result.data, 'base64'));
console.log('exceptions', exc, '· screenshot', `${out}/smoke.png`); ws.close(); ch.kill(); process.exit(exc ? 1 : 0);
