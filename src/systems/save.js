import { SAVE_VERSION, openSave, sealSave } from '../lib/save.js?v=__BUILD__';
import { DEV, TEST } from '../core/env.js?v=__BUILD__';
import { TUNE } from '../core/tune.js?v=__BUILD__';
import { day } from '../world/time.js?v=__BUILD__';
import { speciesById } from '../actors/creatures.js?v=__BUILD__';
import { fever } from '../actors/fever.js?v=__BUILD__';
import { eaten } from '../actors/life.js?v=__BUILD__';
import { P, becomeSpecies, unlocked } from '../actors/player.js?v=__BUILD__';
import { CHAPTERS, started, story } from './story.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  SAVE  —  progress in localStorage, signed so an edited save is refused.
//  (A client-only game can never be fully cheat-proof; this stops casual edits.)
// ═══════════════════════════════════════════════════════════════════
export const SAVE_KEY = 'brackish.save', SAVE_SALT = 'egmont-25m-' + location.host;
export let saveTimer = 0, loadedSave = null, lastSaved = -1e9;
export function stepAutosave(dt) { saveTimer += dt; if (saveTimer > TUNE.timing.autosave) { saveTimer = 0; saveGame(); } }   // world time: a pause doesn't save
export async function loadSaved() { loadedSave = await loadGame(); if (loadedSave) loadedSave.ch = Math.min(loadedSave.ch, CHAPTERS.length - 2); }   // older saves can point past the last chapter
export async function saveGame() {
  if (!started || DEV || TEST) return;   // dev and test runs never overwrite a real save
  lastSaved = performance.now();
  const data = { v: SAVE_VERSION, ch: story.ch, hp: P.hp, sta: P.sta ?? 1, unlocked: [...unlocked], cps: checkpoints, fed: P.fed || 0, eaten: [...eaten].slice(-400), clock: day.hour, pos: [P.pos.x, P.pos.y, P.pos.z], yaw: P.yaw, sp: P.sp.id, fever: { seg: fever.seg, t: fever.t, moving: fever.moving, x: fever.c.x, z: fever.c.z }, t: Date.now() };
  try { localStorage.setItem(SAVE_KEY, await sealSave(data, SAVE_SALT)); } catch {}
}
export async function loadGame() {
  if (TEST) return null;
  try { return await openSave(localStorage.getItem(SAVE_KEY), SAVE_SALT); }   // an older save is carried forward (src/lib/save.js)
  catch (e) { console.warn('save rejected:', e.message); try { localStorage.removeItem(SAVE_KEY); } catch {} return null; }
}
export function applySave(d) {
  for (const id of d.unlocked) unlocked.add(id); for (const k of d.eaten || []) eaten.add(k);
  restoreCheckpoints(d.cps);
  P.fed = d.fed; P.hp = d.hp ?? 3; P.sta = d.sta ?? 1; day.hour = d.clock; P.pos.set(...d.pos); P.yaw = d.yaw; becomeSpecies(speciesById[d.sp] || speciesById.cownose);
  if (d.fever) { fever.seg = d.fever.seg; fever.t = d.fever.t; fever.moving = d.fever.moving; fever.c.x = d.fever.x; fever.c.z = d.fever.z; }   /* the fever is where you left it */
  cameraBehind();
}
