// The game, played by a script. Headless Chrome opens it in ?test, where the world only moves when stepped, so every
// scenario is exact: set the input, step N frames of 1/60 s, check the state. Nothing sleeps: a test waits for the
// game's own events, or for a condition on the page's animation frames (tests/chrome.mjs).   node tests/game.mjs [filter]
import assert from 'node:assert/strict';
import { launch } from './chrome.mjs';
import { serve } from '../tools/serve.mjs';
const only = process.argv[2];
const server = await serve(0), URL0 = `http://localhost:${server.address().port}/?test&seed=1`, browser = await launch();
const results = []; let page, pad, phone;   // the pages, so each scenario can be started from calm
async function scenario(name, fn, { start = true } = {}) {   // start: a desktop scenario begins in a game already under way, so each can run on its own
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { for (const p of [page, pad, phone]) if (p?.open && !p.closed) { await p.activate(); await p.eval('__game.calm()').catch(() => {}); }
    if (start && page && !page.closed) await page.eval('__game.start()');
    await fn(); results.push([true, name]); console.log(`✔ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
  catch (e) { results.push([false, name]); console.log(`✖ ${name}\n    ${String(e.stack || e).split('\n').slice(0, 4).join('\n    ')}`); }
}
const S = (page, n, input) => page.eval(`__game${input ? `.setInput(${JSON.stringify(input)})` : ''}.step(${n})`);
const SECOND = 60, STILL_FOR = 0.25;   // steps in a second of world time; how much screen time to watch the world stay still for
const noErrors = page => assert.deepEqual(page.errors.filter(e => !/GPU stall|GL Driver|favicon/.test(e)), [], 'no errors in the page');
const HOLE = [27.60636, -82.74974];   // the deepest point of the Egmont hole: 27.9 m to the bottom in the shipped depths

// ── desktop ──────────────────────────────────────────────────────
page = await browser.page(); await page.open(URL0); await page.eval('randGate.watching = true; 1');   // from here on, any roll of the world's dice outside a world step is reported
await scenario('boots clean; the title waits; the world stands still until stepped', async () => {
  assert.equal((await page.eval('__game.state()')).started, false);
  const b = await page.eval('__game.start()'); assert.equal(b.started, true); assert.equal(b.chapter, 0); assert.match(b.chapterTitle, /EGMONT/);
  const shown = await page.eval('WU.uTime.value'); await page.until(`WU.uTime.value > ${shown + STILL_FOR}`, 'screen time passing');
  assert.equal((await page.eval('__game.state()')).simTime, b.simTime, 'no world time passes between steps');
  const c = await S(page, SECOND); assert.ok(Math.abs(c.simTime - b.simTime - 1) < 1e-9, 'sixty steps is one second'); noErrors(page);
}, { start: false });
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
  await page.until(`readouts.tide.includes('TIDE 2.2 MPH 1.9 KT →')`, 'the TIDE readout, pointing right'); await page.eval('Bay.live.stations = []; 1');
});
await scenario('structures are solid: a burst into a Skyway pier stops at its face, and you feel it', async () => {
  const pier = await page.eval(`world.solids.find(c => c.tag === 'skyway pier')`); assert.ok(pier, 'the Skyway piers are colliders');
  await page.eval(`P.pos.set(${pier.x} + 20, -5, ${pier.z}); P.yaw = Math.PI / 2; P.vel.set(0, 0, 0); P.bumps = 0; 1`);
  for (let i = 0; i < 30; i++) { await S(page, 10, { burst: true }); assert.equal(await page.eval(`pushOut(world.solids.find(c => c.tag === 'skyway pier'), P.pos.x, P.pos.y, P.pos.z, 0.1)`), null, 'never inside the pier'); }
  const s = await page.eval('__game.state()'); assert.ok(s.bumps >= 1, 'a hard hit is felt'); assert.ok(Math.hypot(s.pos[0] - pier.x, s.pos[2] - pier.z) > 4.4, 'stopped outside it');
});
await scenario('the seafloor has no gaps: every ring reaches into the hole of the ring around it, wherever you swim', async () => {
  const gaps = await page.eval(`(() => { const bad = [];
    for (let p = -5000; p < 5000; p += 0.73) for (let L = 1; L < CLIP_LEVELS; L++) { const fine = 2 ** (L - 1), coarse = 2 ** L, half = CLIP_N / 2 * fine, hole = ringHole(L) * coarse, oF = clipOrigin(p, fine), oC = clipOrigin(p, coarse);
      if (oC - hole < oF - half || oC + hole > oF + half) bad.push([p, L]); } return bad.slice(0, 3); })()`);
  assert.deepEqual(gaps, []);
});
await scenario('the title logo lets go when you turn away, instead of hanging there edge-on as a row of dots', async () => {
  await page.eval(`logo.m.uniforms.uGo.value = -1; logo.held = 0; logo.m.uniforms.uOrigin.value.copy(P.pos).add(new THREE.Vector3(0, 50, 0)); const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); logo.m.uniforms.uUp.value.set(0, 1, 0); logo.m.uniforms.uRight.value.copy(fwd).setY(0).normalize(); stepLogo(0); 1`);
  assert.ok(await page.eval('logo.m.uniforms.uGo.value >= 0'), 'released');
  await page.eval('logo.mesh.visible = false; logo.m.uniforms.uGo.value = 6; 1');
});
await scenario('the Skyway stands on its own deck: pylons and piers under it, every stay cable meeting it', async () => {
  const r = await page.eval(`(() => { const M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), get = (name, i) => { const m = world.meshes.find(x => x.name === name); m.getMatrixAt(i, M); M.decompose(p, q, sc); return { x: p.x, y: p.y, z: p.z, h: sc.y }; };
    const decks = world.meshes.find(x => x.name === 'bridge decks'), centres = []; for (let i = 0; i < decks.count; i++) { const d = get('bridge decks', i); centres.push(d); }
    const nearestDeck = (x, z) => Math.min(...centres.map(c => Math.hypot(c.x - x, c.z - z)));
    const pylons = [0, 1].map(i => get('Skyway pylons', i)), cables = world.meshes.find(x => x.name === 'Skyway stay cables');
    const feet = []; for (let i = 0; i < cables.count; i++) feet.push(get('Skyway stay cables', i));
    return { pylonOff: pylons.map(t => nearestDeck(t.x, t.z)), footOff: Math.max(...feet.map(f => nearestDeck(f.x, f.z))), footY: feet.map(f => f.y), deckTop: SKYWAY_SPEC.clearance + SKYWAY_SPEC.deckDepth }; })()`);
  for (const d of r.pylonOff) assert.ok(d < 12, `a pylon ${d.toFixed(1)} m from the deck's line`);   // the deck is drawn in 20 m pieces: its centres are at most 10 m from any point on it
  assert.ok(r.footOff < 12, `a cable foot ${r.footOff.toFixed(1)} m off the deck`); for (const y of r.footY) assert.ok(Math.abs(y - r.deckTop) < 0.01, 'every cable meets the deck at its top');
});
await scenario('every chapter begins where it should, however far away you were: at its place, or in reach of its goal', async () => {
  const far = [27.93, -82.63];   // Old Tampa Bay, the far end of the bay from every chapter
  const n = await page.eval('CHAPTERS.length');
  for (let i = 0; i < n; i++) {
    await page.eval(`__game.teleport(${far}, 4); 1`); const s = await page.eval(`__game.chapter(${i})`);
    const r = await page.eval(`(() => { const c = CHAPTERS[${i}], g = c.goal ? c.goal() : null,   /* the chapter's own goal: story.goal only catches up on the next step */ at = c.start ? toXZ(...c.start) : null;
      return { title: c.title, free: !!c.free, fromStart: at ? Math.hypot(P.pos.x - at[0], P.pos.z - at[1]) : null, fromGoal: g ? Math.hypot(P.pos.x - g[0], P.pos.z - g[1]) : null, withFever: !!c.withFever, feverR: feverR(P.pos) }; })()`);
    assert.equal(s.chapter, i, `${r.title} began`);
    if (r.free) continue;   // free swim: anywhere is fine
    if (r.withFever) assert.ok(r.feverR < 1.2, `${r.title}: among the fever (${r.feverR.toFixed(2)})`);
    else if (r.fromStart != null) assert.ok(r.fromStart < 150, `${r.title}: ${r.fromStart.toFixed(0)} m from where it begins`);
    if (r.fromGoal != null) assert.ok(r.fromGoal < 800, `${r.title}: its goal ${r.fromGoal.toFixed(0)} m away`);
  }
  await page.eval('__game.chapter(0)');
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
  const sent = await page.event('feedback-sent'); await page.key('Enter', 'Enter', 13); const { url } = await sent();
  const u = new URL(url); assert.equal(u.origin + u.pathname, 'https://github.com/brackishgames/brackish/issues/new'); assert.equal(u.searchParams.get('template'), 'feedback.yml', 'the issue form');
  assert.equal(u.searchParams.get('what'), 'the shark went through a piling', 'the note, in its own box');
  const details = u.searchParams.get('details'); assert.ok(/^version: /.test(details) && details.includes('\nchapter: I · THE HOLE OFF EGMONT') && details.includes('\nseed: 1'), 'what the game knew, as plain lines');
  assert.equal(u.searchParams.get('title'), 'Feedback: the shark went through a piling');
  await browser.closeWhere(u => u.startsWith('https://github.com/')); await page.activate();   // the issue tab would sit in front of the game
  const s = await page.eval('__game.state()'); assert.equal(s.menu, null); assert.match(s.said, /THANK YOU/);
});
await scenario('the menu is short: every card fits at a glance, and back lands where you came from', async () => {
  await page.key('KeyP', 'p', 80); await page.until(`menu?.kind === 'main'`, 'the pause card');
  for (const kind of ['main', 'settings', 'sound', 'controls']) { await page.eval(`menu.kind = '${kind}'; 1`); const rows = await page.eval('menuItems().length'); assert.ok(rows <= 8, `${kind}: ${rows} rows`); }
  await page.eval(`menu.kind = 'main'; menu.sel = menuItems().findIndex(i => i.label() === 'SETTINGS'); 1`); const from = await page.eval('menu.sel');
  await page.key('Enter', 'Enter', 13); await page.until(`menu.kind === 'settings'`, 'into settings');
  await page.key('Enter', 'Enter', 13); await page.until(`menu.kind === 'sound'`, 'into sound');
  await page.key('Escape', 'Escape', 27); await page.until(`menu.kind === 'settings' && menu.sel === 0`, 'back on SOUND');
  await page.key('Escape', 'Escape', 27); await page.until(`menu.kind === 'main' && menu.sel === ${from}`, 'back on SETTINGS');
  await page.key('Escape', 'Escape', 27); await page.until('!menu && !paused', 'resumed');
});
await scenario('rebinding: pick BURST, press B, and B bursts; a key already in use swaps over', async () => {
  await page.eval(`openMenu('keys'); menu.binding = 'burst'; 1`); await page.key('KeyB', 'b', 66);
  assert.equal(await page.eval('settings.binds.burst'), 'KeyB'); await page.eval('closeMenu(); 1');
  await page.keyDown('KeyB', 'b', 66); let s = await S(page, 1); assert.equal(s.input.burst, true, 'B bursts'); await page.keyUp('KeyB', 'b', 66); s = await S(page, 1); assert.equal(s.input.burst, false);
  await page.eval(`openMenu('keys'); menu.binding = 'burst'; 1`); await page.key('KeyE', 'e', 69);
  assert.equal(await page.eval('settings.binds.burst'), 'KeyE'); assert.equal(await page.eval('settings.binds.ability'), 'KeyB', 'the ability took the old key');
  await page.eval(`settings.binds = { ...DEFAULT_BINDS }; closeMenu(); 1`);
});
await scenario('a shape crosses in the murk and never hunts', async () => {
  await page.eval(`__game.teleport(${HOLE}, 8); 1`); await S(page, 3 * SECOND, {}); await page.eval('shadow.t = 0; 1'); let seen = false;   // a few seconds for the bay's animals to be about first
  for (let i = 0; i < 40; i++) { const s = await S(page, 45, {}); seen ||= s.passing.length > 0; assert.equal(s.hunted, false, 'nothing hunts you'); }
  assert.ok(seen, 'something passed: ' + await page.eval(`JSON.stringify({ t: shadow.t, y: P.pos.y, started, paused, menu: menu?.kind, hunting: wild.filter(o => o.hunting).map(o => o.sp.id), far: wild.filter(o => o.id < WILD_ACTIVE && o.sp && !o.hunting && !o.partner && !o.passing && o.pos.distanceTo(P.pos) > 60).length, ch: story.ch })`));
});
await scenario('deep water: the display loses segments; near the top it is whole again', async () => {
  await page.eval(`__game.teleport(${HOLE}, 30); 1`); await S(page, 2, {});
  assert.ok((await page.eval('__game.state()')).depth > 18); await page.until('lastHudFail > 0', 'segments dropping at depth');
  await page.eval(`P.pos.y = -2; 1`); await page.until('lastHudFail === 0', 'a whole display near the top');
});
await scenario('the quiet HUD: calm water is just the bay; a hit brings the hearts up; ALWAYS ON keeps it all up', async () => {
  const was = await page.eval('({ linger: TUNE.hud.linger, fall: TUNE.hud.fall })');
  await page.eval(`__game.teleport(${HOLE}, 12); story.beganAt = -1e9; TUNE.hud.linger = 0.3; TUNE.hud.fall = 6; 1`);
  try {
    await page.until(`['hearts', 'motion', 'ability', 'place', 'depth'].every(n => hudParts[n].k === 0)`, 'everything about you down, in calm water');
    await page.eval('P.hp = 2; 1'); await page.until('hudParts.hearts.k === 1', 'the hearts up after a hit');
    await page.eval('settings.hudFull = true; 1'); await page.until('Object.values(hudParts).every(p => p.k === 1)', 'all of it up, always');
  } finally { await page.eval(`settings.hudFull = false; TUNE.hud.linger = ${was.linger}; TUNE.hud.fall = ${was.fall}; P.hp = 3; 1`); }
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
await scenario('no errors on the desktop run, and the world\'s dice only ever rolled inside a world step', async () => {
  noErrors(page); const leaks = await page.eval('[...randLeaks]');
  assert.equal(leaks.length, 0, 'rand() outside simStep (a seed would replay differently on another machine): ' + JSON.stringify(leaks));
});
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
  const tap = async (x, y) => { const up = await phone.domEvent('pointerup'); await phone.touchDown(x, y); await phone.touchUp(); await up(); };
  await tap(195, 420); assert.equal((await phone.eval('__game.state()')).started, false, 'upright, a tap does not start');
  await phone.metrics({ mobile: true, w: 844, h: 390, angle: 90 }); await phone.until('!portrait()', 'the phone turned sideways');
  await tap(420, 200); await phone.until('started', 'a sideways tap starting the game');
  const SETTLED = 16;   // the tilt smoothing takes 30% of each reading: after this many, it has all but arrived
  let reading = 0;   // Chrome reports a reading only when it changes: each one is made different from the last, then waited for in the game
  const orient = async (beta, gamma) => { for (let i = 0; i < SETTLED; i++) { const b = beta + (reading++ % 3) * 0.2;
    await phone.cmd('DeviceOrientation.setDeviceOrientationOverride', { alpha: 0, beta: b, gamma }); await phone.until(`tilt.last && Math.abs(tilt.last.beta - ${b}) < 1e-6 && Math.abs(tilt.last.gamma - ${gamma}) < 1e-6`, `the reading ${b}, ${gamma}`); } };
  await orient(0, -50); await phone.eval('__game.clearInput(); tilt.zero = null; 1'); await orient(0, -50);
  let s = await S(phone, 1); assert.ok(Math.abs(s.input.turn) < 0.1 && Math.abs(s.input.climb) < 0.1, `level: ${JSON.stringify(s.input)}`);
  await orient(20, -50); s = await S(phone, 1); assert.ok(s.input.turn < -0.4, `leaned right turns right: ${s.input.turn}`);
  await orient(0, -50); await orient(0, -20); s = await S(phone, 1); assert.ok(s.input.climb < -0.5, `top tipped away dives: ${s.input.climb}`);
  await phone.touchDown(300, 200); await phone.until('touch.hold', 'the thumb'); s = await S(phone, 1); assert.equal(s.input.burst, true, 'a thumb held anywhere bursts');
  await phone.touchUp(); await phone.until('!touch.hold', 'the thumb lifted'); s = await S(phone, 1); assert.equal(s.input.burst, false);
  noErrors(phone);
});
await phone.close(); phone.closed = true;

