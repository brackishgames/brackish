'use strict';
// ═══════════════════════════════════════════════════════════════════
//  WILDLIFE  —  the player's body, wild animals that loom out of the
//  murk, mullet schools, pelicans and gulls, and the fever of rays.
// ═══════════════════════════════════════════════════════════════════
const unlocked = new Set();
const P = { pos: new THREE.Vector3(START[0], -4, START[1]), yaw: Math.PI, pitch: 0, roll: 0, speed: 1.3, yawRate: 0, sp: speciesById.cownose, mesh: null, hp: 3, stun: 0, air: 0 };
const playerMeshes = {};
function becomeSpecies(sp) {
  P.air = 1;
  if (P.mesh) P.mesh.visible = false;
  if (!playerMeshes[sp.id]) { playerMeshes[sp.id] = creatureMesh(sp, 1.3); scene.add(playerMeshes[sp.id]); }
  P.mesh = playerMeshes[sp.id]; P.mesh.visible = true; P.sp = sp; P.speed = sp.cruise; unlocked.add(sp.id);
}

const WILD_N = 46, wild = [];
// how often you meet each animal here, shallow vs deep: rays are everywhere in summer, dolphins come and go, manatees keep to the
// shallows, bull sharks work the estuary, a hammerhead is rare. predators wait until chapter III. a dolphin draws its pod.
const WILD_ACTIVE = MOBILE ? 8 : 14;
const MEET = { cownose: [6, 2], dolphin: [1.2, 1.6], manatee: [1, 0], bull: [0.5, 0.8], hammer: [0, 0.35] };
function pickSpecies(deep) {
  const w = Object.entries(MEET).map(([id, [sh, dp]]) => [id, (PREDATORS.has(id) && story.ch < 2 ? 0 : deep ? dp : sh) * (id === 'dolphin' && P.sp?.id === 'dolphin' ? 4 : 1)]);
  let r = rand() * w.reduce((a, [, v]) => a + v, 0); for (const [id, v] of w) { r -= v; if (r <= 0) return speciesById[id]; }
  return speciesById.cownose;
}
function setWild(w, sp, x, y, z) {   // put a wild slot into the water as this species, here
  if (w.mesh) w.mesh.visible = false;
  w.mesh = w.meshes[sp.id] ??= (() => { const m = creatureMesh(sp, PREDATORS.has(sp.id) ? 0.68 : 0.95); scene.add(m); return m; })();
  w.mesh.visible = true; w.sp = sp; w.pos.set(x, y, z); w.yaw = rand() * 6.28; w.pitch = 0; w.turn = 0; w.ph = rand() * 6;
  w.hunting = false; w.interest = 0; w.warned = false; w.feverPass = 0; w.cool = 0; w.air = false; w.partner = false; w.passing = false; w.passedClose = false;
}
function spawnWild(w, first = false) {
  const spot = spotNear(P.pos, first ? 20 : 70, first ? 110 : 130, 2); if (!spot) return;
  { const { x, z, f } = spot;
    const sp = pickSpecies(f < -8);
    setWild(w, sp, x, Math.min(-1.2, f + 1.5 + rand() * Math.max(0.5, -f - 3)), z); return;
  }
}
for (let i = 0; i < WILD_N; i++) wild.push({ id: i, meshes: {}, mesh: null, sp: null, pos: new THREE.Vector3(), yaw: 0, pitch: 0, turn: 0, ph: 0 });
function targetY(sp, f, t, ph) {
  switch (sp.zone) { case 'surface': return -1.0 - Math.max(0, Math.sin(t * 0.25 + ph)) * Math.min(6, -f - 2);
    case 'bottom': return f + sp.alt + 0.2; case 'structure': return f + 1 + sp.alt; case 'deep': return f * 0.5 - 1; default: return f * 0.45 - 1 + Math.sin(t * 0.2 + ph) * 1.2; }
}
const PREDATORS = new Set(['bull', 'hammer']);
const bodySize = sp => sp.span ?? sp.len;   // wingspan for a ray, length for everything else
const isBig = sp => bodySize(sp) >= 2;
function relation(w) {
  if (w.passing) return 'neutral';   // a shape crossing in the murk: it never hunts, so you never know which one will
  if (PREDATORS.has(w.sp.id) && !PREDATORS.has(P.sp.id) && !isBig(P.sp)) return 'hunt';
  if (!PREDATORS.has(w.sp.id) && !isBig(w.sp) && (PREDATORS.has(P.sp.id) || P.sp.id === 'dolphin')) return 'flee';
  if (w.sp.id === 'dolphin' && !PREDATORS.has(P.sp.id)) return 'curious';
  return 'neutral';
}
function steerTo(w, tx, tz, rate) {
  const want = Math.atan2(-(tx - w.pos.x), -(tz - w.pos.z)); let d = want - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  w.turn = THREE.MathUtils.clamp(d * 2.5, -rate, rate);
}
let huntHeat = 0;   // how hard the hunt is on you, 0..1, for the HUD
let dread = 0, shadowT = between(TUNE.shadow.first);
// now and then, something big and dim crosses your path at the edge of what you can see, and turns away
function spawnShadow() {
  const w = wild.find(o => o.id < WILD_ACTIVE && o.sp && !o.hunting && !o.partner && !o.passing && o.pos.distanceTo(P.pos) > 60); if (!w) return;
  const side = rand() < 0.5 ? -1 : 1, f = fwdOf(P.yaw, 0), x = P.pos.x + f.x * 30 + Math.cos(P.yaw) * side * 46, z = P.pos.z + f.z * 30 - Math.sin(P.yaw) * side * 46, fl = floorAt(x, z);
  if (fl > -4) return;
  setWild(w, speciesById[fl < -9 ? 'hammer' : 'bull'], x, THREE.MathUtils.clamp(P.pos.y - 2.5, fl + 1.5, -1.5), z); w.yaw = P.yaw + side * Math.PI / 2; w.passing = true;   // across your path, from one side to the other
}   // how close something is to taking an interest in you, 0..1: the sea goes quiet with it
// ── the wild animals, one step. each animal: is it here at all, what does it make of you, where is it going, then move it
function stepWild(dt, t) {
  huntHeat = 0; dread = 0; let hunters = 0; for (const o of wild) if (o.hunting) hunters++;
  const frP = feverR(P.pos), floorP = floorAt(P.pos.x, P.pos.z);
  if (started && (shadowT -= dt) <= 0) { shadowT = between(TUNE.shadow.every); if (P.pos.y < -2.5 && !wild.some(o => o.hunting)) spawnShadow(); }
  const ctx = { hunters, fr: frP, pFloor: floorP };
  for (const w of wild) stepAnimal(w, dt, t, ctx);
}
function stepAnimal(w, dt, t, ctx) {
  const d = animalLifecycle(w, dt); if (d === false) return;
  const rel = relation(w); if (rel === 'hunt') dread = Math.max(dread, w.hunting ? 1 : Math.min(1, (w.interest || 0) * 1.6));
  const c = { v: w.sp.cruise * (0.8 + 0.2 * Math.sin(t * 0.3 + w.ph)), ty: null };   // its course this step: a speed, and a depth (null: its own)
  stepInterest(w, rel, d, ctx, dt); huntCourse(w, rel, d, ctx, dt, c); chooseCourse(w, rel, d, t, dt, c);
  const f = moveAnimal(w, c, t, dt); separate(w, dt); poseAnimal(w, f, d, dt);
}
// is it here at all: quiet slots stay hidden, far ones respawn, a passing shape leaves once it has passed. its distance, or false
function animalLifecycle(w, dt) {
  if (w.id >= WILD_ACTIVE) { if (w.mesh) w.mesh.visible = false; return false; }   // a quiet bay: only so many animals within sight at once
  if (!w.sp) { spawnWild(w, true); return false; }
  const d = w.pos.distanceTo(P.pos); if (d > 200) { if (w.partner) w.pos.copy(P.pos).add(_f.set(Math.cos(P.yaw) * 4, 0, -Math.sin(P.yaw) * 4)); else { spawnWild(w); return false; } }
  w.cool = Math.max(0, (w.cool || 0) - dt);
  if (w.passing) { if (d < 50) dread = Math.max(dread, 0.55 * (1 - d / 50)); if (!w.passedClose && d < 26) { w.passedClose = true; whump(w.pos.x, w.pos.z, 0.5); }   // you feel it more than you see it
    if (d > 95 && w.passedClose) { w.passing = false; spawnWild(w); return false; } }
  return d;
}
    // a shark picks the one it can single out: a ray alone, or one at the ragged edge of the fever. inside it, you are one of a thousand.
