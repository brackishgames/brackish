// Saves: signed so an edited save is refused (a client-only game can't be cheat-proof; this stops casual edits),
// versioned so an old save is carried forward instead of thrown away.
export const SAVE_VERSION = 2;
export async function sha256(text) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function sealSave(data, salt) { const json = JSON.stringify(data); return JSON.stringify({ json, sig: await sha256(salt + json) }); }
export async function openSave(raw, salt) {
  if (!raw) return null; const { json, sig } = JSON.parse(raw);
  if (sig !== await sha256(salt + json)) throw new Error('signature mismatch');
  return migrateSave(JSON.parse(json));
}
// each step takes a save from version n to n + 1
const MIGRATIONS = {
  1: d => ({ ...d, v: 2, hp: 3, sta: 1 }),   // v2 keeps your hearts and burst across a reload
};
export function migrateSave(d) {
  if (!d || typeof d.v !== 'number' || d.v > SAVE_VERSION) return null;
  while (d.v < SAVE_VERSION) { const step = MIGRATIONS[d.v]; if (!step) return null; d = step(d); }
  return d;
}
