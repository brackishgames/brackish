import * as THREE from 'three';
import { MOBILE } from '../core/env.js?v=__BUILD__';
import { between, rand } from '../core/random.js?v=__BUILD__';
import { _f, fwdInto, fwdOf, orient } from '../core/space.js?v=__BUILD__';
import { TUNE } from '../core/tune.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { emitBubble } from '../render/effects.js?v=__BUILD__';
import { strouhalRad } from '../render/materials.js?v=__BUILD__';
import { floorAt, spotNear } from '../world/geo.js?v=__BUILD__';
import { day } from '../world/time.js?v=__BUILD__';
import { creatureMesh, speciesById } from './creatures.js?v=__BUILD__';
import { fever, feverR } from './fever.js?v=__BUILD__';
import { P, hurt } from './player.js?v=__BUILD__';
import { caption, click, thud, whump } from '../systems/audio.js?v=__BUILD__';
import { kn, rumble, sprinting } from '../systems/input.js?v=__BUILD__';
import { started, story } from '../systems/story.js?v=__BUILD__';
import { say, tip } from '../ui/hud.js?v=__BUILD__';
import { camPos, simTime } from '../app/frame.js?v=__BUILD__';
// The wild animals: who you meet where, what they make of you, sharks that hunt, shapes that pass, and the echo's thing.
export const WILD_N = 46, wild = [];
// how often you meet each animal here, shallow vs deep: rays are everywhere in summer, dolphins come and go, manatees keep to the
// shallows, bull sharks work the estuary, a hammerhead is rare. predators wait until chapter III. a dolphin draws its pod.
export const WILD_ACTIVE = MOBILE ? 8 : 14;
export const MEET = { cownose: [6, 2], dolphin: [1.2, 1.6], manatee: [1, 0], bull: [0.5, 0.8], hammer: [0, 0.35] };
export function pickSpecies(deep) {
  const w = Object.entries(MEET).map(([id, [sh, dp]]) => [id, (PREDATORS.has(id) && story.ch < 2 ? 0 : deep ? dp : sh) * (id === 'dolphin' && P.sp?.id === 'dolphin' ? 4 : 1)]);
  let r = rand() * w.reduce((a, [, v]) => a + v, 0); for (const [id, v] of w) { r -= v; if (r <= 0) return speciesById[id]; }
  return speciesById.cownose;
}
export function setWild(w, sp, x, y, z) {   // put a wild slot into the water as this species, here
  if (w.mesh) w.mesh.visible = false;
  w.mesh = w.meshes[sp.id] ??= (() => { const m = creatureMesh(sp, PREDATORS.has(sp.id) ? 0.68 : 0.95); scene.add(m); return m; })();
  w.mesh.visible = true; w.sp = sp; w.pos.set(x, y, z); w.yaw = rand() * 6.28; w.pitch = 0; w.turn = 0; w.ph = rand() * 6;
  w.hunting = false; w.interest = 0; w.warned = false; w.feverPass = 0; w.cool = 0; w.air = false; w.partner = false; w.passing = false; w.passedClose = false;
}
export function spawnWild(w, first = false) {
  const spot = spotNear(P.pos, first ? 20 : 70, first ? 110 : 130, 2); if (!spot) return;
  { const { x, z, f } = spot;
    const sp = pickSpecies(f < -8);
    setWild(w, sp, x, Math.min(-1.2, f + 1.5 + rand() * Math.max(0.5, -f - 3)), z); return;
  }
}
for (let i = 0; i < WILD_N; i++) wild.push({ id: i, meshes: {}, mesh: null, sp: null, pos: new THREE.Vector3(), yaw: 0, pitch: 0, turn: 0, ph: 0 });
export function targetY(sp, f, t, ph) {
  switch (sp.zone) { case 'surface': return -1.0 - Math.max(0, Math.sin(t * 0.25 + ph)) * Math.min(6, -f - 2);
    case 'bottom': return f + sp.alt + 0.2; case 'structure': return f + 1 + sp.alt; case 'deep': return f * 0.5 - 1; default: return f * 0.45 - 1 + Math.sin(t * 0.2 + ph) * 1.2; }
}
export const PREDATORS = new Set(['bull', 'hammer']);
export const bodySize = sp => sp.span ?? sp.len;   // wingspan for a ray, length for everything else
export const isBig = sp => bodySize(sp) >= 2;
export function relation(w) {
  if (w.passing) return 'neutral';   // a shape crossing in the murk: it never hunts, so you never know which one will
  if (PREDATORS.has(w.sp.id) && !PREDATORS.has(P.sp.id) && !isBig(P.sp)) return 'hunt';
  if (!PREDATORS.has(w.sp.id) && !isBig(w.sp) && (PREDATORS.has(P.sp.id) || P.sp.id === 'dolphin')) return 'flee';
  if (w.sp.id === 'dolphin' && !PREDATORS.has(P.sp.id)) return 'curious';
  return 'neutral';
}
export function steerTo(w, tx, tz, rate) {
  const want = Math.atan2(-(tx - w.pos.x), -(tz - w.pos.z)); let d = want - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  w.turn = THREE.MathUtils.clamp(d * 2.5, -rate, rate);
}
export let huntHeat = 0;   // how hard the hunt is on you, 0..1, for the HUD
export let dread = 0;   // how close something is to taking an interest in you, 0..1: the sea goes quiet with it
export const shadow = { t: between(TUNE.shadow.first) };   // until something large crosses your path (an object, so a test can bring it forward)
// now and then, something big and dim crosses your path at the edge of what you can see, and turns away
export function spawnShadow() {
  const w = wild.find(o => o.id < WILD_ACTIVE && o.sp && !o.hunting && !o.partner && !o.passing && o.pos.distanceTo(P.pos) > 60); if (!w) return;
  const first = rand() < 0.5 ? -1 : 1, f = fwdOf(P.yaw, 0);
  for (const side of [first, -first]) {   // one side of you, or if that's too shallow for it, the other
    const x = P.pos.x + f.x * 30 + Math.cos(P.yaw) * side * 46, z = P.pos.z + f.z * 30 - Math.sin(P.yaw) * side * 46, fl = floorAt(x, z); if (fl > -4) continue;
    setWild(w, speciesById[fl < -9 ? 'hammer' : 'bull'], x, THREE.MathUtils.clamp(P.pos.y - 2.5, fl + 1.5, -1.5), z); w.yaw = P.yaw + side * Math.PI / 2; w.passing = true;   // across your path, from one side to the other
    return;
  }
}
// ── the wild animals, one step. each animal: is it here at all, what does it make of you, where is it going, then move it
export function stepWild(dt, t) {
  huntHeat = 0; dread = 0; let hunters = 0; for (const o of wild) if (o.hunting) hunters++;
  const frP = feverR(P.pos), floorP = floorAt(P.pos.x, P.pos.z);
  if (started && (shadow.t -= dt) <= 0) { shadow.t = between(TUNE.shadow.every); if (P.pos.y < -2.5 && !wild.some(o => o.hunting)) spawnShadow(); }
  const ctx = { hunters, fr: frP, pFloor: floorP };
  for (const w of wild) stepAnimal(w, dt, t, ctx);
}
export function stepAnimal(w, dt, t, ctx) {
  const d = animalLifecycle(w, dt); if (d === false) return;
  const rel = relation(w); if (rel === 'hunt') dread = Math.max(dread, w.hunting ? 1 : Math.min(1, (w.interest || 0) * 1.6));
  const c = { v: w.sp.cruise * (0.8 + 0.2 * Math.sin(t * 0.3 + w.ph)), ty: null };   // its course this step: a speed, and a depth (null: its own)
  stepInterest(w, rel, d, ctx, dt); huntCourse(w, rel, d, ctx, dt, c); chooseCourse(w, rel, d, t, dt, c);
  const f = moveAnimal(w, c, t, dt); separate(w, dt); poseAnimal(w, f, d, dt);
}
// is it here at all: quiet slots stay hidden, far ones respawn, a passing shape leaves once it has passed. its distance, or false
export function animalLifecycle(w, dt) {
  if (w.id >= WILD_ACTIVE) { if (w.mesh) w.mesh.visible = false; return false; }   // a quiet bay: only so many animals within sight at once
  if (!w.sp) { spawnWild(w, true); return false; }
  const d = w.pos.distanceTo(P.pos); if (d > 200) { if (w.partner) w.pos.copy(P.pos).add(_f.set(Math.cos(P.yaw) * 4, 0, -Math.sin(P.yaw) * 4)); else { spawnWild(w); return false; } }
  w.cool = Math.max(0, (w.cool || 0) - dt);
  if (w.passing) { if (d < 50) dread = Math.max(dread, 0.55 * (1 - d / 50)); if (!w.passedClose && d < 26) { w.passedClose = true; whump(w.pos.x, w.pos.z, 0.5); }   // you feel it more than you see it
    if (d > 95 && w.passedClose) { w.passing = false; spawnWild(w); return false; } }
  return d;
}
    // a shark picks the one it can single out: a ray alone, or one at the ragged edge of the fever. inside it, you are one of a thousand.