function stepInterest(w, rel, d, { hunters, fr, pFloor }, dt) {
  const otherHunter = hunters > (w.hunting ? 1 : 0), hammer = w.sp.id === 'hammer';
  if (rel === 'hunt' && !w.hunting && started && d < 45 && w.cool <= 0 && !otherHunter && !(hammer && pFloor > -3)) {
    const dim = day.hour < 7.5 || day.hour > 18;   // they hunt the low light
    const rate = fr < 0.85 ? -0.3 : (fr < 1.2 ? 0.22 : 0.14) * (P.speed > P.sp.cruise * 1.2 ? 1.8 : 1) * (P.hp < 3 ? 1.5 : 1) * (dim ? 1.3 : 1);   // panic and blood draw it in
    w.interest = THREE.MathUtils.clamp((w.interest || 0) + rate * dt, 0, 1);
    if (w.interest > 0.45 && !w.warned) { w.warned = true; say('something large is keeping pace below you', 2.5); tip('burst', () => `${kn('burst')} bursts. a hard turn inside its lunge makes it miss. lose it in the fever, or far away.`); }
  } else if (!w.hunting) { w.interest = Math.max(0, (w.interest || 0) - 0.05 * dt); if (w.interest < 0.2) w.warned = false; }
}
      // the fight: come up from behind and below, telegraph a side, lunge. a hard turn or a burst inside the lunge makes it miss.
