'use strict';
// ═══════════════════════════════════════════════════════════════════
//  INPUT (arrows + space), AUDIO
// ═══════════════════════════════════════════════════════════════════
const keys = {};
// ── controllers: any pad the browser sees (USB or Bluetooth: Xbox, PlayStation, Switch Pro...) on the standard layout.
//    left stick steers, RT swims, LT eases off, A / ✕ bursts, X / □ is the ability, right stick looks around,
//    Y / △ the map, LB the creature you have been, START pause, BACK help. Buttons go through the keyboard handler.
const pad = { turn: 0, throttle: 0, climb: 0, burst: false, lookX: 0, lookY: 0, active: false, held: {}, sony: false, ref: null };
const PAD_KEYS = { 0: () => (menu || mapOpen || !started || photo) ? 'Enter' : null, 1: () => photo ? 'KeyO' : menu ? 'Escape' : helpOpen ? 'KeyH' : mapOpen ? 'KeyM' : null, 2: () => started && !menu && !mapOpen ? 'KeyE' : null,
  3: () => 'KeyM', 4: () => 'Tab', 11: () => started && !menu ? 'KeyO' : null, 8: () => 'KeyH', 9: () => 'KeyP', 12: () => 'ArrowUp', 13: () => 'ArrowDown', 14: () => 'ArrowLeft', 15: () => 'ArrowRight' };
const PAD_HINT = () => pad.sony ? 'L STICK steer   R2 swim   ✕ burst   □ ability   R STICK look   △ map   OPTIONS pause' : 'L STICK steer   RT swim   A burst   X ability   R STICK look   Y map   START pause';
addEventListener('gamepadconnected', e => { pad.sony = /054c|dualsense|dualshock|playstation|wireless controller/i.test(e.gamepad.id); if (started) say('CONTROLLER CONNECTED', 2); });
addEventListener('gamepaddisconnected', () => { pad.active = false; pad.ref = null; bl.textContent = 'WASD swim   SPACE rise   C dive   SHIFT burst   E ability   M map   H help'; if (started) say('CONTROLLER DISCONNECTED', 2); });
function pollPad() {
  const g = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p && p.connected) : null; pad.ref = g;
  if (!g) { pad.turn = pad.throttle = pad.climb = pad.lookX = pad.lookY = 0; pad.burst = false; return; }
  const dz = v => Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85, val = i => g.buttons[i] ? g.buttons[i].value : 0, inv = settings.invertY ? -1 : 1;   // a dead zone that doesn't jump
  pad.turn = -dz(g.axes[0] || 0); pad.climb = -dz(g.axes[1] || 0) * inv; pad.throttle = val(7) - val(6) * 0.6; pad.burst = val(0) > 0.5 || val(5) > 0.5;
  pad.lookX = dz(g.axes[2] || 0); pad.lookY = -dz(g.axes[3] || 0) * inv;
  if (!pad.active && (g.buttons.some(b => b.pressed) || g.axes.some(a => Math.abs(a) > 0.4))) { pad.active = true; wasdSeen = true; pad.sony = pad.sony || /054c|dualsense|dualshock|playstation|wireless controller/i.test(g.id); bl.textContent = PAD_HINT(); if (!started) $('titlehint').textContent = pad.sony ? 'PRESS ✕' : 'PRESS A'; }
  for (const i in PAD_KEYS) { const down = !!(g.buttons[i] && g.buttons[i].pressed);
    if (down && !pad.held[i]) { const code = PAD_KEYS[i](); if (code) { pad.held[i] = code; dispatchEvent(new KeyboardEvent('keydown', { code })); } else pad.held[i] = 'none'; }
    else if (!down && pad.held[i]) { if (pad.held[i] !== 'none') dispatchEvent(new KeyboardEvent('keyup', { code: pad.held[i] })); pad.held[i] = null; } }
}
function rumble(strong, weak = strong * 0.6, ms = 220) {   // felt in the hands, where the controller can
  const v = pad.ref && pad.ref.vibrationActuator; if (!v || !pad.active || !settings.shake) return;
  try { v.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }); } catch {}
}
const KEYNAME = { burst: ['SHIFT', 'A', '✕'], rise: ['SPACE', 'L STICK UP', 'L STICK UP'], dive: ['C', 'L STICK DOWN', 'L STICK DOWN'], ability: ['E', 'X', '□'], map: ['M', 'Y', '△'], tab: ['TAB', 'LB', 'L1'] };
const kn = n => KEYNAME[n][pad.active ? (pad.sony ? 2 : 1) : 0];
const needFull = () => started && canFull && !DEV && !isFull() && !pad.active;   // a controller player may stay windowed