// ── determinism ──────────────────────────────────────────────────
await scenario('a seed replays the same run, however many screen frames fall between world steps', async () => {
  const run = async waitForFrames => {
    const pg = await browser.page(); await pg.open(URL0.replace('seed=1', 'seed=7')); await pg.eval('__game.start()'); await pg.eval(`startAudio(); __game.teleport(${HOLE}, 8)`);   // the sound running, as it is for a player
    for (let i = 0; i < 10; i++) {
      await S(pg, SECOND, { turn: (i % 3) - 1, burst: i % 4 === 0 });
      if (waitForFrames) { const t = await pg.eval('WU.uTime.value'); await pg.until(`WU.uTime.value > ${t + STILL_FOR}`, 'screen frames between steps'); }   // a slower machine: more frames per step
    }
    const out = await pg.eval(`JSON.stringify({ you: P.pos.toArray().map(v => v.toFixed(6)), camera: camPos.toArray().map(v => v.toFixed(6)), fever: fever.c.toArray().map(v => v.toFixed(6)), wild: wild.filter(w => w.sp).map(w => w.sp.id + ' ' + w.pos.toArray().map(v => v.toFixed(4)).join(' ')), next: rand() })`);
    await pg.close(); return out;
  };
  assert.equal(await run(true), await run(false), 'the same world, frame for frame');
});

browser.close(); server.close();
const failed = results.filter(r => !r[0]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`); process.exit(failed.length ? 1 : 0);