function huntCourse(w, rel, d, { hunters, fr, pFloor }, dt, c) {
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
function chooseCourse(w, rel, d, t, dt, c) {
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
function moveAnimal(w, { v, ty }, t, dt) {
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
function pushApart(w, ox, oy, oz, need, dt) {
  const dx = w.pos.x - ox, dy = w.pos.y - oy, dz = w.pos.z - oz, dd = Math.hypot(dx, dy, dz);
  if (dd < need && dd > 1e-3) { const k = (need - dd) / dd * Math.min(1, 3 * dt); w.pos.x += dx * k; w.pos.y += dy * k * 0.6; w.pos.z += dz * k; }
}
function separate(w, dt) {
  for (const o of wild) if (o !== w && o.sp) pushApart(w, o.pos.x, o.pos.y, o.pos.z, (bodySize(w.sp) + bodySize(o.sp)) * 0.7, dt);
  if (!w.hunting) pushApart(w, P.pos.x, P.pos.y, P.pos.z, (bodySize(w.sp) + bodySize(P.sp)) * 0.75, dt);
}
// the body where it is, how it is turned, how hard it is working, and how lit (the sense or echo lights it up)
function poseAnimal(w, f, d, dt) {
  w.pos.y = THREE.MathUtils.clamp(w.pos.y, f + w.sp.alt, w.air ? 8 : -0.5);
  w.mesh.position.copy(w.pos); orient(w.mesh, w.yaw, w.pitch, w.roll);
  { const u = w.mesh.material.uniforms, work = Math.min(1, w.v / w.sp.max); w.mesh.userData.baseGlow ??= u.uGlow.value; u.uGlow.value = w.mesh.userData.baseGlow * (w.passing ? 0.5 : 1) * (1 + 0.9 * (P.reveal || 0) * (d < (P.revealRange || 50) ? 1 : 0)); u.uFlap.value += ((w.sp.kind === 'ray' ? 0.35 + 0.65 * work : 0.6 + 0.4 * work) - u.uFlap.value) * Math.min(1, 2 * dt);
    const target = w.sp.kind === 'ray' ? strouhalRad(w.sp, w.v, u.uFlap.value) : w.sp.freq * (0.55 + 0.9 * work); u.uFreq.value += (target - u.uFreq.value) * Math.min(1, 2 * dt); }
}

// moon jellies: slow, pulsing, harmless, lovely in the dark
function jellyGeometry() {
  const bell = new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.6, 1);
  const parts = [bell];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; parts.push(new THREE.PlaneGeometry(0.02, 0.5).translate(0, -0.26, 0).rotateY(a).translate(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12)); }
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false);
}
const JELLIES = 36;
const jellyMesh = new THREE.InstancedMesh(jellyGeometry(), creatureMat({ mode: 5, freq: 1.4, glow: 0.85 }), JELLIES);
{ const ph = new Float32Array(JELLIES); for (let i = 0; i < JELLIES; i++) ph[i] = rand() * 6.28; jellyMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); }
jellyMesh.frustumCulled = false; scene.add(jellyMesh);
const jellies = Array.from({ length: JELLIES }, () => ({ p: new THREE.Vector3(), ph: rand() * 6.28, s: 0.6 + rand() * 1.2 }));
function stepJellies(dt, t) {
  for (let i = 0; i < JELLIES; i++) { const j = jellies[i];
    if (j.p.lengthSq() === 0 || j.p.distanceTo(P.pos) > 130) { const sp = spotNear(P.pos, 20, 110, 3); if (!sp) { placeInstance(jellyMesh, i, 0, 9999, 0); continue; } j.p.set(sp.x, sp.f * (0.3 + rand() * 0.5), sp.z); }
    const f = floorAt(j.p.x, j.p.z);
    j.p.y = THREE.MathUtils.clamp(j.p.y + Math.sin(t * 0.3 + j.ph) * 0.08 * dt + 0.02 * dt, f + 1, -1.5); j.p.x += Math.sin(t * 0.1 + j.ph) * 0.05 * dt; j.p.z += Math.cos(t * 0.13 + j.ph) * 0.05 * dt;
    placeInstance(jellyMesh, i, j.p.x, j.p.y, j.p.z, Math.sin(t * 0.4 + j.ph) * 0.2, j.ph, Math.cos(t * 0.3 + j.ph) * 0.2, j.s); }
  jellyMesh.instanceMatrix.needsUpdate = true;
}

