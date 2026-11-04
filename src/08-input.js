'use strict';
// ═══════════════════════════════════════════════════════════════════
//  INPUT (arrows + space), AUDIO
// ═══════════════════════════════════════════════════════════════════
const keys = {};
let mapOpen = false, mapSel = 0, helpOpen = false, started = false, paused = false;
// ── pause menu: leaving full screen, P, or START opens it; the bay stops while it is up
let menu = null;
const clampI = (v, a, b) => Math.max(a, Math.min(b, v));
const onOff = v => v ? 'ON' : 'OFF';
function openMenu(kind) { menu = { kind, sel: 0, rows: [] }; for (const k in keys) keys[k] = false; }
function closeMenu() { menu = null; }
function resume() { closeMenu(); if (canFull && !DEV && !isFull() && !pad.active) goFull(); }
function restartChapter() { closeMenu(); if (story.ch === 0) travelTo({ name: CHAPTERS[0].title, x: START[0], z: START[1] }); story.begin(story.ch); resume(); }
function menuItems() {
  if (menu.kind === 'settings') return [
    { label: () => 'VOLUME  ' + '◆'.repeat(settings.volume) + '·'.repeat(10 - settings.volume), adj: d => settings.volume = clampI(settings.volume + d, 0, 10) },
    { label: () => `TURN SPEED  ${(settings.turn / 100).toFixed(1)}X`, adj: d => settings.turn = clampI(settings.turn + d * 10, 50, 150) },
    { label: () => `SCREEN SHAKE  ${onOff(settings.shake)}`, adj: () => settings.shake = !settings.shake },
    { label: () => `HIT FLASH  ${onOff(settings.flash)}`, adj: () => settings.flash = !settings.flash },
    { label: () => `LARGE TEXT  ${onOff(settings.bigText)}`, adj: () => settings.bigText = !settings.bigText },
    { label: () => 'SHOW TIPS AGAIN', act: () => { settings.tips = {}; say('tips will show again', 1.5); } },
    { label: () => 'BACK', act: () => { menu.kind = 'main'; menu.sel = 1; } }];
  return [
    { label: () => 'RESUME', act: resume },
    { label: () => 'SETTINGS', act: () => { menu.kind = 'settings'; menu.sel = 0; } },
    { label: () => 'HOW TO SWIM', act: () => { closeMenu(); helpOpen = true; help.classList.remove('gone'); } },
    { label: () => 'FAST TRAVEL', act: () => { closeMenu(); toggleMap(); } },
    { label: () => 'RESTART CHAPTER', act: restartChapter }];
}
function menuKey(code) {
  const items = menuItems(), it = items[menu.sel];
  if (code === 'ArrowUp' || code === 'KeyW') menu.sel = (menu.sel + items.length - 1) % items.length;
  else if (code === 'ArrowDown' || code === 'KeyS') menu.sel = (menu.sel + 1) % items.length;
  else if ((code === 'ArrowLeft' || code === 'KeyA') && it.adj) it.adj(-1);
  else if ((code === 'ArrowRight' || code === 'KeyD') && it.adj) it.adj(1);
  else if (code === 'Enter' || code === 'Space') { if (it.act) it.act(); else if (it.adj) it.adj(1); }
  else if (code === 'Escape' || code === 'Backspace' || code === 'KeyP') { if (menu.kind === 'settings') { menu.kind = 'main'; menu.sel = 1; } else if (code !== 'Escape' || !needFull()) resume(); }
  saveSettings();
}
addEventListener('keydown', e => {
  keys[e.code] = true; if (e.code === 'KeyW' || e.code === 'KeyS') wasdSeen = true; startAudio(); pressedAny();
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'KeyC'].includes(e.code)) e.preventDefault();
  if (started && needFull() && !menu) openMenu('main');
  if (started && menu) { menuKey(e.code); return; }
  if (started && (e.code === 'KeyP' || (e.code === 'Escape' && !isFull()))) { if (mapOpen) toggleMap(); if (helpOpen) { helpOpen = false; help.classList.add('gone'); } openMenu('main'); return; }
  if (!started) { if (e.code === 'Enter') startGame(loadedSave); return; }
  if (e.code === 'KeyH') { helpOpen = !helpOpen; help.classList.toggle('gone', !helpOpen); }
  if (e.code === 'KeyM') toggleMap();
  if (mapOpen) { if (e.code === 'ArrowUp') mapSel = Math.max(0, mapSel - 1); if (e.code === 'ArrowDown') mapSel = Math.min(checkpoints.length - 1, mapSel + 1);
    if (e.code === 'Enter') { travelTo(checkpoints[mapSel]); toggleMap(); } renderMapList(); return; }
  if (e.code === 'Tab') cycleCreature(e.shiftKey ? -1 : 1);
  if (e.code === 'KeyE' && !e.repeat) act();
});
addEventListener('keyup', e => keys[e.code] = false);
