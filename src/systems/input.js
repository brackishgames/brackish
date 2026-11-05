import * as THREE from 'three';
import { DEV, MOBILE, TEST } from '../core/env.js?v=__BUILD__';
import { canFull, fullscreen, goFull, isFull, lockLandscape } from '../core/screen.js?v=__BUILD__';
import { DEFAULT_BINDS, saveSettings, settings } from '../core/settings.js?v=__BUILD__';
import { resize } from '../render/display.js?v=__BUILD__';
import { world } from '../world/structures.js?v=__BUILD__';
import { day } from '../world/time.js?v=__BUILD__';
import { feverR } from '../actors/fever.js?v=__BUILD__';
import { P, act } from '../actors/player.js?v=__BUILD__';
import { wild } from '../actors/wildlife.js?v=__BUILD__';
import { startAudio } from './audio.js?v=__BUILD__';
import { SAVE_KEY, loadedSave } from './save.js?v=__BUILD__';
import { pressedAny, startGame, started, story } from './story.js?v=__BUILD__';
import { feedbackItems, feedbackKey, openFeedback } from '../ui/feedback.js?v=__BUILD__';
import { $, LORE, bl, checkpoints, help, mapKey, mapOpen, renderHelpKeys, say, toggleMap } from '../ui/hud.js?v=__BUILD__';
import { cycleCreature, tilt, touch, touchHint } from '../ui/touch.js?v=__BUILD__';
import { camPos, paused } from '../app/frame.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  INPUT (arrows + space), AUDIO
// ═══════════════════════════════════════════════════════════════════
export const keys = {};
for (const ev of ['fullscreenerror', 'webkitfullscreenerror']) document.addEventListener(ev, () => { fullscreen.pending = false; });
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { fullscreen.pending = false; for (const k in keys) keys[k] = false; if (isFull() && menu && canFull) closeMenu(); if (MOBILE && isFull()) lockLandscape(); });
export const sprinting = () => input.burst;
// WASD players drive their own speed; until a WASD key is pressed the animal cruises on its own (arrows, touch)
export let wasdSeen = false;
export const usingWASD = () => wasdSeen;
// ── controllers: any pad the browser sees (USB or Bluetooth: Xbox, PlayStation, Switch Pro...) on the standard layout.
//    left stick steers, RT swims, LT eases off, A / ✕ bursts, X / □ is the ability, right stick looks around,
//    Y / △ the map, LB the creature you have been, START pause, BACK help. Buttons go through the keyboard handler.
export const pad = { turn: 0, throttle: 0, climb: 0, burst: false, lookX: 0, lookY: 0, active: false, held: {}, sony: false, ref: null };
export const B = action => settings.binds[action];   // the key an action is bound to
export const PAD_KEYS = { 0: () => (menu || mapOpen || !started || photo) ? 'Enter' : null, 1: () => photo ? B('photo') : menu ? 'Escape' : helpOpen ? B('help') : mapOpen ? B('map') : null, 2: () => started && !menu && !mapOpen ? B('ability') : null,
  3: () => B('map'), 4: () => B('creature'), 11: () => started && !menu ? B('photo') : null, 8: () => B('help'), 9: () => B('pause'), 12: () => 'ArrowUp', 13: () => 'ArrowDown', 14: () => 'ArrowLeft', 15: () => 'ArrowRight' };