// ── mouse: steer where you point (pointer locked to the game); hold the right button to look around without turning
const aim = { yaw: null, pitch: 0, look: false, lookYaw: 0, lookPitch: 0, lookT: 9 };
const mouseSteering = () => settings.mouseSteer && !MOBILE && document.pointerLockElement === document.documentElement;
function lockPointer() { if (!MOBILE && settings.mouseSteer && started && !document.pointerLockElement) try { document.documentElement.requestPointerLock()?.catch?.(() => {}); } catch {} }
addEventListener('mousemove', e => {
  if (!started || (paused && !photo)) return; const s = 0.0022 * settings.mouse, dy = e.movementY * (settings.invertY ? -1 : 1);
  if (photo) { photo.yaw -= e.movementX * s; photo.pitch = Math.max(-1.3, Math.min(1.3, photo.pitch + dy * s)); return; }
  if (aim.look) { aim.lookYaw -= e.movementX * s; aim.lookPitch = Math.max(-0.8, Math.min(0.8, aim.lookPitch - dy * s)); aim.lookT = 0; }
  else if (mouseSteering()) { aim.yaw = (aim.yaw ?? P.yaw) - e.movementX * s; aim.pitch = Math.max(-0.9, Math.min(0.9, aim.pitch - dy * s)); }
});
addEventListener('mousedown', e => { if (e.button === 2 && started) aim.look = true; });
addEventListener('mouseup', e => { if (e.button === 2) aim.look = false; });
addEventListener('contextmenu', e => { if (started) e.preventDefault(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && started && !menu && settings.mouseSteer && !MOBILE) { endPhoto(); openMenu('main'); } });   // ESC lets the mouse go: that's a pause
let mapOpen = false, mapSel = 0, helpOpen = false, started = false, paused = false;
// ── pause menu: leaving full screen, P, or START opens it; the bay stops while it is up
let menu = null, photo = null;
// photo opportunities: the game picks the moments, not the player. a landmark or wreck close by, inside the fever,
// a leap together with the pod, the surface at dawn.
function photoSpot() {
  if (!started) return null;
  for (const w of world.wrecks) if (Math.hypot(w.x - P.pos.x, w.z - P.pos.z) < 70) return w.name;
  if (feverR(P.pos) < 1.2) return 'THE FEVER';
  if (wild.some(o => o.partner && o.air)) return 'TOGETHER';
  if (dayClock > 5.4 && dayClock < 7.2 && P.pos.y > -1.2) return 'DAWN';
  return null;
}
function startPhoto() { const spot = photoSpot(); if (!spot) return; closeMenu(); const d = camPos.clone().sub(P.pos); photo = { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y / (d.length() || 1), -0.9, 0.9)), dist: Math.max(2, d.length()), t: 0, shot: false, savedT: -9, spot }; lockPointer(); }
function endPhoto() { photo = null; }
addEventListener('wheel', e => { if (photo) photo.dist = THREE.MathUtils.clamp(photo.dist * (e.deltaY > 0 ? 1.1 : 0.9), 1.2, 60); }, { passive: true });
const clampI = (v, a, b) => Math.max(a, Math.min(b, v));
const onOff = v => v ? 'ON' : 'OFF';
function openMenu(kind) { menu = { kind, sel: 0, rows: [] }; for (const k in keys) keys[k] = false; aim.look = false; if (document.pointerLockElement) document.exitPointerLock?.(); }
function closeMenu() { menu = null; }
function resume() { closeMenu(); if (canFull && !DEV && !isFull() && !pad.active) goFull(); lockPointer(); }
function restartChapter() { closeMenu(); if (story.ch === 0) travelTo({ name: CHAPTERS[0].title, x: START[0], z: START[1] }); story.begin(story.ch); resume(); }
function menuItems() {
  if (menu.kind === 'settings') return [
    { label: () => 'VOLUME  ' + '◆'.repeat(settings.volume) + '·'.repeat(10 - settings.volume), adj: d => settings.volume = d === 'cycle' ? (settings.volume + 1) % 11 : clampI(settings.volume + d, 0, 10) },
    { label: () => 'AMBIENCE  ' + '◆'.repeat(settings.amb) + '·'.repeat(10 - settings.amb), adj: d => settings.amb = d === 'cycle' ? (settings.amb + 1) % 11 : clampI(settings.amb + d, 0, 10) },
    { label: () => 'EFFECTS  ' + '◆'.repeat(settings.fx) + '·'.repeat(10 - settings.fx), adj: d => settings.fx = d === 'cycle' ? (settings.fx + 1) % 11 : clampI(settings.fx + d, 0, 10) },
    { label: () => `SOUND CAPTIONS  ${onOff(settings.captions)}`, adj: () => settings.captions = !settings.captions },
    { label: () => `TURN SPEED  ${(settings.turn / 100).toFixed(1)}X`, adj: d => settings.turn = d === 'cycle' ? (settings.turn >= 150 ? 50 : settings.turn + 10) : clampI(settings.turn + d * 10, 50, 150) },
    { label: () => `SCREEN SHAKE  ${onOff(settings.shake)}`, adj: () => settings.shake = !settings.shake },
    { label: () => `HIT FLASH  ${onOff(settings.flash)}`, adj: () => settings.flash = !settings.flash },
    { label: () => `MOUSE STEERING  ${onOff(settings.mouseSteer)}`, adj: () => settings.mouseSteer = !settings.mouseSteer },
    { label: () => `MOUSE SPEED  ${settings.mouse.toFixed(1)}X`, adj: d => settings.mouse = d === 'cycle' ? (settings.mouse >= 3 ? 0.3 : Math.round(settings.mouse * 10 + 1) / 10) : Math.round(clampI(settings.mouse * 10 + d, 3, 30)) / 10 },
    { label: () => `INVERT Y  ${onOff(settings.invertY)}`, adj: () => settings.invertY = !settings.invertY },
    { label: () => `LARGE TEXT  ${onOff(settings.bigText)}`, adj: () => settings.bigText = !settings.bigText },
    { label: () => 'SHOW TIPS AGAIN', act: () => { settings.tips = {}; say('tips will show again', 1.5); } },
    { label: () => 'BACK', act: () => { menu.kind = 'main'; menu.sel = 1; } }];
  if (menu.kind === 'journal') return [...checkpoints.filter(c => LORE[c.name]).map(c => ({ label: () => c.name.toUpperCase(), act: () => { menu.kind = 'note'; menu.note = c.name; menu.back = menu.sel; menu.sel = 0; } })),
    { label: () => 'BACK', act: () => { menu.kind = 'main'; menu.sel = 4; } }];
  if (menu.kind === 'note') return [{ label: () => 'BACK', act: () => { menu.kind = 'journal'; menu.sel = menu.back || 0; } }];
  if (menu.kind === 'confirm') return [{ label: () => 'NO, KEEP SWIMMING', act: () => { menu.kind = 'main'; menu.sel = 0; } },
    { label: () => 'YES, START OVER', act: () => { try { localStorage.removeItem(SAVE_KEY); } catch {} location.reload(); } }];
  return [
    { label: () => 'RESUME', act: resume },
    { label: () => 'SETTINGS', act: () => { menu.kind = 'settings'; menu.sel = 0; } },
    { label: () => 'HOW TO SWIM', act: () => { closeMenu(); helpOpen = true; help.classList.remove('gone'); } },
    { label: () => 'FAST TRAVEL', act: () => { closeMenu(); toggleMap(); } },
    { label: () => 'JOURNAL', act: () => { menu.kind = 'journal'; menu.sel = 0; } },
    ...(photoSpot() ? [{ label: () => 'PHOTO MODE · ' + photoSpot().toUpperCase(), act: startPhoto }] : []),
    { label: () => 'RESTART CHAPTER', act: restartChapter },
    { label: () => 'NEW GAME', act: () => { menu.kind = 'confirm'; menu.sel = 0; } }];
}
function menuKey(code) {
  const items = menuItems(), it = items[menu.sel];
  if (code === 'ArrowUp' || code === 'KeyW') menu.sel = (menu.sel + items.length - 1) % items.length;
  else if (code === 'ArrowDown' || code === 'KeyS') menu.sel = (menu.sel + 1) % items.length;
  else if ((code === 'ArrowLeft' || code === 'KeyA') && it.adj) it.adj(-1);
  else if ((code === 'ArrowRight' || code === 'KeyD') && it.adj) it.adj(1);
  else if (code === 'Enter' || code === 'Space') { if (it.act) it.act(); else if (it.adj) it.adj('cycle'); }   /* a tap or Enter steps a slider round, so touch can reach every value */
  else if (code === 'Escape' || code === 'Backspace' || code === 'KeyP') {
    if (menu.kind === 'note') { menu.kind = 'journal'; menu.sel = menu.back || 0; } else if (menu.kind !== 'main') { menu.kind = 'main'; menu.sel = 0; } else if (code !== 'Escape' || !needFull()) resume(); }
  saveSettings();
}
addEventListener('keydown', e => {
  keys[e.code] = true; if (e.code === 'KeyW' || e.code === 'KeyS') wasdSeen = true; startAudio(); pressedAny();
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'KeyC'].includes(e.code)) e.preventDefault();
  if (started && needFull() && !menu) openMenu('main');
  if (started && menu) { menuKey(e.code); return; }
  if (photo) { if (e.code === 'Enter') photo.shot = true; else if (['KeyO', 'Escape', 'KeyP'].includes(e.code)) endPhoto(); return; }
  if (started && e.code === 'KeyO' && !mapOpen && !helpOpen) { startPhoto(); return; }   /* only where there is something to take */
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