// food: clam beds on the bottom give a heart back, shrimp clouds in mid-water refill the burst.
// they sit in fixed places (hashed by 60 m cell) so you can learn where they are; eaten ones stay eaten.
const FOOD_MAX = 60, eaten = new Set();
const foodMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.18, 1), creatureMat({ glow: 1.4 }), FOOD_MAX);
foodMesh.frustumCulled = false; foodMesh.count = 0; scene.add(foodMesh);
let foodList = [], foodCenter = new THREE.Vector2(1e9, 1e9);
function rebuildFood() {
  foodList = []; const C = 60, R = 240, cx = Math.floor(P.pos.x / C), cz = Math.floor(P.pos.z / C);
  for (let gz = cz - R / C; gz <= cz + R / C; gz++) for (let gx = cx - R / C; gx <= cx + R / C; gx++) {
    const h = hash2(gx * 31 + 11, gz * 17 + 5); if (h > 0.5) continue; const key = gx + ',' + gz; if (eaten.has(key)) continue;
    const x = (gx + 0.2 + hash2(gx, gz) * 0.6) * C, z = (gz + 0.2 + hash2(gz, gx) * 0.6) * C, f = floorAt(x, z); if (f > -1.5) continue;
    const clam = h < 0.3; foodList.push({ key, x, z, y: clam ? f + 0.25 : Math.max(f + 2, f * 0.5), clam, ph: h * 40 });
  }
  foodCenter.set(P.pos.x, P.pos.z);
}
function stepFood(dt, t) {
  if (foodCenter.distanceTo(_xz.set(P.pos.x, P.pos.z)) > 90) rebuildFood();
  let k = 0;
  for (const fd of foodList) {
    if (k >= FOOD_MAX) break;
    const d = Math.hypot(fd.x - P.pos.x, fd.y - P.pos.y, fd.z - P.pos.z);
    if (started && d < 1.4) { eaten.add(fd.key); if (fd.clam) { P.hp = Math.min(HP_MAX, P.hp + 1); say(P.hp > 3 ? '♥  clams · well fed' : '♥  clams', 1.5); } else { P.sta = 1; P.spent = false; say('▮▮▮▮▮▮▮▮  shrimp', 1.5); }
      for (let i = 0; i < 3; i++) bloop(0.6, i * 0.09); rebuildFood(); break; }
    const pulse = 1 + 0.25 * Math.sin(t * 3 + fd.ph);
    if (fd.clam && d < 14 && (ABILITY[P.sp.id] === 'sense' || ABILITY[P.sp.id] === 'echo') && started) tip('sense', () => `${kn('ability')} ${abilityName().toLowerCase()}s the sand. buried clams give a heart back.`);
    if (fd.clam) { const vis = Math.max(THREE.MathUtils.clamp(1 - (d - 2) / 2, 0, 1), d < (P.revealRange || 50) * 0.3 ? (P.reveal || 0) : 0);   // buried: felt through the sand, not seen
      if (vis > 0.03) for (let i = 0; i < 3 && k < FOOD_MAX; i++) placeInstance(foodMesh, k++, fd.x + Math.cos(fd.ph + i * 2.1) * 0.35, fd.y, fd.z + Math.sin(fd.ph + i * 2.1) * 0.35, 0, fd.ph, 0, 0.7 * pulse * vis, 0.45 * pulse * vis, 0.7 * pulse * vis); }
    else { for (let i = 0; i < 5 && k < FOOD_MAX; i++) { const a = t * 1.5 + fd.ph + i * 1.26; placeInstance(foodMesh, k++, fd.x + Math.cos(a) * 0.5, fd.y + Math.sin(a * 1.7) * 0.3, fd.z + Math.sin(a) * 0.5, 0, 0, 0, 0.35 * pulse); } }
  }
  foodMesh.count = k; foodMesh.instanceMatrix.needsUpdate = true;
}

