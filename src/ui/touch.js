import * as THREE from 'three';
import { ramp, tiltAngles } from '../lib/tilt.js?v=__BUILD__';
import { DEV, MOBILE } from '../core/env.js?v=__BUILD__';
import { goLandscape, portrait } from '../core/screen.js?v=__BUILD__';
import { settings } from '../core/settings.js?v=__BUILD__';
import { SPECIES } from '../actors/creatures.js?v=__BUILD__';
import { P, act, becomeSpecies, unlocked } from '../actors/player.js?v=__BUILD__';
import { audio, splash, startAudio } from '../systems/audio.js?v=__BUILD__';
import { endPhoto, helpOpen, keys, menu, menuKey, needFull, openMenu, photo, setHelp } from '../systems/input.js?v=__BUILD__';
import { loadedSave } from '../systems/save.js?v=__BUILD__';
import { CHAPTERS, TITLE_HINT, pressedAny, startGame, started, story } from '../systems/story.js?v=__BUILD__';
import { fbEl } from './feedback.js?v=__BUILD__';
import { $, bl, checkpoints, help, mapEl, say, tip, toggleMap, travelTo } from './hud.js?v=__BUILD__';
import { toCell } from './panel.js?v=__BUILD__';
import { specimen } from '../app/specimens.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  TOUCH  —  drag anywhere to swim (an analog stick that appears under
//  your thumb), hold BURST, tap MAP or ⇄. Works with a mouse as well.
// ═══════════════════════════════════════════════════════════════════
export const touch = { turn: 0, climb: 0, id: null, ox: 0, oy: 0, hold: false, holdId: null };
// ── tilt: on a phone the phone is the fin. lean it like a wheel to turn, tip the top away to dive or toward you to rise.
//    you swim on your own, so the only thing left for your thumbs is to hold the screen to burst.
export const tilt = { turn: 0, climb: 0, ok: false, asked: false, zero: null, lean: 0, pitch: 0, angle: null, last: null };
export const tiltOn = () => MOBILE && settings.tilt && tilt.ok;
export const touchHint = () => tiltOn() ? 'tilt to steer · hold to burst · tap ◆' : 'drag to swim · hold burst · tap ◆';
export function enableTilt() {   // iOS asks once, and only from inside a tap
  if (!MOBILE || !settings.tilt || tilt.asked || !window.DeviceOrientationEvent) return; tilt.asked = true;
  const listen = () => addEventListener('deviceorientation', onTilt);
  if (typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(s => { if (s === 'granted') listen(); else say('motion access refused: drag to swim', 2.5); }).catch(() => {});
  else listen();
}
export function onTilt(e) {
  if (e.beta == null || e.gamma == null) return; tilt.last = e;
  const a = (screen.orientation?.angle ?? window.orientation ?? 0), { lean, pitch } = tiltAngles(e.beta, e.gamma, a);   // src/lib/tilt.js
  if (a !== tilt.angle) { tilt.angle = a; tilt.lean = lean; tilt.pitch = pitch; tilt.zero = null; }   // the phone turned over: start level again, no smoothing across it
  if (!tilt.ok) { tilt.ok = true; bl.textContent = touchHint(); tip('tilt', () => 'lean the phone to turn. tip the top away to dive, toward you to rise. hold the screen to burst.'); }
  tilt.lean += (lean - tilt.lean) * 0.3; tilt.pitch += (pitch - tilt.pitch) * 0.3;   // sensors jitter
  tilt.zero ??= tilt.pitch;   // however you hold it when you start, or resume, is level
  tilt.turn = settings.tilt ? ramp(tilt.lean, 0.06, 0.45) : 0;
  tilt.climb = settings.tilt ? -ramp(tilt.pitch - tilt.zero, 0.1, 0.5) : 0;
}
export const stickEl = document.getElementById('stick'), knobEl = stickEl.querySelector('i'), STICK_R = 56;
// changing body is the reward for the whole story: only in free swim, once you have been them all. inside the story each chapter chooses your body
export const canChangeBody = () => DEV || !!CHAPTERS[story.ch]?.free;
export function cycleCreature(dir = 1) {
  if (!canChangeBody()) return;
  const list = SPECIES.filter(sp => unlocked.has(sp.id)); if (list.length < 2) { say('you have not yet become anyone else', 2); return; }
  const i = list.indexOf(P.sp); becomeSpecies(list[(i + (dir > 0 ? 1 : list.length - 1)) % list.length]); say(`YOU ARE A ${P.sp.name.toUpperCase()}`, 2); splash(0.4);
}
export function setTitleHint() {
  const ch = loadedSave ? CHAPTERS[loadedSave.ch].title : null;
  $('titlehint').textContent = MOBILE ? (ch ? 'TAP TO CONTINUE' : 'TAP TO BEGIN')
    : ch ? 'ENTER OR CLICK TO CONTINUE' : TITLE_HINT;
  $('restart').style.display = 'none';
}
export function unlockAudio() { startAudio(); if (audio && audio.ac.state !== 'running') audio.ac.resume(); }   // iOS needs this inside a gesture
export const endStick = e => { if (e.pointerId === touch.holdId) { touch.holdId = null; touch.hold = false; } if (e.pointerId !== touch.id) return; touch.id = null; touch.turn = touch.climb = touch.kx = touch.ky = 0; stickEl.style.display = 'none'; };
export function tbtn(id, down, up) {
  const el = $(id), stop = e => { e.stopPropagation(); e.preventDefault(); };
  el.addEventListener('pointerdown', e => { stop(e); unlockAudio(); down(el); });
  if (up) for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, e => { stop(e); up(el); });
}
// photo mode on a phone: drag to orbit, pinch to zoom, tap to save, the pause button leaves
const lens = new Map(); let lensMoved = 0;
export function photoPointer(e, what) {
  if (what === 'down') { lens.set(e.pointerId, [e.clientX, e.clientY]); lensMoved = 0; return; }
  const was = lens.get(e.pointerId); if (!was) return;
  if (what === 'up') { lens.delete(e.pointerId); if (!lens.size && lensMoved < 10) photo.shot = true; return; }
  const dx = e.clientX - was[0], dy = e.clientY - was[1], other = [...lens].find(([id]) => id !== e.pointerId)?.[1]; lensMoved += Math.hypot(dx, dy);
  if (other) { const before = Math.hypot(was[0] - other[0], was[1] - other[1]), after = Math.hypot(e.clientX - other[0], e.clientY - other[1]); photo.dist = THREE.MathUtils.clamp(photo.dist * before / Math.max(after, 1), 0.6, 60); }
  else { photo.yaw -= dx * 0.006; photo.pitch = THREE.MathUtils.clamp(photo.pitch + dy * 0.006, -1.3, 1.3); }
  lens.set(e.pointerId, [e.clientX, e.clientY]);
}
export const letGo = () => { for (const k in keys) keys[k] = false; touch.turn = touch.climb = 0; touch.hold = false; touch.holdId = null; };
// wiring: the phone's buttons and stick, the map and help taps, letting go of everything when the window loses focus. boot calls this once everything has loaded
export function initTouch() {
  (screen.orientation || window).addEventListener(screen.orientation ? 'change' : 'orientationchange', () => tilt.last && onTilt(tilt.last));   // the screen turned: its frame changed even if the sensor didn't
  if (MOBILE) { document.body.classList.add('touch'); bl.textContent = 'drag to swim · hold burst · tap ◆'; }
  addEventListener('pointerdown', e => {
    if (specimen.on) return;
    unlockAudio(); pressedAny();
    if (photo) { if (MOBILE) photoPointer(e, 'down'); else photo.shot = true; return; }
    if (started && menu) { const cy = toCell(e.clientY), i = menu.rows.findIndex(([a, b]) => cy >= a && cy <= b); if (i >= 0) { menu.sel = i; menuKey('Enter'); } return; }
    if (!MOBILE && started) { if (needFull()) openMenu('main'); return; }   // desktop plays on the keyboard
    if (!started) { if (!portrait()) startGame(loadedSave); return; }
    if (helpOpen) { setHelp(false); return; }
    if (tiltOn()) { if (touch.holdId === null) { touch.holdId = e.pointerId; touch.hold = true; } return; }   // tilt steers; a thumb anywhere bursts
    if (touch.id !== null) return;
    touch.id = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY;
    stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.style.display = 'block';
  });
  addEventListener('pointermove', e => {
    if (photo && MOBILE) { photoPointer(e, 'move'); return; }
    if (started && menu) { const cy = toCell(e.clientY), i = menu.rows.findIndex(([a, b]) => cy >= a && cy <= b); if (i >= 0) menu.sel = i; return; }
    if (e.pointerId !== touch.id) return;
    const dx = e.clientX - touch.ox, dy = e.clientY - touch.oy, d = Math.hypot(dx, dy), k = Math.min(1, d / STICK_R) / Math.max(d, 1e-3);
    touch.turn = -dx * k; touch.climb = -dy * k;
    if (Math.abs(touch.turn) < 0.12) touch.turn = 0; if (Math.abs(touch.climb) < 0.12) touch.climb = 0;
    touch.kx = dx * k * STICK_R; touch.ky = dy * k * STICK_R;
  });
  addEventListener('pointerup', e => { if (photo && MOBILE) { photoPointer(e, 'up'); return; } unlockAudio(); if (menu?.kind === 'feedback') fbEl().focus({ preventScroll: true }); if (MOBILE) { goLandscape(); enableTilt(); } endStick(e); });   // a tap counts as a gesture on the way up: that is when phones allow full screen and motion addEventListener('pointercancel', endStick);
  tbtn('tBurst', el => { keys.ShiftLeft = true; el.classList.add('on'); }, el => { keys.ShiftLeft = false; el.classList.remove('on'); });
  tbtn('tAct', () => { if (started) act(); });
  tbtn('tMap', () => { if (started) toggleMap(); });
  tbtn('tCreature', () => { if (started) cycleCreature(1); });
  tbtn('tPause', () => { if (photo) endPhoto(); else if (started && !menu) openMenu('main'); });
  mapEl.addEventListener('pointerdown', e => { e.stopPropagation(); const li = e.target.closest('li'); if (li) { const i = [...li.parentNode.children].indexOf(li); travelTo(checkpoints[i]); } toggleMap(); });
  help.addEventListener('pointerdown', e => { e.stopPropagation(); setHelp(false); });
  addEventListener('blur', letGo);   // a SHIFT held while switching away would otherwise burst forever
  document.addEventListener('visibilitychange', () => { if (document.hidden) { for (const k in keys) keys[k] = false; touch.turn = touch.climb = 0; touch.hold = false; touch.holdId = null; tilt.zero = null; } });
}
