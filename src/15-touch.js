'use strict';
// ═══════════════════════════════════════════════════════════════════
//  TOUCH  —  drag anywhere to swim (an analog stick that appears under
//  your thumb), hold BURST, tap MAP or ⇄. Works with a mouse as well.
// ═══════════════════════════════════════════════════════════════════
const touch = { turn: 0, climb: 0, id: null, ox: 0, oy: 0 };
const stickEl = $('stick'), knobEl = stickEl.querySelector('i'), STICK_R = 56;
if (MOBILE) { document.body.classList.add('touch'); bl.textContent = 'drag to swim · hold burst · tap ◆'; }
function cycleCreature(dir = 1) {
  const list = SPECIES.filter(sp => unlocked.has(sp.id)); if (list.length < 2) { say('you have not yet become anyone else', 2); return; }
  const i = list.indexOf(P.sp); becomeSpecies(list[(i + (dir > 0 ? 1 : list.length - 1)) % list.length]); say(`YOU ARE A ${P.sp.name.toUpperCase()}`, 2); splash(0.4);
}
function setTitleHint() {
  const ch = loadedSave ? CHAPTERS[loadedSave.ch].title : null;
  $('titlehint').textContent = MOBILE ? (ch ? 'TAP TO CONTINUE' : 'TAP TO BEGIN')
    : TITLE_HINT;
  $('restart').style.display = 'none';
}
function unlockAudio() { startAudio(); if (audio && audio.ac.state !== 'running') audio.ac.resume(); }   // iOS needs this inside a gesture
addEventListener('pointerdown', e => {
  unlockAudio(); pressedAny();
  if (started && menu) { const cy = toCell(e.clientY), i = menu.rows.findIndex(([a, b]) => cy >= a && cy <= b); if (i >= 0) { menu.sel = i; menuKey('Enter'); } return; }
  if (!MOBILE && started) { if (needFull()) openMenu('main'); return; }   // desktop plays on the keyboard
  if (!started) { startGame(loadedSave); return; }
  if (helpOpen) { helpOpen = false; help.classList.add('gone'); return; }
  if (touch.id !== null) return;
  touch.id = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY;
  stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.style.display = 'block';
});
addEventListener('pointermove', e => {
  if (started && menu) { const cy = toCell(e.clientY), i = menu.rows.findIndex(([a, b]) => cy >= a && cy <= b); if (i >= 0) menu.sel = i; return; }
  if (e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.ox, dy = e.clientY - touch.oy, d = Math.hypot(dx, dy), k = Math.min(1, d / STICK_R) / Math.max(d, 1e-3);
  touch.turn = -dx * k; touch.climb = -dy * k;
  if (Math.abs(touch.turn) < 0.12) touch.turn = 0; if (Math.abs(touch.climb) < 0.12) touch.climb = 0;
  touch.kx = dx * k * STICK_R; touch.ky = dy * k * STICK_R;
});
const endStick = e => { if (e.pointerId !== touch.id) return; touch.id = null; touch.turn = touch.climb = touch.kx = touch.ky = 0; stickEl.style.display = 'none'; };
addEventListener('pointerup', e => { unlockAudio(); endStick(e); }); addEventListener('pointercancel', endStick);
function tbtn(id, down, up) {
  const el = $(id), stop = e => { e.stopPropagation(); e.preventDefault(); };
  el.addEventListener('pointerdown', e => { stop(e); unlockAudio(); down(el); });
  if (up) for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, e => { stop(e); up(el); });
}
tbtn('tBurst', el => { keys.ShiftLeft = true; el.classList.add('on'); }, el => { keys.ShiftLeft = false; el.classList.remove('on'); });
tbtn('tAct', () => { if (started) act(); });
tbtn('tMap', () => { if (started) toggleMap(); });
tbtn('tCreature', () => { if (started) cycleCreature(1); });
tbtn('tPause', () => { if (started && !menu) openMenu('main'); });
mapEl.addEventListener('pointerdown', e => { e.stopPropagation(); const li = e.target.closest('li'); if (li) { const i = [...li.parentNode.children].indexOf(li); travelTo(checkpoints[i]); } toggleMap(); });
help.addEventListener('pointerdown', e => { e.stopPropagation(); helpOpen = false; help.classList.add('gone'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { for (const k in keys) keys[k] = false; touch.turn = touch.climb = 0; } });