// mullet schools
const GONE = new THREE.Vector3(0.001, 0.001, 0.001);
function steerToSchool(s, tx, tz) { const want = Math.atan2(-(tx - s.c.x), -(tz - s.c.z)); let d = want - s.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); s.turn = THREE.MathUtils.clamp(d * 3, -2, 2); }
const fishGeo = new THREE.BufferGeometry();
fishGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.14, 0, 0.045, 0.02, 0, -0.045, 0.02, 0, 0, 0.11, 0, 0.055, 0.17, 0, -0.055, 0.17], 3));
fishGeo.setIndex([0, 1, 2, 1, 3, 2, 3, 4, 5]);
const SCHOOLS = 7, FISH_PER = 55;
const fishMesh = new THREE.InstancedMesh(fishGeo, creatureMat({ glow: 0.8 }), SCHOOLS * FISH_PER);
fishMesh.frustumCulled = false; scene.add(fishMesh);
const schools = Array.from({ length: SCHOOLS }, () => ({ c: new THREE.Vector3(), dir: rand() * 6.28, turn: 0, v: 0.6 + rand() * 0.6, spread: 2.5 + rand() * 3, base: 0, panic: 0,
  fish: Array.from({ length: FISH_PER }, () => ({ off: new THREE.Vector3(rand() - .5, (rand() - .5) * 0.5, rand() - .5), ph: rand() * 6.28, w: 0.4 + rand() * 0.5, alive: true })) }));