export function stepInterest(w, rel, d, { hunters, fr, pFloor }, dt) {
  const otherHunter = hunters > (w.hunting ? 1 : 0), hammer = w.sp.id === 'hammer';
  if (rel === 'hunt' && !w.hunting && started && d < 45 && w.cool <= 0 && !otherHunter && !(hammer && pFloor > -3)) {
    const dim = day.hour < 7.5 || day.hour > 18;   // they hunt the low light
    const rate = fr < 0.85 ? -0.3 : (fr < 1.2 ? 0.22 : 0.14) * (P.speed > P.sp.cruise * 1.2 ? 1.8 : 1) * (P.hp < 3 ? 1.5 : 1) * (dim ? 1.3 : 1);   // panic and blood draw it in
    w.interest = THREE.MathUtils.clamp((w.interest || 0) + rate * dt, 0, 1);
    if (w.interest > 0.45 && !w.warned) { w.warned = true; say('something large is keeping pace below you', 2.5); tip('burst', () => `${kn('burst')} bursts. a hard turn inside its lunge makes it miss. lose it in the fever, or far away.`); }
  } else if (!w.hunting) { w.interest = Math.max(0, (w.interest || 0) - 0.05 * dt); if (w.interest < 0.2) w.warned = false; }
}
      // the fight: come up from behind and below, telegraph a side, lunge. a hard turn or a burst inside the lunge makes it miss.
