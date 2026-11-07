// Pictures of the game, one command each, always from the same seed, so a person or an AI can look at what changed.
//   node tools/shot.mjs                     every scene, plus .shots/sheet.png with them all on one image
//   node tools/shot.mjs pause burst         just those            node tools/shot.mjs --list      what there is
//   node tools/shot.mjs --at 27.62,-82.65,8 --clock 22 --look 0.5 --name skyway-night --js "P.hp = 1"     any spot, any hour
//   --w 1288 --h 810 --scale 2 --phone      the window. pictures land in .shots/ (not committed), and the paths are printed
import { writeFileSync, mkdirSync } from 'node:fs';
import { studio, settled, png, contactSheet } from './lib-shots.mjs';
const HOLE = '27.60636, -82.74974', SHALLOW = '27.603, -82.762';
const swim = (input, frames = 120) => `__game.setInput(${JSON.stringify(input)}); __game.step(${frames}); 1`;
const SCENES = {
  title: { started: false, until: `opa($('title')) > 0.9` },
  calm: { js: [`__game.teleport(${HOLE}, 12); story.beganAt = -1e9; 1`, swim({})], settle: 5.5 },
  swim: { js: [`__game.teleport(${HOLE}, 12); 1`, swim({ throttle: 0.6, turn: 0.4, climb: -0.4 })] },
  burst: { js: [`__game.teleport(${HOLE}, 12); 1`, swim({ throttle: 1, burst: true }, 90)] },
  shallows: { js: [`__game.teleport(${SHALLOW}, 6); 1`, swim({ throttle: 0.6, turn: 0.4 }, 240)] },
  bottom: { js: [`__game.teleport(${HOLE}, 30); 1`, swim({ throttle: 0.4, climb: -1 }, 120)] },
  surface: { js: [`__game.teleport(${HOLE}, 1); 1`, swim({ throttle: 1, climb: 1 }, 120)] },
  night: { js: [`day.hour = 23; __game.teleport(${HOLE}, 12); 1`, swim({ throttle: 0.6 })] },
  skyway: { js: ['__game.teleport(27.6205, -82.6555, 8); 1', swim({ throttle: 0.4 }, 60)] },
  pause: { js: [`openMenu('main'); 1`] },
  settings: { js: [`openMenu('settings'); 1`] },
  comfort: { js: [`openMenu('comfort'); 1`] },
  map: { js: ['toggleMap(); 1'] },
  help: { js: ['setHelp(true); 1'] },
  photo: { js: [`__game.teleport(${HOLE}, 12); 1`, swim({ throttle: 0.6 }, 60), 'startPhoto(); __game.step(2); 1'] },
  phone: { phone: true, js: [`__game.teleport(${HOLE}, 12); 1`, swim({ throttle: 0.6, turn: 0.4 })] },
};
const argv = process.argv.slice(2), opt = {}, names = [];
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a === '--list') opt.list = true; else if (a === '--phone') opt.phone = true; else if (a.startsWith('--')) opt[a.slice(2)] = argv[++i]; else names.push(a); }
if (opt.list) { console.log(Object.keys(SCENES).join('\n')); process.exit(0); }
if (opt.at || opt.js || opt.clock) { const [lat, lon, depth = 8] = (opt.at || HOLE).split(',').map(Number); const name = opt.name || 'custom'; SCENES[name] = { phone: opt.phone, js: [...(opt.clock ? [`day.hour = ${+opt.clock}; 1`] : []), `__game.teleport(${lat}, ${lon}, ${depth}); 1`, swim({ throttle: 0.2 }, 30), ...(opt.look ? [`P.pitch = ${+opt.look}; __game.step(2); 1`] : []), ...(opt.js ? [opt.js + '; 1'] : [])] }; names.push(name); }
const list = names.length ? names : Object.keys(SCENES), unknown = list.filter(n => !SCENES[n]); if (unknown.length) { console.error('no scene called ' + unknown.join(', ') + ' (--list shows them)'); process.exit(1); }
mkdirSync('.shots', { recursive: true });
const st = await studio(), w = +opt.w || 1288, h = +opt.h || 810, scale = +opt.scale || 1, tiles = [];
const page = await st.page(); let bad = 0;
for (const name of list) { const sc = SCENES[name], phone = sc.phone || opt.phone;
  await page.open(`${st.base}/?test&seed=1`, phone ? { mobile: true, w: 844, h: 390, angle: 90 } : { w, h });
  if (!phone && scale !== 1) await page.cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false });
  if (sc.started !== false) { await page.eval('__game.start()'); await page.until('WU.uTime.value > startedAt + TUNE.timing.hudIn[1] + 0.2', 'the HUD eased in'); }
  for (const js of sc.js || []) await page.eval(js);
  if (sc.until) await page.until(sc.until, name);
  await settled(page, sc.settle || 0.4);
  const data = await png(page), file = `.shots/${name}.png`; writeFileSync(file, Buffer.from(data, 'base64')); tiles.push({ png: data, caption: name });
  const fit = await page.eval(`(c => { const r = c.getBoundingClientRect(); return r.left === 0 && r.top === 0 && Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1; })(renderer.domElement)`);
  console.log(`${file}${page.errors.length ? '  ERRORS: ' + page.errors.join(' | ') : ''}${fit ? '' : '  CANVAS DOES NOT FIT THE WINDOW'}`); if (page.errors.length || !fit) bad = 1; page.errors.length = 0; }
if (list.length > 1) { const sheet = await contactSheet(page, tiles, { cols: 4, width: 400 }); writeFileSync('.shots/sheet.png', Buffer.from(sheet, 'base64')); console.log('.shots/sheet.png'); }
st.done(); process.exit(bad);