export const PAD_HINT = () => pad.sony ? 'L STICK steer   R2 swim   ✕ burst   □ ability   R STICK look   △ map   OPTIONS pause' : 'L STICK steer   RT swim   A burst   X ability   R STICK look   Y map   START pause';
addEventListener('gamepadconnected', e => { pad.sony = /054c|dualsense|dualshock|playstation|wireless controller/i.test(e.gamepad.id); if (started) say('CONTROLLER CONNECTED', 2); });
addEventListener('gamepaddisconnected', () => { pad.active = false; pad.ref = null; bl.textContent = keyboardHint(); if (started) say('CONTROLLER DISCONNECTED', 2); });
export function pollPad() {
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
export function rumble(strong, weak = strong * 0.6, ms = 220) {   // felt in the hands, where the controller can
  const v = pad.ref && pad.ref.vibrationActuator; if (!v || !pad.active || !settings.shake) return;
  try { v.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }); } catch {}
}
export const KEYNAME = { burst: ['SHIFT', 'A', '✕'], rise: ['SPACE', 'L STICK UP', 'L STICK UP'], dive: ['C', 'L STICK DOWN', 'L STICK DOWN'], ability: ['E', 'X', '□'], map: ['M', 'Y', '△'], tab: ['TAB', 'LB', 'L1'] };
export const kn = n => pad.active ? KEYNAME[n][pad.sony ? 2 : 1] : keyLabel(B(n === 'tab' ? 'creature' : n));
export const keyLabel = code => ({ Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'R SHIFT', ControlLeft: 'CTRL', ControlRight: 'R CTRL', AltLeft: 'ALT', AltRight: 'R ALT', Tab: 'TAB', Enter: 'ENTER',
  Backspace: 'BACKSPACE', CapsLock: 'CAPS', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' })[code] || String(code || '?').replace(/^(Key|Digit|Numpad)/, '').toUpperCase();
export const keyboardHint = () => `${keyLabel(B('forward'))}${keyLabel(B('left'))}${keyLabel(B('back'))}${keyLabel(B('right'))} swim   ${kn('rise')} rise   ${kn('dive')} dive   ${kn('burst')} burst   ${kn('ability')} ability   ${kn('map')} map   ${keyLabel(B('help'))} help`;

// ── one snapshot of what the player is asking for, read once per step from every device: keyboard, controller, touch, tilt.
//    nothing else reads the devices for swimming. a test sets it directly through __game.setInput().
export const input = { turn: 0, climb: 0, throttle: 0, burst: false, forced: false };
export let inputOverride = null;
export const setInputOverride = o => { inputOverride = o; };
export const held = action => !!keys[B(action)] || (action === 'burst' && B('burst') === 'ShiftLeft' && !!keys.ShiftRight);
export const clamp1 = v => Math.max(-1, Math.min(1, v));
export function readInput() {
  const o = inputOverride; input.forced = !!o;
  if (o) { input.turn = o.turn || 0; input.climb = o.climb || 0; input.throttle = o.throttle ?? 1; input.burst = !!o.burst; return input; }   // throttle 1 is a cruise
  input.turn = clamp1((held('left') || keys.ArrowLeft ? 1 : 0) - (held('right') || keys.ArrowRight ? 1 : 0) + touch.turn + pad.turn + tilt.turn);
  input.climb = clamp1((held('rise') ? 1 : 0) - (held('dive') ? 1 : 0) + touch.climb + pad.climb + tilt.climb);
  input.throttle = clamp1((held('forward') || keys.ArrowUp ? 1 : 0) - (held('back') || keys.ArrowDown ? 1 : 0) + pad.throttle + (touch.id !== null || !usingWASD() ? 1 : 0));   // touch players, and anyone who hasn't touched forward, cruise on their own
  input.burst = held('burst') || pad.burst || touch.hold;
  return input;
}
// ── rebinding: pick an action in settings, press the key you want. a key that was already in use swaps over
export const ACTIONS = [['forward', 'FORWARD'], ['back', 'BACK'], ['left', 'TURN LEFT'], ['right', 'TURN RIGHT'], ['rise', 'RISE'], ['dive', 'DIVE'], ['burst', 'BURST'], ['ability', 'ABILITY'],
  ['map', 'MAP'], ['creature', 'CHANGE BODY'], ['photo', 'PHOTO'], ['help', 'HELP'], ['pause', 'PAUSE'], ['feedback', 'FEEDBACK']];
export function bindKey(code) {
  const a = menu.binding; if (code === 'Escape') { menu.binding = null; return; }
  if (['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) return;   // those always do their own thing
  const other = Object.keys(settings.binds).find(k => k !== a && settings.binds[k] === code); if (other) settings.binds[other] = settings.binds[a];
  settings.binds[a] = code; menu.binding = null; saveSettings(); refreshKeyHints();
}
export function refreshKeyHints() { if (!pad.active && !MOBILE) bl.textContent = keyboardHint(); renderHelpKeys(); }
export const needFull = () => started && canFull && !DEV && !TEST && !isFull() && !pad.active && !fullscreen.pending;   // full screen on its way: no pause card flashing up meanwhile   // a controller player may stay windowed

// ── mouse: steer where you point (pointer locked to the game); hold the right button to look around without turning
export const aim = { yaw: null, pitch: 0, pitchT: 0, look: false, lookYaw: 0, lookPitch: 0, lookT: 9 };
export const mouseSteering = () => settings.mouseSteer && !MOBILE && document.pointerLockElement === document.documentElement;
export function lockPointer() { if (!TEST && !MOBILE && settings.mouseSteer && started && !document.pointerLockElement) try { document.documentElement.requestPointerLock()?.catch?.(() => {}); } catch {} }
addEventListener('mousemove', e => {
  if (!started || (paused && !photo)) return; const s = 0.0022 * settings.mouse, dy = e.movementY * (settings.invertY ? -1 : 1);
  if (photo) { photo.yaw -= e.movementX * s; photo.pitch = Math.max(-1.3, Math.min(1.3, photo.pitch + dy * s)); return; }
  if (aim.look) { aim.lookYaw -= e.movementX * s; aim.lookPitch = Math.max(-0.8, Math.min(0.8, aim.lookPitch - dy * s)); aim.lookT = 0; }
  else if (mouseSteering()) { aim.yaw = (aim.yaw ?? P.yaw) - e.movementX * s; aim.pitch = Math.max(-0.9, Math.min(0.9, aim.pitch - dy * s)); if (dy) aim.pitchT = 0; }
});
addEventListener('mousedown', e => { if (e.button === 2 && started) aim.look = true; });
addEventListener('mouseup', e => { if (e.button === 2) aim.look = false; });
addEventListener('contextmenu', e => { if (started) e.preventDefault(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && started && !menu && settings.mouseSteer && !MOBILE) { endPhoto(); openMenu('main'); } });   // ESC lets the mouse go: that's a pause
export let helpOpen = false;
export function setHelp(open) { helpOpen = open; help.classList.toggle('gone', !open); }
// ── pause menu: leaving full screen, P, or START opens it; the bay stops while it is up
export let menu = null, photo = null;
// photo opportunities: the game picks the moments, not the player. a landmark or wreck close by, inside the fever,
// a leap together with the pod, the surface at dawn.
export function photoSpot() {
  if (!started) return null;
  for (const w of world.wrecks) if (Math.hypot(w.x - P.pos.x, w.z - P.pos.z) < 70) return w.name;
  if (feverR(P.pos) < 1.2) return 'THE FEVER';
  if (wild.some(o => o.partner && o.air)) return 'TOGETHER';
  if (day.hour > 5.4 && day.hour < 7.2 && P.pos.y > -1.2) return 'DAWN';
  return null;
}
export function startPhoto() { const spot = photoSpot(); if (!spot) return; closeMenu(); const d = camPos.clone().sub(P.pos); photo = { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y / (d.length() || 1), -0.9, 0.9)), dist: Math.max(2, d.length()), t: 0, shot: false, savedT: -9, spot }; lockPointer(); }
export function endPhoto() { photo = null; }
addEventListener('wheel', e => { if (photo) photo.dist = THREE.MathUtils.clamp(photo.dist * (e.deltaY > 0 ? 1.1 : 0.9), 1.2, 60); }, { passive: true });
export const clampI = (v, a, b) => Math.max(a, Math.min(b, v));
export const onOff = v => v ? 'ON' : 'OFF';
export function openMenu(kind) { menu = { kind, sel: 0, rows: [] }; for (const k in keys) keys[k] = false; aim.look = false; if (document.pointerLockElement) document.exitPointerLock?.(); }
export function closeMenu() { menu = null; }
export function resume() { closeMenu(); tilt.zero = null; if (canFull && !DEV && !TEST && !isFull() && !pad.active) goFull(); lockPointer(); }
export function restartChapter() { closeMenu(); story.begin(story.ch); resume(); }   // the chapter puts you where it begins
export function menuItems() {
  if (menu.kind === 'settings') return [
    { label: () => 'VOLUME  ' + '◆'.repeat(settings.volume) + '·'.repeat(10 - settings.volume), adj: d => settings.volume = d === 'cycle' ? (settings.volume + 1) % 11 : clampI(settings.volume + d, 0, 10) },
    { label: () => 'AMBIENCE  ' + '◆'.repeat(settings.amb) + '·'.repeat(10 - settings.amb), adj: d => settings.amb = d === 'cycle' ? (settings.amb + 1) % 11 : clampI(settings.amb + d, 0, 10) },
    { label: () => 'EFFECTS  ' + '◆'.repeat(settings.fx) + '·'.repeat(10 - settings.fx), adj: d => settings.fx = d === 'cycle' ? (settings.fx + 1) % 11 : clampI(settings.fx + d, 0, 10) },
    { label: () => `SOUND CAPTIONS  ${onOff(settings.captions)}`, adj: () => settings.captions = !settings.captions },
    { label: () => `TURN SPEED  ${(settings.turn / 100).toFixed(1)}X`, adj: d => settings.turn = d === 'cycle' ? (settings.turn >= 150 ? 50 : settings.turn + 10) : clampI(settings.turn + d * 10, 50, 150) },
    { label: () => 'COMFORT', act: () => { menu.kind = 'comfort'; menu.sel = 0; } },
    { label: () => `MOUSE STEERING  ${onOff(settings.mouseSteer)}`, adj: () => settings.mouseSteer = !settings.mouseSteer },
    { label: () => `MOUSE SPEED  ${settings.mouse.toFixed(1)}X`, adj: d => settings.mouse = d === 'cycle' ? (settings.mouse >= 3 ? 0.3 : Math.round(settings.mouse * 10 + 1) / 10) : Math.round(clampI(settings.mouse * 10 + d, 3, 30)) / 10 },
    ...(MOBILE ? [{ label: () => `TILT STEERING  ${onOff(settings.tilt)}`, adj: () => { settings.tilt = !settings.tilt; tilt.turn = tilt.climb = 0; tilt.zero = null; if (settings.tilt && !tilt.ok) tilt.asked = false; bl.textContent = touchHint(); } }] : []),
    { label: () => `INVERT Y  ${onOff(settings.invertY)}`, adj: () => settings.invertY = !settings.invertY },
    { label: () => `LARGE TEXT  ${onOff(settings.bigText)}`, adj: () => settings.bigText = !settings.bigText },
    ...(MOBILE ? [] : [{ label: () => 'CONTROLS', act: () => { menu.kind = 'controls'; menu.sel = 0; } }]),
    { label: () => `SEND CRASH REPORTS  ${onOff(settings.crashReports)}`, adj: () => settings.crashReports = !settings.crashReports },
    { label: () => 'SHOW TIPS AGAIN', act: () => { settings.tips = {}; say('tips will show again', 1.5); } },
    { label: () => 'BACK', act: () => { menu.kind = 'main'; menu.sel = 1; } }];
  if (menu.kind === 'controls') return [...ACTIONS.map(([a, name]) => ({ label: () => `${name}  ${menu.binding === a ? '· press a key ·' : keyLabel(B(a))}`, act: () => { menu.binding = a; } })),
    { label: () => 'RESET TO DEFAULTS', act: () => { settings.binds = { ...DEFAULT_BINDS }; saveSettings(); refreshKeyHints(); } },
    { label: () => 'BACK', act: () => { menu.kind = 'settings'; menu.sel = menuSettingsIndex('CONTROLS'); } }];
  if (menu.kind === 'comfort') return [   // what game makers offer so the camera never makes anyone feel sick
    { label: () => `FIELD OF VIEW  ${settings.fov}°`, adj: d => { settings.fov = d === 'cycle' ? (settings.fov >= 90 ? 50 : settings.fov + 5) : clampI(settings.fov + d * 5, 50, 90); resize(); } },
    { label: () => `HORIZON TILT  ${onOff(settings.horizonTilt)}`, adj: () => settings.horizonTilt = !settings.horizonTilt },
    { label: () => `CAMERA SWAY  ${onOff(settings.sway)}`, adj: () => settings.sway = !settings.sway },
    { label: () => `SPEED EFFECTS  ${onOff(settings.speedFx)}`, adj: () => settings.speedFx = !settings.speedFx },
    { label: () => `COMFORT VIGNETTE  ${onOff(settings.vignette)}`, adj: () => settings.vignette = !settings.vignette },
    { label: () => `SCREEN SHAKE  ${onOff(settings.shake)}`, adj: () => settings.shake = !settings.shake },
    { label: () => `HIT FLASH  ${onOff(settings.flash)}`, adj: () => settings.flash = !settings.flash },
    { label: () => `FLICKER  ${onOff(settings.flicker)}`, adj: () => settings.flicker = !settings.flicker },
    { label: () => 'BACK', act: () => { menu.kind = 'settings'; menu.sel = menuSettingsIndex('COMFORT'); } }];
  if (menu.kind === 'feedback') return feedbackItems();
  if (menu.kind === 'journal') return [...checkpoints.filter(c => LORE[c.name]).map(c => ({ label: () => c.name.toUpperCase(), act: () => { menu.kind = 'note'; menu.note = c.name; menu.back = menu.sel; menu.sel = 0; } })),
    { label: () => 'BACK', act: () => { menu.kind = 'main'; menu.sel = 4; } }];
  if (menu.kind === 'note') return [{ label: () => 'BACK', act: () => { menu.kind = 'journal'; menu.sel = menu.back || 0; } }];
  if (menu.kind === 'confirm') return [{ label: () => 'NO, KEEP SWIMMING', act: () => { menu.kind = 'main'; menu.sel = 0; } },
    { label: () => 'YES, START OVER', act: () => { try { localStorage.removeItem(SAVE_KEY); } catch {} location.reload(); } }];
  return [
    { label: () => 'RESUME', act: resume },
    { label: () => 'SETTINGS', act: () => { menu.kind = 'settings'; menu.sel = 0; } },
    { label: () => 'HOW TO SWIM', act: () => { closeMenu(); setHelp(true); } },
    { label: () => 'FAST TRAVEL', act: () => { closeMenu(); toggleMap(); } },
    { label: () => 'JOURNAL', act: () => { menu.kind = 'journal'; menu.sel = 0; } },
    { label: () => 'SEND FEEDBACK', act: () => openFeedback() },
    ...(photoSpot() ? [{ label: () => 'PHOTO MODE · ' + photoSpot().toUpperCase(), act: startPhoto }] : []),
    { label: () => 'RESTART CHAPTER', act: restartChapter },
    { label: () => 'NEW GAME', act: () => { menu.kind = 'confirm'; menu.sel = 0; } }];
}
export const menuSettingsIndex = label => { const k = menu.kind; menu.kind = 'settings'; const i = menuItems().findIndex(it => it.label() === label); menu.kind = k; return Math.max(0, i); };
export function menuKey(code) {
  const items = menuItems(), it = items[menu.sel];
  if (code === 'ArrowUp' || code === 'KeyW') menu.sel = (menu.sel + items.length - 1) % items.length;
  else if (code === 'ArrowDown' || code === 'KeyS') menu.sel = (menu.sel + 1) % items.length;
  else if ((code === 'ArrowLeft' || code === 'KeyA') && it.adj) it.adj(-1);
  else if ((code === 'ArrowRight' || code === 'KeyD') && it.adj) it.adj(1);
  else if (code === 'Enter' || code === 'Space') { if (it.act) it.act(); else if (it.adj) it.adj('cycle'); }   /* a tap or Enter steps a slider round, so touch can reach every value */
  else if (code === 'Escape' || code === 'Backspace' || code === B('pause')) {
    if (menu.kind === 'note') { menu.kind = 'journal'; menu.sel = menu.back || 0; } else if (menu.kind === 'controls' || menu.kind === 'comfort') { const back = menu.kind.toUpperCase(); menu.kind = 'settings'; menu.sel = menuSettingsIndex(back); } else if (menu.kind !== 'main') { menu.kind = 'main'; menu.sel = 0; } else if (code !== 'Escape' || !needFull()) resume(); }
  saveSettings();
}
addEventListener('keydown', e => {
  if (menu?.kind === 'feedback') { feedbackKey(e); return; }   // typing a note: the keys are words, not swimming
  const is = a => e.code === B(a);
  keys[e.code] = true; if ([B('forward'), B('back'), 'ArrowUp', 'ArrowDown'].includes(e.code)) wasdSeen = true; startAudio(); pressedAny();
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', B('rise'), B('dive'), B('creature')].includes(e.code)) e.preventDefault();
  if (started && needFull() && !menu) openMenu('main');
  if (started && menu) { if (menu.binding) { e.preventDefault(); if (e.isTrusted) bindKey(e.code); } else menuKey(e.code); return; }
  if (photo) { if (e.code === 'Enter') photo.shot = true; else if (is('photo') || is('pause') || e.code === 'Escape') endPhoto(); return; }
  if (started && is('photo') && !mapOpen && !helpOpen) { startPhoto(); return; }
  if (started && is('feedback') && !mapOpen) { if (helpOpen) setHelp(false); openFeedback(); return; }   /* only where there is something to take */
  if (started && (is('pause') || (e.code === 'Escape' && !isFull()))) { if (mapOpen) toggleMap(); if (helpOpen) setHelp(false); openMenu('main'); return; }
  if (!started) { if (e.code === 'Enter') startGame(loadedSave); return; }
  if (is('help')) setHelp(!helpOpen);
  if (is('map')) toggleMap();
  if (mapOpen) { mapKey(e.code); return; }
  if (is('creature')) cycleCreature(e.shiftKey ? -1 : 1);
  if (is('ability') && !e.repeat) act();
});
addEventListener('keyup', e => keys[e.code] = false);