export function huntCourse(w, rel, d, { hunters, fr, pFloor }, dt, c) {
  const otherHunter = hunters > (w.hunting ? 1 : 0), hammer = w.sp.id === 'hammer';
  if (!(w.hunting || (rel === 'hunt' && d < 45 && w.cool <= 0 && started && w.interest >= 1 && !otherHunter))) { w.hunting = false; return; }
  if (!w.hunting) { w.hunting = true; w.huntT = 0; w.misses = 0; w.bumped = false; w.track = 1; w.seen = P.pos.clone(); w.lunge = { phase: 'stalk', t: 0, side: rand() < 0.5 ? -1 : 1 };
    say(hammer ? `${w.sp.name.toUpperCase()}\nit hunts rays along the bottom. stay off the sand, or get to the shallows.` : `${w.sp.name.toUpperCase()}\nit has you alone. get back into the fever, or out-turn it.`, 3.5); }
  w.huntT += dt; const L = w.lunge; L.t += dt;
  const lose = why => { w.hunting = false; w.cool = 30; w.interest = 0; w.warned = false; if (why) say(why, 2.5); };
  // once it is on you it stays on you, like the law: you have to break contact long enough for it to lose you
  const why = rel !== 'hunt' || d > 120 ? 'gone' : fr < 0.85 ? 'fever' : hammer && pFloor > -3 ? 'shallow' : d > 28 ? 'far' : '';
  if (!why) { w.track = Math.min(1, w.track + 0.5 * dt); w.seen.copy(P.pos); } else w.track -= dt / (why === 'fever' ? 2 : 6);   // among a thousand others it can't hold on to you
  if (why === 'gone') lose('');
  else if (w.track <= 0) { lose({ fever: 'it loses you among a thousand others', shallow: 'it will not follow you into the shallows', far: 'you lost it' }[why]); if (why === 'fever') w.feverPass = 6; }
  if (w.hunting) huntHeat = Math.max(huntHeat, w.track);
  if (!w.hunting) { /* it let go of you this step: nothing more to do */ }
  else if (why) { steerTo(w, w.seen.x, w.seen.z, 2); c.v = w.sp.max * (why === 'far' ? 0.85 : 0.6); c.ty = w.seen.y; L.phase = 'stalk'; L.t = 0; }   // searching where it last had you
  else if (L.phase === 'stalk') { const f = fwdOf(P.yaw); steerTo(w, P.pos.x - f.x * 6 + Math.cos(P.yaw) * L.side * 5, P.pos.z - f.z * 6 - Math.sin(P.yaw) * L.side * 5, 2.2); c.v = w.sp.max * 0.7; c.ty = P.pos.y - 2;   // out of sight, behind and under
    if (L.t > 1.8 && d < 12) { L.phase = 'wind'; L.t = 0; } }
  else if (L.phase === 'wind') { if (!hammer && !w.bumped && d < 4) { w.bumped = true; P.shake = Math.max(P.shake || 0, 0.35); rumble(0.5, 0.2, 180); thud(0.3); say('it bumps you. it is testing.', 1.8); }   // a bull shark tastes before it commits
    steerTo(w, P.pos.x + Math.cos(P.yaw) * L.side * 6, P.pos.z - Math.sin(P.yaw) * L.side * 6, 2.5); c.v = w.sp.cruise * 0.6; c.ty = P.pos.y;
    if (L.t > 1.0) { L.phase = 'lunge'; L.t = 0; whump(w.pos.x, w.pos.z); L.tx = P.pos.x + P.vel.x * 0.5; L.tz = P.pos.z + P.vel.z * 0.5; L.dodged = false; } }
  else if (L.phase === 'lunge') { steerTo(w, L.tx, L.tz, 1.2); c.v = w.sp.max; c.ty = P.pos.y;
    const pinned = hammer && P.pos.y - pFloor < 2;   // a hammerhead pins a ray to the sand with its head; only getting off the bottom helps
    if (pinned ? P.vel.y > 1 : (Math.abs(P.yawRate) > 0.9 || (sprinting() && P.sta > 0 && !P.spent))) L.dodged = true;
    if (L.t > 0.25 && d < 2.6 && !L.dodged && P.stun <= 0) { hurt(0.8, pinned ? `${w.sp.name.toUpperCase()}\npinned to the sand. rise.` : `${w.sp.name.toUpperCase()}\nbitten. it will circle back.`); L.phase = 'recover'; L.t = 0; }
    if (L.t > 0.7) { L.phase = 'recover'; L.t = 0; if (L.dodged) { w.misses++; say('missed. it is still on you', 1.2); } } }
  else { steerTo(w, 2 * w.pos.x - P.pos.x, 2 * w.pos.z - P.pos.z, 2); c.v = w.sp.max * 0.8; c.ty = P.pos.y - 1;
    if (L.t > 1.6) { L.phase = 'stalk'; L.t = 0; L.side = rand() < 0.5 ? -1 : 1; } }
}
// everything else it might be doing, nearest concern first: a passing shape, your companion, crossing the fever, fleeing, curiosity, wandering
export function chooseCourse(w, rel, d, t, dt, c) {
  if (!(rel === 'curious' && d < 70 && w.cool <= 0)) w.hd = null;   // its sense of your heading starts fresh each time it comes back
  if (w.passing) {   /* the shape: slow, level, a little below you; if it comes close it bends away */
    if (d < 20) steerTo(w, 2 * w.pos.x - P.pos.x, 2 * w.pos.z - P.pos.z, 0.6); else w.turn *= 1 - Math.min(1, dt);
    c.v = w.sp.cruise * 0.75; c.ty = THREE.MathUtils.clamp(P.pos.y - 2.5, -60, -1.5); }
  else if (w.partner) {   /* a companion from the pod: a body length off your side, matching your pace and depth */
    const fw = fwdOf(P.yaw, 0), sx = P.pos.x + fw.x * 0.5 + Math.cos(P.yaw) * 4, sz = P.pos.z + fw.z * 0.5 - Math.sin(P.yaw) * 4; steerTo(w, sx, sz, w.sp.turn * 1.5);
    const ahead = (sx - w.pos.x) * -Math.sin(w.yaw) + (sz - w.pos.z) * -Math.cos(w.yaw); c.v = THREE.MathUtils.clamp(P.speed + ahead * 0.6, 0.5, w.sp.max); c.ty = Math.min(P.pos.y, -0.6); }
  else if (w.feverPass > 0 && !w.hunting) { w.feverPass -= dt; steerTo(w, fever.c.x, fever.c.z, 2); c.v = w.sp.max * 0.8; c.ty = fever.c.y; }   // through the fever, scattering it
  else if (rel === 'flee' && d < 30) {
    steerTo(w, 2 * w.pos.x - P.pos.x, 2 * w.pos.z - P.pos.z, 3); c.v = w.sp.max;
  } else if (rel === 'curious' && d < 70 && w.cool <= 0) {
    w.curT = (w.curT || 0) + dt; if (w.curT > 40) { w.cool = 60; w.curT = 0; }
    const r1 = (w.ph * 7.31) % 1, r2 = (w.ph * 13.7) % 1, side = (w.ph > 3 ? 1 : -1) * (3.5 + r1 * 7) * (1 + 0.25 * Math.sin(t * 0.13 + w.ph)), ahead = 1 + r2 * 9 + 2 * Math.sin(t * 0.09 + w.ph * 2);
    // each one reads your heading for itself, a beat late, so a turn ripples through them instead of carrying them round
    w.hd ??= P.yaw; const hd = Math.atan2(Math.sin(P.yaw - w.hd), Math.cos(P.yaw - w.hd)); w.hd += hd * Math.min(1, (0.5 + r1 * 0.6) * dt);
    const f = fwdOf(w.hd, 0), sx = P.pos.x + f.x * ahead + Math.cos(w.hd) * side, sz = P.pos.z + f.z * ahead - Math.sin(w.hd) * side; steerTo(w, sx, sz, w.sp.turn);
    const along = (sx - w.pos.x) * -Math.sin(w.yaw) + (sz - w.pos.z) * -Math.cos(w.yaw);   // how far its place is ahead of it
    c.v = d > 8 ? w.sp.max * 0.7 : THREE.MathUtils.clamp(P.speed + along * 0.5, w.sp.cruise * 0.4, w.sp.max * 0.9); c.ty = P.pos.y + 0.5 + (((w.ph * 5.17) % 1) - 0.5) * 3;
    w.clickT = (w.clickT || 0) - dt; if (w.clickT <= 0 && d < 25) { w.clickT = 1.2 + rand() * 2.5; caption('click' + w.id, 'CLICKS', w.pos.x, w.pos.z, 1.2); for (let n = 0; n < 2 + rand() * 5; n++) click(d, n * 0.035); }
  } else {
    w.wT = (w.wT || 0) - dt; if (w.wT <= 0) { w.wT = 1.5 + rand() * 3; w.turnGoal = (rand() - 0.5) * 0.8; }
    w.turn += ((w.turnGoal || 0) - w.turn) * Math.min(1, 1.2 * dt);
    const dc = w.pos.distanceTo(camPos); if (dc < 5 + (w.sp.span ?? w.sp.len) * 1.2) { steerTo(w, 2 * w.pos.x - camPos.x, 2 * w.pos.z - camPos.z, 2.5); }   // nothing swims through the lens
    else if (w.sp.zone !== 'surface' && d < 6 && w.sp.len < 2) w.turn += 3 * dt;   // small things shy away
  }
}
// turn away from the shallows, find its depth, go. returns the bottom under it
export function moveAnimal(w, { v, ty }, t, dt) {
  fwdInto(_f, w.yaw).multiplyScalar(8).add(w.pos);
  if (floorAt(_f.x, _f.z) > -2.2) w.turn += 2.5 * dt;
  w.yaw += w.turn * dt;
  const f = floorAt(w.pos.x, w.pos.z); if (ty === null) ty = targetY(w.sp, f, t, w.ph);
  ty = THREE.MathUtils.clamp(ty, f + w.sp.alt, -0.6);
  const dy = ty - w.pos.y; w.pitch += (THREE.MathUtils.clamp(dy * 0.4, -0.5, 0.5) - w.pitch) * Math.min(1, 2 * dt);
  w.v = (w.v ?? v) + (v - (w.v ?? v)) * Math.min(1, 1.5 * dt); w.roll = (w.roll || 0) + (w.turn * 0.6 - (w.roll || 0)) * Math.min(1, 2 * dt);
  if (w.air) {   /* out of the water on a leap: gravity, nose along the arc, back in with a splash of bubbles */
    w.vy -= 9.8 * dt; w.pos.y += w.vy * dt; w.pitch = Math.atan2(w.vy, Math.max(0.5, w.v)); w.pos.addScaledVector(fwdInto(_f, w.yaw, 0), w.v * dt);
    if (w.pos.y < -0.3 && w.vy < 0) { w.air = false; for (let i = 0; i < 14; i++) emitBubble(w.pos.x + (rand() - .5) * 2, -0.2 - rand(), w.pos.z + (rand() - .5) * 2); } }
  else w.pos.addScaledVector(fwdInto(_f, w.yaw, w.pitch), w.v * dt);
  return f;
}
// nobody swims through anybody, and nothing swims through you (unless it means to)
export function pushApart(w, ox, oy, oz, need, dt) {
  const dx = w.pos.x - ox, dy = w.pos.y - oy, dz = w.pos.z - oz, dd = Math.hypot(dx, dy, dz);
  if (dd < need && dd > 1e-3) { const k = (need - dd) / dd * Math.min(1, 3 * dt); w.pos.x += dx * k; w.pos.y += dy * k * 0.6; w.pos.z += dz * k; }
}
export function separate(w, dt) {
  for (const o of wild) if (o !== w && o.sp) pushApart(w, o.pos.x, o.pos.y, o.pos.z, (bodySize(w.sp) + bodySize(o.sp)) * 0.7, dt);
  if (!w.hunting) pushApart(w, P.pos.x, P.pos.y, P.pos.z, (bodySize(w.sp) + bodySize(P.sp)) * 0.75, dt);
}
// the body where it is, how it is turned, how hard it is working, and how lit (the sense or echo lights it up)
export function poseAnimal(w, f, d, dt) {
  w.pos.y = THREE.MathUtils.clamp(w.pos.y, f + w.sp.alt, w.air ? 8 : -0.5);
  w.mesh.position.copy(w.pos); orient(w.mesh, w.yaw, w.pitch, w.roll);
  { const u = w.mesh.material.uniforms, work = Math.min(1, w.v / w.sp.max); w.mesh.userData.baseGlow ??= u.uGlow.value; u.uGlow.value = w.mesh.userData.baseGlow * (w.passing ? 0.5 : 1) * (1 + 0.9 * (P.reveal || 0) * (d < (P.revealRange || 50) ? 1 : 0)); u.uFlap.value += ((w.sp.kind === 'ray' ? 0.35 + 0.65 * work : 0.6 + 0.4 * work) - u.uFlap.value) * Math.min(1, 2 * dt);
    const target = w.sp.kind === 'ray' ? strouhalRad(w.sp, w.v, u.uFlap.value) : w.sp.freq * (0.55 + 0.9 * work); u.uFreq.value += (target - u.uFreq.value) * Math.min(1, 2 * dt); }
}


