'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SAVE  —  progress in localStorage, signed so an edited save is refused.
//  (A client-only game can never be fully cheat-proof; this stops casual edits.)
// ═══════════════════════════════════════════════════════════════════
const SAVE_KEY = 'brackish.save', SAVE_SALT = 'egmont-25m-' + location.host;
async function sha(text) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
let saveTimer = 0, loadedSave = null;
let lastSaved = -1e9, hudWakeT = 0, hudGain = 1, sayEndT = 0;
async function saveGame() {
  if (!started || DEV) return;   // dev mode never overwrites a real save
  lastSaved = performance.now();
  const data = { v: 1, ch: story.ch, unlocked: [...unlocked], cps: checkpoints, fed: P.fed || 0, eaten: [...eaten].slice(-400), clock: dayClock, pos: [P.pos.x, P.pos.y, P.pos.z], yaw: P.yaw, sp: P.sp.id, t: Date.now() };
  const json = JSON.stringify(data);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ json, sig: await sha(SAVE_SALT + json) })); } catch {}
}
async function loadGame() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const { json, sig } = JSON.parse(raw);
    if (sig !== await sha(SAVE_SALT + json)) { console.warn('save rejected: signature mismatch'); localStorage.removeItem(SAVE_KEY); return null; }
    const d = JSON.parse(json); return d.v === 1 ? d : null; } catch { return null; }
}
function applySave(d) {
  for (const id of d.unlocked) unlocked.add(id); for (const k of d.eaten || []) eaten.add(k);
  checkpoints.length = 0; checkpoints.push(...d.cps); lastCheckpoint = checkpoints[checkpoints.length - 1] || checkpoints[0];
  P.fed = d.fed; dayClock = d.clock; P.pos.set(...d.pos); P.yaw = d.yaw; becomeSpecies(speciesById[d.sp] || speciesById.cownose);
  camPos.copy(P.pos).add(new THREE.Vector3(0, 1.5, 6));
}
