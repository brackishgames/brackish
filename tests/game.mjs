// The game, played by a script. Headless Chrome opens it in ?test, where the world only moves when stepped, so every
// scenario is exact: set the input, step N frames of 1/60 s, check the state. Nothing sleeps: a test waits for the
// game's own events, or for a condition on the page's animation frames (tests/chrome.mjs).   node tests/game.mjs [filter]
import assert from 'node:assert/strict';
import { launch } from './chrome.mjs';
import { serve } from '../tools/serve.mjs';
const only = process.argv[2];
const server = await serve(0), URL0 = `http://localhost:${server.address().port}/?test&seed=1`, browser = await launch();
const results = []; let page, pad, phone;   // the pages, so each scenario can be started from calm
async function scenario(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { for (const p of [page, pad, phone]) if (p?.open && !p.closed) await p.eval('__game.calm()').catch(() => {}); await fn(); results.push([true, name]); console.log(`✔ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
  catch (e) { results.push([false, name]); console.log(`✖ ${name}\n    ${String(e.stack || e).split('\n').slice(0, 4).join('\n    ')}`); }
}
const S = (page, n, input) => page.eval(`__game${input ? `.setInput(${JSON.stringify(input)})` : ''}.step(${n})`);
const SECOND = 60, STILL_FOR = 0.25;   // steps in a second of world time; how much screen time to watch the world stay still for
const noErrors = page => assert.deepEqual(page.errors.filter(e => !/GPU stall|GL Driver|favicon/.test(e)), [], 'no errors in the page');
const HOLE = [27.60636, -82.74974];   // the deepest point of the Egmont hole: 27.9 m to the bottom in the shipped depths

// ── desktop ──────────────────────────────────────────────────────
page = await browser.page(); await page.open(URL0);
await scenario('boots clean; the title waits; the world stands still until stepped', async () => {
  assert.equal((await page.eval('__game.state()')).started, false);
  const b = await page.eval('__game.start()'); assert.equal(b.started, true); assert.equal(b.chapter, 0); assert.match(b.chapterTitle, /EGMONT/);
  const shown = await page.eval('WU.uTime.value'); await page.until(`WU.uTime.value > ${shown + STILL_FOR}`, 'screen time passing');
  assert.equal((await page.eval('__game.state()')).simTime, b.simTime, 'no world time passes between steps');
  const c = await S(page, SECOND); assert.ok(Math.abs(c.simTime - b.simTime - 1) < 1e-9, 'sixty steps is one second'); noErrors(page);
});
await scenario('cruising with no input holds the cownose ray near its real cruise', async () => {
  await page.eval(`__game.teleport(${HOLE}, 6)`); const s = await S(page, 4 * SECOND, {});
  assert.ok(s.speed > 1.2 && s.speed < 1.7, `speed ${s.speed}`); assert.equal(s.bursting, false);
});
await scenario('burst: fast, five seconds, about 30 m, back in about two', async () => {
  await page.eval(`__game.teleport(${HOLE}, 6)`); await S(page, 2 * SECOND, {});
  let s = await S(page, SECOND, { burst: true }); assert.ok(s.speed > 5, `speed after 1 s ${s.speed}`); assert.ok(s.bursting);
  const burst = await page.eval('TUNE.burst'); let frames = SECOND, dist = 0, last = s.pos;
  while (s.bursting && frames < 3 * burst.secs * SECOND) { s = await S(page, 10); frames += 10; dist += Math.hypot(s.pos[0] - last[0], s.pos[2] - last[2]); last = s.pos; }
  assert.ok(Math.abs(frames / SECOND - burst.secs) < 0.25, `lasted ${frames / SECOND} s`); assert.ok(dist > 20 && dist < 45, `covered ${dist.toFixed(1)} m after the first second`);
  let back = 0; while (!s.bursting && back < 3 * burst.refill * SECOND) { s = await S(page, 5); back += 5; }
  assert.ok(Math.abs(back / SECOND - burst.reuseAt * burst.refill) < 0.25, `usable again after ${back / SECOND} s`);
  await page.until('camera.fov > camera.userData.baseFov + 5', 'the view widening at speed');
});
await scenario('let go of rise and the nose comes back level', async () => {
  await page.eval(`__game.teleport(${HOLE}, 10)`); let s = await S(page, SECOND, { climb: 1 }); assert.ok(s.pitch > 0.4, `pitch while rising ${s.pitch}`);
  s = await S(page, 1.5 * SECOND, {}); assert.ok(Math.abs(s.pitch) < 0.25, `pitch after letting go ${s.pitch}`);
});
await scenario('turning: left is left, right is right', async () => {
  await page.eval(`__game.teleport(${HOLE}, 8)`); const y0 = (await S(page, 1, {})).yaw;
  const l = await S(page, SECOND, { turn: 1 }); assert.ok(l.yaw > y0 + 0.3, `left ${l.yaw - y0}`);
  const r = await S(page, 1.5 * SECOND, { turn: -1 }); assert.ok(r.yaw < l.yaw - 0.3, `right ${r.yaw - l.yaw}`);
});
await scenario('back off: S slows you nearly to a stop', async () => {
  await page.eval(`__game.teleport(${HOLE}, 8)`); const s = await S(page, 3 * SECOND, { throttle: -1 }); assert.ok(s.speed < 0.3, `speed ${s.speed}`);
});
await scenario('the current is drift, not thrust: it carries you while your own speed stays low, and the HUD says TIDE', async () => {
  await page.eval(`__game.teleport(${HOLE}, 8); P.yaw = 0; Bay.live.stations = [{ id: 'T', x: P.pos.x, z: P.pos.z, at: () => ({ x: 1, z: 0 }) }]; 1`);
  const a = await S(page, SECOND / 2, { throttle: 0 }), b = await S(page, 2 * SECOND, { throttle: 0 });
  const dx = b.pos[0] - a.pos[0]; assert.ok(dx > 2.8 && dx < 4.6, `carried ${dx.toFixed(2)} m east in 2 s`); assert.ok(b.speed < 0.5, `own speed ${b.speed}`); assert.equal(b.bursting, false);
  assert.ok(Math.abs(b.current - 1) < 0.05, `current ${b.current}`);
  await page.until(`tl.textContent.includes('TIDE 1.0→')`, 'the TIDE readout, pointing right'); await page.eval('Bay.live.stations = []; 1');
});
await scenario('structures are solid: a burst into a Skyway pier stops at its face, and you feel it', async () => {
  const pier = await page.eval(`world.solids.find(c => c.kind === 'b' && c.y1 === 60)`); assert.ok(pier, 'the Skyway piers are colliders');
  await page.eval(`P.pos.set(${pier.x} + 20, -5, ${pier.z}); P.yaw = Math.PI / 2; P.vel.set(0, 0, 0); P.bumps = 0; 1`);
  for (let i = 0; i < 30; i++) { await S(page, 10, { burst: true }); assert.equal(await page.eval(`pushOut(world.solids.find(c => c.kind === 'b' && c.y1 === 60), P.pos.x, P.pos.y, P.pos.z, 0.1)`), null, 'never inside the pier'); }
  const s = await page.eval('__game.state()'); assert.ok(s.bumps >= 1, 'a hard hit is felt'); assert.ok(Math.hypot(s.pos[0] - pier.x, s.pos[2] - pier.z) > 4.4, 'stopped outside it');
});
await scenario('pause stops the world; the card fits on screen; ESC resumes', async () => {
  await page.key('KeyP', 'p', 80); await page.until(`menu?.kind === 'main' && paused`, 'the pause card');
  const t = (await page.eval('__game.state()')).simTime, s = await S(page, SECOND, {}); assert.equal(s.simTime, t, 'paused: no world time');
  await page.until('menu.rows.length', 'the card drawn'); assert.ok(await page.eval('menu.rows.filter(r => r[0] >= 0).length > 5 && menu.rows.every(r => r[1] < panel.h)'), 'every row is on screen');
  await page.key('Escape', 'Escape', 27); await page.until('!menu && !paused', 'resumed');
});
await scenario('comfort: no horizon tilt, sway or speed kick when they are off, and a still frame at the edges when asked', async () => {
  await page.eval(`settings.horizonTilt = false; settings.speedFx = false; settings.vignette = true; __game.teleport(${HOLE}, 8); 1`);
  await S(page, SECOND, { turn: 1, burst: true });
  await page.until('Math.abs(camera.up.x) < 1e-9 && Math.abs(camera.up.z) < 1e-9', 'a level horizon while turning');
  await page.until('Math.abs(camera.fov - camera.userData.baseFov) < 1e-6', 'no FOV kick'); await page.until('dotPass.uniforms.uTunnel.value > 0.3', 'the comfort vignette closing in');
  await page.eval(`settings.horizonTilt = true; settings.speedFx = true; settings.vignette = false; 1`); await S(page, SECOND, {});
});
await scenario('feedback: F opens a note; Enter sends it as a filled-in GitHub issue', async () => {
  await page.key('KeyF', 'f', 70); await page.until(`menu?.kind === 'feedback' && document.activeElement.id === 'fbtext'`, 'the note box, with the keyboard');
  await page.cmd('Input.insertText', { text: 'the shark went through a piling' });
  await page.until(`feedbackLines(40).join(' ').includes('the shark went through a piling')`, 'the note on the card');
  const sent = page.event('feedback-sent'); await page.key('Enter', 'Enter', 13); const { url } = await sent;
  const u = new URL(url), body = u.searchParams.get('body'); assert.equal(u.origin + u.pathname, 'https://github.com/brackishgames/brackish/issues/new');
  assert.ok(body.includes('the shark went through a piling') && body.includes('| chapter |') && body.includes('| seed | 1 |'), 'the note and what the game knew');
  assert.deepEqual(u.searchParams.get('labels').split(','), ['feedback', 'beta']);
  await browser.closeWhere(u => u.startsWith('https://github.com/'));   // the issue tab would sit in front of the game
  const s = await page.eval('__game.state()'); assert.equal(s.menu, null); assert.match(s.said, /THANK YOU/);
});
await scenario('rebinding: pick BURST, press B, and B bursts; a key already in use swaps over', async () => {
  await page.eval(`openMenu('controls'); menu.binding = 'burst'; 1`); await page.key('KeyB', 'b', 66);
  assert.equal(await page.eval('settings.binds.burst'), 'KeyB'); await page.eval('closeMenu(); 1');
  await page.keyDown('KeyB', 'b', 66); let s = await S(page, 1); assert.equal(s.input.burst, true, 'B bursts'); await page.keyUp('KeyB', 'b', 66); s = await S(page, 1); assert.equal(s.input.burst, false);
  await page.eval(`openMenu('controls'); menu.binding = 'burst'; 1`); await page.key('KeyE', 'e', 69);
  assert.equal(await page.eval('settings.binds.burst'), 'KeyE'); assert.equal(await page.eval('settings.binds.ability'), 'KeyB', 'the ability took the old key');
  await page.eval(`settings.binds = { ...DEFAULT_BINDS }; closeMenu(); 1`);
});
await scenario('a shape crosses in the murk and never hunts', async () => {
  await page.eval(`__game.teleport(${HOLE}, 8); shadow.t = 0; 1`); let seen = false;
  for (let i = 0; i < 40; i++) { const s = await S(page, 45, {}); seen ||= s.passing.length > 0; assert.equal(s.hunted, false, 'nothing hunts you'); }
  assert.ok(seen, 'something passed');
});
await scenario('deep water: the display loses segments; near the top it is whole again', async () => {
  await page.eval(`__game.teleport(${HOLE}, 30); 1`); await S(page, 2, {});
  assert.ok((await page.eval('__game.state()')).depth > 18); await page.until('lastHudFail > 0', 'segments dropping at depth');
  await page.eval(`P.pos.y = -2; 1`); await page.until('lastHudFail === 0', 'a whole display near the top');
});
await scenario('a dolphin\'s echo, deep, can come back off something with no name', async () => {
  await page.eval(`becomeSpecies(speciesById.dolphin); __game.teleport(${HOLE}, 12); thing.next = 0; TUNE.thing.chance = 1; echoThing(); TUNE.thing.chance = 0.3; 1`);
  assert.ok(await page.eval('thing.mesh.visible')); const d = await page.eval('thing.mesh.position.distanceTo(P.pos)'); assert.ok(d > 35 && d < 60, `at ${d} m`);
  await S(page, SECOND); assert.equal(await page.eval('thing.mesh.visible'), false, 'gone within a second');
  await page.eval('becomeSpecies(speciesById.cownose); 1');
});
await scenario('a bull shark hunts: it stalks, winds up, lunges, and lets go once you are far enough away', async () => {
  await page.eval(`__game.teleport(${HOLE}, 8); story.ch = 2; P.hp = 5; P.stun = 0;
    window.__shark = wild.find(o => o.id < WILD_ACTIVE && !o.partner); setWild(__shark, speciesById.bull, P.pos.x + 12, P.pos.y - 2, P.pos.z); __shark.interest = 1; __shark.cool = 0; 1`);
  const phases = new Set(); let s;
  for (let i = 0; i < 20 * 6; i++) { s = await S(page, SECOND / 6, {}); const ph = await page.eval('__shark.hunting ? __shark.lunge.phase : null'); if (ph) phases.add(ph); if (phases.has('lunge')) break; }
  assert.ok(s.hunted, 'it is hunting you'); assert.ok(phases.has('stalk') && phases.has('wind') && phases.has('lunge'), `phases seen: ${[...phases]}`);
  assert.ok((await page.eval('huntHeat')) > 0, 'the HUNTED meter shows');
  await page.eval(`P.pos.x += 400; 1`); s = await S(page, 2 * SECOND, {});
  assert.equal(await page.eval('__shark.hunting'), false, 'far away, it lets go'); await page.eval('story.ch = 0; 1');
});
await scenario('rebuilding the structures (as when OpenStreetMap\'s bridges arrive) frees the old ones and keeps them solid', async () => {
  const before = await page.eval('({ meshes: world.meshes.length, solids: world.solids.length, geometries: renderer.info.memory.geometries })');
  await page.eval(`setBridges(bridges.map(b => ({ ...b }))); buildStructures(); 1`); await page.until('renderer.info.memory.geometries > 0', 'a frame drawn');
  const after = await page.eval('({ meshes: world.meshes.length, solids: world.solids.length, geometries: renderer.info.memory.geometries })');
  assert.equal(after.meshes, before.meshes, 'the same structures'); assert.equal(after.solids, before.solids, 'just as solid');
  assert.ok(after.geometries <= before.geometries + 2, `GPU geometries ${before.geometries} → ${after.geometries}: the old ones were freed`);
});
await scenario('no errors on the desktop run', async () => noErrors(page));
await page.close(); page.closed = true;

// ── a controller ─────────────────────────────────────────────────
pad = await browser.page(); await pad.open(URL0);
await scenario('controller: A starts, the stick steers, RT swims, A bursts, Y maps, START pauses, B backs out; rebinding follows', async () => {
  await pad.eval(`window.__pad = { id: 'Xbox Wireless Controller', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [__pad] }); window.press = (i, on) => { __pad.buttons[i].pressed = on; __pad.buttons[i].value = on ? 1 : 0; }; 1`);
  const tapBtn = async i => { await pad.eval(`press(${i}, true); 1`); await pad.until(`pad.held[${i}]`, `button ${i} down`); await pad.eval(`press(${i}, false); 1`); await pad.until(`!pad.held[${i}]`, `button ${i} up`); };
  await tapBtn(0); await pad.until('started', 'A starting the game');
  await pad.eval(`__game.clearInput(); __pad.axes[0] = -1; 1`); await pad.until('pad.turn > 0.9', 'the stick read'); let s = await S(pad, 1); assert.ok(s.input.turn > 0.9, `left stick left turns left: ${s.input.turn}`);
  await pad.eval(`__pad.axes[0] = 0; press(7, true); 1`); await pad.until('pad.throttle > 0.9', 'RT read'); s = await S(pad, 1); assert.ok(s.input.throttle > 0.9, 'RT swims');
  await pad.eval(`press(0, true); 1`); await pad.until('pad.burst', 'A read'); s = await S(pad, 1); assert.equal(s.input.burst, true, 'A bursts'); await pad.eval(`press(0, false); press(7, false); 1`);
  await tapBtn(3); await pad.until('mapOpen', 'Y opening the map'); await tapBtn(3); await pad.until('!mapOpen', 'Y closing it');
  await tapBtn(9); await pad.until(`menu?.kind === 'main'`, 'START pausing'); await tapBtn(1); await pad.until('!menu', 'B backing out');
  await pad.eval(`settings.binds.map = 'KeyN'; 1`); await tapBtn(3); await pad.until('mapOpen', 'Y still mapping after the map key moved');
  await tapBtn(3); await pad.eval(`settings.binds = { ...DEFAULT_BINDS }; 1`); noErrors(pad);
});
await pad.close(); pad.closed = true;

// ── a phone ──────────────────────────────────────────────────────
phone = await browser.page(); await phone.open(URL0, { mobile: true, w: 390, h: 844 });
await scenario('phone: upright it waits on a card; sideways a tap starts; tilt steers and dives; a held thumb bursts', async () => {
  assert.equal((await phone.eval('__game.state()')).portrait, true);
  const tap = async (x, y) => { const up = phone.eval(`new Promise(r => addEventListener('pointerup', r, { once: true }))`); await phone.touchDown(x, y); await phone.touchUp(); await up; };
  await tap(195, 420); assert.equal((await phone.eval('__game.state()')).started, false, 'upright, a tap does not start');
  await phone.metrics({ mobile: true, w: 844, h: 390, angle: 90 }); await phone.until('!portrait()', 'the phone turned sideways');
  await tap(420, 200); await phone.until('started', 'a sideways tap starting the game');
  const SETTLED = 16;   // the tilt smoothing takes 30% of each reading: after this many, it has all but arrived
  const orient = async (beta, gamma) => { for (let i = 0; i < SETTLED; i++) { const got = phone.eval(`new Promise(r => addEventListener('deviceorientation', r, { once: true }))`);
    await phone.cmd('DeviceOrientation.setDeviceOrientationOverride', { alpha: 0, beta: beta + (i % 2) * 0.3, gamma }); await got; } };   // the jitter makes each one a real change, which is all Chrome reports
  await orient(0, -50); await phone.eval('__game.clearInput(); tilt.zero = null; 1'); await orient(0, -50);
  let s = await S(phone, 1); assert.ok(Math.abs(s.input.turn) < 0.1 && Math.abs(s.input.climb) < 0.1, `level: ${JSON.stringify(s.input)}`);
  await orient(20, -50); s = await S(phone, 1); assert.ok(s.input.turn < -0.4, `leaned right turns right: ${s.input.turn}`);
  await orient(0, -50); await orient(0, -20); s = await S(phone, 1); assert.ok(s.input.climb < -0.5, `top tipped away dives: ${s.input.climb}`);
  await phone.touchDown(300, 200); await phone.until('touch.hold', 'the thumb'); s = await S(phone, 1); assert.equal(s.input.burst, true, 'a thumb held anywhere bursts');
  await phone.touchUp(); await phone.until('!touch.hold', 'the thumb lifted'); s = await S(phone, 1); assert.equal(s.input.burst, false);
  noErrors(phone);
});
await phone.close(); phone.closed = true;

browser.close(); server.close();
const failed = results.filter(r => !r[0]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`); process.exit(failed.length ? 1 : 0);