// birds: pelican lines and gull wheels, above the surface
const BIRDS = 96;   // 90 in flocks + 6 slots for diving pelicans
const birdMesh = new THREE.InstancedMesh(birdGeometry(), creatureMat({ mode: 4, freq: 3.2, amp: 0.5, glow: 1 }), BIRDS);
{ const ph = new Float32Array(BIRDS); for (let i = 0; i < BIRDS; i++) ph[i] = rand() * 6.28; birdMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); }
birdMesh.frustumCulled = false; scene.add(birdMesh);
const dives = [];
// Pelicans fold and plunge on mullet when you're up near the surface with a school close by.
function stepDives(dt, t) {
  if (dives.length < 2 && started && P.pos.y > -2.0) {
    const school = schools.find(sc => sc.c.lengthSq() && sc.c.distanceTo(P.pos) < 45 && sc.c.y > -6);
    const flock = flocks.find(fl => fl.kind === 'line' && fl.c.lengthSq() && fl.c.distanceTo(P.pos) < 600);
    if (school && flock && rand() < 0.012) {
      const from = flock.c.clone().add(new THREE.Vector3((rand() - .5) * 30, 0, (rand() - .5) * 30)); from.y = Math.max(8, flock.h);
      const to = new THREE.Vector3(school.c.x + (rand() - .5) * 6, 0.1, school.c.z + (rand() - .5) * 6);
      dives.push({ from, to, t: 0, school, home: flock, splashed: false, yaw: Math.atan2(-(to.x - from.x), -(to.z - from.z)) });
    }
  }
  for (const d of dives) {
    d.t += dt;
    if (d.t < 1.3) { const u = d.t / 1.3, e = u * u; d.pos = d.from.clone().lerp(d.to, e); d.pos.y = d.from.y + (d.to.y - d.from.y) * e + Math.sin(u * Math.PI) * 3; d.pitch = -0.4 - 1.0 * u; d.fold = 1 - u * 0.7; }
    else {
      if (!d.splashed) { d.splashed = true; for (let i = 0; i < 24; i++) emitBubble(d.to.x + (rand() - .5) * 2, -0.2 - rand() * 2.5, d.to.z + (rand() - .5) * 2);
        d.school.panic = 3; const sd = d.to.distanceTo(P.pos); splash(0.9 * Math.max(0, 1 - sd / 60)); if (sd < 12) P.shake = Math.max(P.shake || 0, 0.3); }
      if (d.t < 4.5) { d.pos = d.to.clone(); d.pos.y = 0.15 + Math.sin(t * 2.5) * 0.1; d.pitch = 0.1; d.fold = 0.3; d.yaw += 0.2 * dt; }
      else { const u = Math.min(1, (d.t - 4.5) / 4), e = u * u * (3 - 2 * u); const home = d.home.c.clone(); home.y = d.home.h; d.pos = d.to.clone().lerp(home, e); d.pos.y = 0.15 + (home.y - 0.15) * e; d.pitch = 0.5 * (1 - u); d.fold = 1; d.yaw = Math.atan2(-(home.x - d.to.x), -(home.z - d.to.z)); }
    }
  }
  for (let i = dives.length - 1; i >= 0; i--) if (dives[i].t > 8.6) dives.splice(i, 1);
}
const flocks = Array.from({ length: 6 }, (_, i) => ({ c: new THREE.Vector3(), dir: rand() * 6.28, kind: i < 3 ? 'line' : 'wheel', n: 15, h: 3 + rand() * 25, ph: rand() * 6 }));

// the fever: ~1200 cownose rays, instanced, phase-offset flapping
const FEVER_N = MOBILE ? 500 : 1200;
const feverMesh = new THREE.InstancedMesh(rayGeometry(speciesById.cownose, 10, 7), creatureMat({ mode: 1, half: 0.45, len: 0.6, freq: 2.6, amp: 0.55, glow: 0.9 }), FEVER_N);
{ const ph = new Float32Array(FEVER_N); for (let i = 0; i < FEVER_N; i++) ph[i] = rand() * 6.28; feverMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); }
feverMesh.frustumCulled = false; scene.add(feverMesh);
const fever = { c: new THREE.Vector3(FEVER_PATH[0][0], -3, FEVER_PATH[0][1]), seg: 0, t: 0, moving: false, yaw: 0, speed: 1.0,
  off: Array.from({ length: FEVER_N }, () => { const a = rand() * 6.28, r = Math.sqrt(rand()); return new THREE.Vector3(Math.cos(a) * r * 60, (rand() - 0.5) * 5, Math.sin(a) * r * 45); }) };
