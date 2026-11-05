'use strict';
// ═══════════════════════════════════════════════════════════════════
//  TEST + DEBUG  —  ?test (your machine only): the world stands still
//  until a test steps it. window.__game is the whole interface:
//    await __game.ready                      the bay has loaded
//    await __game.start()                    past the title, into chapter I
//    __game.setInput({ turn, climb, throttle, burst }) · clearInput()
//    __game.step(frames)                     exact 1/60 s steps; returns state()
//    __game.state()                          a plain snapshot to assert on
//    __game.teleport(lat, lon, depth)        put the player somewhere
//  ?dev adds F3 (a readout of the world) and [ ] (slow the world, speed it up).
// ═══════════════════════════════════════════════════════════════════
let bootDone; const booted = new Promise(r => bootDone = r);
const errorLog = [];   // filled by 17-feedback.js
function snapshot() {
  const near = wild.filter(w => w.sp && w.id < WILD_ACTIVE);
  return { seed: SEED, simTime, started, paused, menu: menu?.kind ?? null, binding: menu?.binding ?? null, mapOpen, helpOpen, portrait: portrait(),
    chapter: story.ch, chapterTitle: CHAPTERS[story.ch].title, species: P.sp.id, pos: [P.pos.x, P.pos.y, P.pos.z], latLon: toLL(P.pos.x, P.pos.z),
    depth: -P.pos.y, floor: floorAt(P.pos.x, P.pos.z), yaw: P.yaw, pitch: P.pitch, speed: P.speed, hp: P.hp, sta: P.sta ?? 1, bursting: !!P.bursting, air: P.air,
    current: P.current || 0, bumps: P.bumps || 0, hunted: near.some(w => w.hunting), dread, huntHeat, passing: near.filter(w => w.passing).map(w => w.sp.id),
    wild: near.map(w => w.sp.id), said: storyEl.textContent, hudFail: lastHudFail, fov: camera.fov, input: { ...input }, errors: errorLog.map(e => e.text) };
}
const testApi = {
  ready: booted,
  async start() { if (!started) { const begun = once('chapter-begun'); startGame(null); await begun; } return snapshot(); },
  async chapter(i) { const begun = once('chapter-begun'); story.begin(i); await begun; return snapshot(); },
  setInput(o) { setInputOverride({ ...o }); return this; },
  clearInput() { setInputOverride(null); return this; },
  step(n = 1) { for (let i = 0; i < n; i++) simStep(1 / 60); return snapshot(); },
  state: snapshot,
  calm() { if (menu) { if (menu.kind === 'feedback') fbEl().blur(); closeMenu(); } if (mapOpen) toggleMap(); if (helpOpen) setHelp(false); if (photo) endPhoto(); setInputOverride(null); for (const k in keys) keys[k] = false; return snapshot(); },   // every scenario starts from here
  teleport(lat, lon, depth = 3) { const [x, z] = toXZ(lat, lon); P.pos.set(x, Math.max(-depth, floorAt(x, z) + P.sp.alt + 0.2), z); P.vel?.set(0, 0, 0); cameraBehind(); return snapshot(); },
};
if (TEST || DEV) window.__game = testApi;

// ── ?dev: F3 shows the world's state; [ and ] halve and double the speed of time
const debug = { on: false };
if (DEV) addEventListener('keydown', e => {
  if (e.code === 'F3') { debug.on = !debug.on; e.preventDefault(); }
  if (e.code === 'BracketLeft' || e.code === 'BracketRight') { setTimeScale(timeScale * (e.code === 'BracketRight' ? 2 : 0.5)); say(`TIME ×${timeScale}`, 1); }
});
function drawDebug(W, H) {
  if (!DEV || !debug.on) return;
  const s = snapshot(), hunter = wild.find(w => w.hunting), lines = [
    `FPS ${(1 / Q.ema).toFixed(0)}  DPR ${Q.dprs[Q.level]}  TIME ×${timeScale}  SEED ${SEED}`,
    `${s.chapterTitle}  ${P.sp.name}`,
    `${s.latLon[0].toFixed(5)} ${s.latLon[1].toFixed(5)}  DOWN ${s.depth.toFixed(1)} FLOOR ${(-s.floor).toFixed(1)}`,
    `SPEED ${s.speed.toFixed(2)}  STA ${s.sta.toFixed(2)}  HP ${s.hp}  AIR ${(s.air ?? 1).toFixed(2)}  TIDE ${s.current.toFixed(2)}`,
    `DREAD ${dread.toFixed(2)}  HUNT ${hunter ? hunter.sp.id + ' ' + hunter.lunge.phase : '-'}  PASSING ${s.passing.join(' ') || '-'}  BUMPS ${s.bumps}`,
    `WILD ${s.wild.join(' ')}`, `ERRORS ${errorLog.length}`];
  lines.forEach((l, i) => pText(l, 4, Math.round(H * 0.22) + i * 7, 200, 'left', 1, true));
}