// once in a long while, deep, the echo comes back off something bigger than anything here. it shows for a moment and nothing is said
export const THING = { id: 'thing', kind: 'fish', len: 17, fat: 0.15, round: 0.6, dorsal: 0.5, pect: 1.5, fluke: 'shark', cruise: 0.8, max: 1, freq: 0.5, amp: 0.05 };
export const thing = { mesh: null, t: 0, next: 120 };
export function echoThing() {
  const now = simTime, f = floorAt(P.pos.x, P.pos.z); if (now < thing.next || f > -TUNE.thing.floor || P.pos.y > -5 || rand() > TUNE.thing.chance) return;
  thing.next = now + between(TUNE.thing.every);
  thing.mesh ??= (() => { const m = creatureMesh(THING, 0.5); scene.add(m); return m; })();
  const side = rand() < 0.5 ? -1 : 1, fw = fwdOf(P.yaw, 0), x = P.pos.x + fw.x * 46 + Math.cos(P.yaw) * side * 14, z = P.pos.z + fw.z * 46 - Math.sin(P.yaw) * side * 14;
  thing.mesh.position.set(x, THREE.MathUtils.clamp(P.pos.y - 3, floorAt(x, z) + 4, -3), z); orient(thing.mesh, P.yaw + side * Math.PI / 2, 0, 0); thing.t = 0.7; thing.mesh.visible = true;
}
export function stepThing(dt) {
  if (!thing.mesh || !thing.mesh.visible) return; thing.t -= dt; if (thing.t <= 0) { thing.mesh.visible = false; return; }
  thing.mesh.position.addScaledVector(fwdOf(thing.mesh.rotation.y, 0), 1.2 * dt); thing.mesh.material.uniforms.uGlow.value = 0.6 * Math.min(1, thing.t / 0.3);
}