// 0 at the heart of the fever, 1 at its edge, large when you are nowhere near it
function feverR(p) { if (Math.abs(p.y - fever.c.y) > 6) return 9; const dx = p.x - fever.c.x, dz = p.z - fever.c.z, cs = Math.cos(-(fever.spin || 0)), sn = Math.sin(-(fever.spin || 0));
  return Math.hypot((dx * cs - dz * sn) / 60, (dx * sn + dz * cs) / 45); }
function stepFever(dt, t) {
  if (fever.moving && fever.seg + 1 < FEVER_PATH.length) {
    const [ax, az] = FEVER_PATH[fever.seg], [bx, bz] = FEVER_PATH[fever.seg + 1], len = Math.hypot(bx - ax, bz - az);
    fever.t += fever.speed * dt / len; if (fever.t >= 1) { fever.t = 0; fever.seg++; }
    fever.c.x = ax + (bx - ax) * fever.t; fever.c.z = az + (bz - az) * fever.t; fever.yaw = Math.atan2(-(bx - ax), -(bz - az));
  }
  const f = floorAt(fever.c.x, fever.c.z); fever.c.y = THREE.MathUtils.clamp(f * 0.5 - 1, f + 1.5, -2);
  feverMesh.visible = fever.c.distanceTo(camPos) < 400; if (!feverMesh.visible) return;   // beyond the murk: don't move 1200 rays nobody can see
  fever.frame = (fever.frame || 0) + 1; fever.floor ??= new Float32Array(FEVER_N).fill(-30); fever.px ??= new Float32Array(FEVER_N); fever.pz ??= new Float32Array(FEVER_N);
  if (!fever.moving) fever.spin = (fever.spin || 0) + 0.02 * dt;   // a waiting fever mills in a slow wheel
  const cs = Math.cos(fever.spin || 0), sn = Math.sin(fever.spin || 0), sharks = wild.filter(w => w.sp && PREDATORS.has(w.sp.id) && w.pos.distanceTo(fever.c) < 90);
  for (let i = 0; i < FEVER_N; i++) {
    const o = fever.off[i], rx = o.x * cs - o.z * sn, rz = o.x * sn + o.z * cs;
    for (const w of sharks) { const dx = fever.c.x + rx + fever.px[i] - w.pos.x, dz = fever.c.z + rz + fever.pz[i] - w.pos.z, dd = Math.hypot(dx, dz);   // the school flashes open around a shark
      if (dd < 9 && dd > 0.01) { const k = (9 - dd) * 2.5 * dt / dd; fever.px[i] += dx * k; fever.pz[i] += dz * k; } }
    fever.px[i] *= 1 - 0.3 * dt; fever.pz[i] *= 1 - 0.3 * dt;
    const x = fever.c.x + rx + fever.px[i] + Math.sin(t * 0.3 + i) * 2, z = fever.c.z + rz + fever.pz[i] + Math.cos(t * 0.25 + i * 0.7) * 2;
    if ((i + fever.frame) % 4 === 0) fever.floor[i] = floorAt(x, z);
    const y = THREE.MathUtils.clamp(fever.c.y + o.y, fever.floor[i] + 0.6, -0.8);
    const yaw = fever.moving ? fever.yaw : Math.atan2(rz, -rx);   // milling: each one heads along the wheel
    placeInstance(feverMesh, i, x, y, z, 0, yaw + Math.sin(t * 0.2 + i) * 0.15, Math.sin(t * 0.5 + i) * 0.1);
  }
  feverMesh.instanceMatrix.needsUpdate = true;
}

// (a real ray's sprint covers 18 m in five seconds, which you never feel in a 40 km bay; a game burst covers about 40. a shark still out-sprints your cruise, but not your burst)
const HP_MAX = 5;   /* three hearts is healthy; fat reserves carry you to five */
const AIR = new Set(['dolphin', 'manatee']);   // the bodies that come up to breathe
const HOLD = { dolphin: 75, manatee: 120 };   // seconds of air, in proportion to the real animals
const ABILITY = { cownose: 'sense', dolphin: 'echo', bull: 'lunge', hammer: 'lunge',
  manatee: 'breathe', mullet: 'leap' };
const ABILITY_CD = { sense: 3, echo: 2, lunge: 1.2, breathe: 2, leap: 1.5 };
const pulses = [];
function act() {
  const kind = ABILITY[P.sp.id] || 'sense', now = simTime;   // world time: a pause doesn't run the cooldown down if ((P.actReady || 0) > now) return; P.actReady = now + ABILITY_CD[kind];
  if (kind === 'sense' || kind === 'echo') {   // rays feel electric fields; dolphins hear their own clicks come back
    pulses.push({ t0: WU.uTime.value, kind });   // the rings are drawn on screen time P.reveal = 1; P.revealRange = kind === 'echo' ? 90 : 50;
    if (kind === 'echo') { click(3); click(3, 0.22); later(TUNE.timing.echoReach, echoThing, 'world'); } else burst({ buf: 'brown', type: 'lowpass', f0: 120, f1: 380, f2: 70, attack: 0.06, length: 1.4, g: 0.35 });
  } else if (kind === 'lunge') { P.vel.addScaledVector(fwdOf(P.yaw, P.pitch), P.sp.max * 1.3); P.strikeT = 0.45; whoosh(0.7); }
  else if (kind === 'breathe') { if (P.pos.y > -1.2) { P.sta = 1; P.spent = false; splash(0.3); say('a breath', 1.2); } else { say('too deep to breathe', 1.2); P.actReady = now + 0.3; } }
  else if (kind === 'leap') { if (P.pos.y > -1.6) { P.vel.y = 6; P.leapT = 0.6; P.vel.addScaledVector(fwdOf(P.yaw), 2); } else { say('get near the surface', 1.2); P.actReady = now + 0.3; } }
}
// once in a long while, deep, the echo comes back off something bigger than anything here. it shows for a moment and nothing is said
const THING = { id: 'thing', kind: 'fish', len: 17, fat: 0.15, round: 0.6, dorsal: 0.5, pect: 1.5, fluke: 'shark', cruise: 0.8, max: 1, freq: 0.5, amp: 0.05 };
const thing = { mesh: null, t: 0, next: 120 };
function echoThing() {
  const now = simTime, f = floorAt(P.pos.x, P.pos.z); if (now < thing.next || f > -TUNE.thing.floor || P.pos.y > -5 || rand() > TUNE.thing.chance) return;
  thing.next = now + between(TUNE.thing.every);
  thing.mesh ??= (() => { const m = creatureMesh(THING, 0.5); scene.add(m); return m; })();
  const side = rand() < 0.5 ? -1 : 1, fw = fwdOf(P.yaw, 0), x = P.pos.x + fw.x * 46 + Math.cos(P.yaw) * side * 14, z = P.pos.z + fw.z * 46 - Math.sin(P.yaw) * side * 14;
  thing.mesh.position.set(x, THREE.MathUtils.clamp(P.pos.y - 3, floorAt(x, z) + 4, -3), z); orient(thing.mesh, P.yaw + side * Math.PI / 2, 0, 0); thing.t = 0.7; thing.mesh.visible = true;
}
function stepThing(dt) {
  if (!thing.mesh || !thing.mesh.visible) return; thing.t -= dt; if (thing.t <= 0) { thing.mesh.visible = false; return; }
  thing.mesh.position.addScaledVector(fwdOf(thing.mesh.rotation.y, 0), 1.2 * dt); thing.mesh.material.uniforms.uGlow.value = 0.6 * Math.min(1, thing.t / 0.3);
}
const abilityName = () => (ABILITY[P.sp.id] || 'sense').toUpperCase();
