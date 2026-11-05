'use strict';
// ═══════════════════════════════════════════════════════════════════
//  FRAME
// ═══════════════════════════════════════════════════════════════════
const clock = { last: performance.now(), elapsedTime: 0, getDelta() { const n = performance.now(), d = (n - this.last) / 1000; this.last = n; this.elapsedTime += d; return d; } }, _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let dayClock = 6.5, above = false, aboveMix = 0, nearestPoi = '', poiTimer = 0, grassCenter = new THREE.Vector2(1e9, 1e9), lastFloor = -5;

const _cur = new THREE.Vector3(), _next = new THREE.Vector3(), _want = new THREE.Vector3(), _along = new THREE.Vector3(), _xz = new THREE.Vector2(), _sc = new THREE.Vector3();
// ── the player, one step. each stage hands the next what it needs: what you're asking for, the seabed, whether you're
//    bursting, how hard you're swimming. the body's lasting state is on P.
function stepPlayer(dt) {
  const sp = P.sp, stunned = P.stun > 0; P.stun -= dt;
  P.vel ??= new THREE.Vector3();
  const intent = steerIntent(dt, stunned), ground = terrainAround(sp, dt, intent.climb);
  steerBody(sp, intent, ground, dt);
  const wantBurst = stepBurst(stunned, dt), thrust = swim(sp, intent, wantBurst, stunned, dt);
  porpoise(sp, intent, dt); breathe(sp, wantBurst, dt);
  moveThroughWater(sp, ground.fHere, dt);
  rippleAndSplash(sp, dt); const surf = surfacing(sp, dt); wake(sp, dt);
  poseBody(sp, thrust, surf, dt);
}
// what you're asking the body to do: the input snapshot, with the mouse's aim folded in
function steerIntent(dt, stunned) {
  let turn = stunned ? 0 : input.turn, climb = stunned ? -0.4 : input.climb; const throttle = stunned ? 0 : input.throttle;   // one snapshot of every device (08-input.js)
  if (mouseSteering() && !stunned && !input.forced) {   // the mouse sets where you mean to go; the body still turns at its own rate and banks into it
    aim.yaw ??= P.yaw;
    if (turn) aim.yaw = P.yaw; else { const d = Math.atan2(Math.sin(aim.yaw - P.yaw), Math.cos(aim.yaw - P.yaw)); turn = THREE.MathUtils.clamp(d * 2.5, -1, 1); aim.yaw = P.yaw + THREE.MathUtils.clamp(d, -1.2, 1.2); }
    aim.pitchT += dt; if (climb) aim.pitch = 0; else if (aim.pitchT > 0.25) aim.pitch *= 1 - Math.min(1, 2 * dt);   // let the mouse rest, or let go of rise or dive, and the nose comes back level
    if (!climb) { const c = THREE.MathUtils.clamp(aim.pitch / 0.8, -1, 1); if (Math.abs(c) > 0.06) climb = c; }
  } else aim.yaw = null;
  P.turnIn = turn; P.climbIn = climb;   // for the HUD: each control gets its own mark on the screen
  return { turn, climb, throttle };
}
// the bottom under you and ahead of you, and the timers that run down every step
function terrainAround(sp, dt, climb) {
  const fHere = floorAt(P.pos.x, P.pos.z), ahead = fwdOf(P.yaw, 0).multiplyScalar(6 + P.speed * 2).add(P.pos), fAhead = floorAt(ahead.x, ahead.z);
  P.strikeT = Math.max(0, (P.strikeT || 0) - dt); P.leapT = Math.max(0, (P.leapT || 0) - dt); P.reveal = Math.max(0, (P.reveal || 0) - dt / 4);
  P.idleT = climb ? 0 : (P.idleT || 0) + dt;
  return { fHere, fAhead };
}
  // body attitude: a turn needs speed and banks the body; the turning circle grows with speed
function steerBody(sp, { turn, climb }, { fAhead }, dt) {
  const speedFrac = Math.min(1, P.speed / sp.max);
  const yawWant = turn * sp.turn * (settings.turn / 100) * (0.55 + 0.6 * Math.min(1, P.speed / sp.cruise)) / (1 + speedFrac * 1.4);
  P.yawRate += (yawWant - P.yawRate) * Math.min(1, 4 * dt); P.yaw += P.yawRate * dt;
  P.roll += (P.yawRate * 0.9 * (0.4 + speedFrac) - P.roll) * Math.min(1, 2.5 * dt);   // bank into the turn
  let pitchWant = climb * 0.8;
  if (!climb) {
    if (fAhead + sp.alt + 0.8 > P.pos.y) pitchWant = THREE.MathUtils.clamp((fAhead + sp.alt + 1.0 - P.pos.y) * 0.5, 0, 0.6);
    else if (P.idleT > 3) { const prefer = sp.id === 'dolphin' ? Math.max(fAhead + sp.alt + 0.4, -0.8) : THREE.MathUtils.clamp(fAhead * 0.5, fAhead + sp.alt + 0.4, -0.9);   /* a travelling dolphin keeps to the top */ pitchWant = THREE.MathUtils.clamp((prefer - P.pos.y) * 0.15, -0.3, 0.3); }
  }
  P.pitch += (pitchWant - P.pitch) * Math.min(1, (climb ? 5 : 3) * dt);
}
  // burst: SHIFT spends the dots on a flat-out sprint, with or without W. five seconds of it, six to fill back up, usable again in two
function stepBurst(stunned, dt) {
  P.sta ??= 1; const wantBurst = sprinting() && !stunned && P.sta > 0 && !P.spent;
  if (wantBurst) { P.sta = Math.max(0, P.sta - dt / TUNE.burst.secs); if (P.sta === 0) P.spent = true; } else { P.sta = Math.min(1, P.sta + dt / TUNE.burst.refill); if (P.sta > TUNE.burst.reuseAt) P.spent = false; }
  if (wantBurst && !P.bursting) { whoosh(0.7); rumble(0.35, 0.25, 160); for (let i = 0; i < 16; i++) emitBubble(P.pos.x + (rand() - .5) * 1.2, P.pos.y + (rand() - .5) * 0.6, P.pos.z + (rand() - .5) * 1.2); }   // the kick: heard, felt, seen
  P.bursting = wantBurst;
  return wantBurst;
}
  // propulsion: thrust along the body, quadratic drag, sideways water resistance, a little lift from pitch
function swim(sp, { climb, throttle }, wantBurst, stunned, dt) {
  const fwd = fwdOf(P.yaw, P.pitch), wantSpeed = throttle < 0 ? -0.35 * sp.cruise : wantBurst ? sp.max * TUNE.burst.boost : throttle === 0 ? 0.12 * sp.cruise : (sprinting() && !stunned ? sp.cruise * 1.25 : sp.cruise);
  const along = P.vel.dot(fwd), dragAt = v => 2.4 * sp.max * v * Math.abs(v) / (sp.max * sp.max);   // the same quadratic drag the water applies below
  // thrust = what holding that speed costs against the drag, plus a push toward it, so every speed is actually reached; a burst pushes hardest
  const thrust = THREE.MathUtils.clamp(dragAt(wantSpeed) / 0.85 + (wantSpeed - along) * (wantBurst ? 10.0 : 6.0), -0.6 * sp.max, wantBurst ? Math.max(4.5 * sp.max, 1.3 * dragAt(wantSpeed) / 0.85) : 2.4 * sp.max) * (0.85 + 0.15 * Math.sin(P.mesh.material.uniforms.uPhase.value * 2.0));
  const inAir = P.pos.y > 0.0;   // out of the water there is nothing to push against
  P.vel.addScaledVector(fwd, (inAir ? 0 : thrust) * dt);
  // drag balances full thrust exactly at the burst top speed, so every body can reach it
  const vlen = P.vel.length(), vmax = sp.max; if (vlen > 0.01) P.vel.addScaledVector(P.vel, -(2.4 * sp.max) * vlen / (vmax * vmax) * dt * (inAir ? 0.04 : 1));
  if (!inAir) P.vel.lerp(_along.copy(fwd).multiplyScalar(along), Math.min(1, 2.5 * dt));   // the body streamlines into its own motion
  if (inAir) { P.vel.y -= 9.8 * dt; P.pitch += (Math.atan2(P.vel.y, Math.hypot(P.vel.x, P.vel.z) + 0.01) - P.pitch) * Math.min(1, 6 * dt); }   // a leap: gravity, nose follows the arc
  else {
    P.vel.y += climb * 2.2 * dt * Math.max(1, sp.max * 0.35) - P.vel.y * 1.5 * dt;    // fins give some direct lift, water damps it
    const top = AIR.has(sp.id) ? -0.08 : -0.3;   // air-breathers float at the top; everything else stays just under it
    if (P.pos.y > top - 0.5 && P.vel.y > 0 && !wantBurst && !(P.leapT > 0)) P.vel.y = Math.min(P.vel.y, (top - P.pos.y) * 4);   // a rise floats you there; only a burst or a leap breaches
    if (!AIR.has(sp.id) && climb <= 0 && P.pos.y > -0.9) P.vel.y -= 2.0 * dt;   // let go of rise and a fish or a ray slips back down
  }
  P.speed = Math.max(0, along);
  return thrust;
}
function porpoise(sp, { climb, throttle }, dt) {
  const inAir = P.pos.y > 0.0;
  if (sp.id === 'dolphin' && !inAir && P.pos.y > -1.4 && throttle > 0 && !climb && Math.abs(P.yawRate) < 0.35 && P.speed > sp.cruise * 0.75) {   /* porpoising: at speed a dolphin travels in leaps, the cheaper way to go */
    P.porpT = (P.porpT || 0) + dt; P.porpNext ??= 2 + rand() * 2.5;
    if (P.porpT > P.porpNext) { P.porpT = 0; P.porpNext = 2.5 + rand() * 2.5; P.vel.y = 3.2 + Math.min(3, P.speed * 0.25); P.leapT = 0.9; P.pitch = Math.max(P.pitch, 0.35);
      const mate = wild.find(o => o.partner && !o.air);   /* a companion close beside you leaps when you do */
      if (mate && mate.pos.distanceTo(P.pos) < 12 && mate.pos.y > -2.5) { mate.air = true; mate.vy = P.vel.y * (0.95 + rand() * 0.1); mate.pos.y = Math.max(mate.pos.y, -0.4); story.together(); }
      else if (mate && CHAPTERS[story.ch].pair) say('swim beside it', 1.5); }
  } else P.porpT = Math.max(0, (P.porpT || 0) - dt * 2);
}
function breathe(sp, wantBurst, dt) {
  if (HOLD[sp.id]) {   // lungs: air drains under, comes back in a few breaths at the top, twice as fast when you burst
    P.air ??= 1; const up = P.pos.y > -0.3;
    if (up) { if (P.air < 0.97 && !P.breathing) { P.breathing = true; blow(sp.id === 'dolphin'); P.surf = { t: 0, len: sp.id === 'dolphin' ? 1.5 : 3.2, puff: false }; } P.air = Math.min(1, P.air + dt / 1.5); P.drownT = 0; if (P.air >= 1) P.breathing = false; }
    else { P.breathing = false; P.air = Math.max(0, P.air - dt / HOLD[sp.id] * (wantBurst ? 2 : 1)); }
    if (!up && P.air < 0.5) tip('air', () => `${kn('rise')} rises. breathe at the top before the bar runs out.`);
    if (!up && P.air < 0.25 && !P.airWarned) { P.airWarned = true; say('you need air', 2.5); } if (P.air > 0.5) P.airWarned = false;
    if (!up && P.air <= 0) { P.drownT = (P.drownT || 0) + dt; if (P.drownT > 5) { P.drownT = 0; hurt(0.3, 'OUT OF AIR\nget to the surface'); P.pitch = 0.5; } }
  } else P.air = 1;
}
// the tide carries you, the bottom stops you, structures turn you aside
function moveThroughWater(sp, fHere, dt) {
  Bay.current(P.pos.x, P.pos.z, _cur); const curReal = _cur.length();
  _cur.multiplyScalar(1 + TUNE.tide.pull * THREE.MathUtils.smoothstep(curReal, TUNE.tide.from, TUNE.tide.to));   // a strong tide is felt, not just measured: in the pass on a big ebb it carries you toward the Gulf
  if (curReal > 0.55 && !P.tideSaid && started && sayTimer <= 0) { P.tideSaid = true; say('the tide has you', 2.5); } else if (curReal < 0.3) P.tideSaid = false;
  const next = _next.copy(P.pos).addScaledVector(P.vel, dt).addScaledVector(_cur, dt);
  if (floorAt(next.x, next.z) > -sp.alt - 0.5) { P.vel.multiplyScalar(0.3); P.yaw += 0.8 * dt; next.copy(P.pos).addScaledVector(_cur, dt); }
  P.pos.copy(next);
  P.pos.y = THREE.MathUtils.clamp(P.pos.y, fHere + sp.alt, 6);
  if (P.pos.y <= fHere + sp.alt + 0.01 && P.vel.y < 0) P.vel.y = 0;
  // structures are solid: you slide along a piling or a hull, and hitting one hard is felt in the body, the ears and the hands
  P.bumpT = Math.max(0, (P.bumpT || 0) - dt);
  if (world.colliders) { const r = (sp.span ?? sp.len) * 0.35;
    for (const c of world.colliders.near(P.pos.x, P.pos.z)) { const h = pushOut(c, P.pos.x, P.pos.y, P.pos.z, r); if (!h) continue;
      P.pos.x = h.x; P.pos.z = h.z; const into = P.vel.x * h.nx + P.vel.z * h.nz; if (into >= 0) continue;
      P.vel.x -= into * h.nx; P.vel.z -= into * h.nz;
      if (-into > 1.2 && P.bumpT <= 0) { P.bumpT = 0.6; P.bumps = (P.bumps || 0) + 1; thud(Math.min(1, -into / 5) * 0.7); P.shake = Math.max(P.shake || 0, Math.min(0.5, -into * 0.08)); rumble(0.3, 0.2, 120); } } }
  lastFloor = fHere; P.current = curReal;
}
// rings on the water at the top, and a splash breaking through it either way
function rippleAndSplash(sp, dt) {
  if (P.pos.y > -0.4) { P.rippleT = (P.rippleT || 0) + dt; if (P.rippleT > 0.45) { P.rippleT = 0; const r = (sp.span ?? sp.len) * 0.7; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; emitBubble(P.pos.x + Math.cos(a) * r, -0.06 - rand() * 0.1, P.pos.z + Math.sin(a) * r); } } }
  const upNow = P.pos.y > -0.25; if (upNow !== !!P.wasUp && Math.abs(P.vel.y) > 0.4) { for (let i = 0; i < 30; i++) emitBubble(P.pos.x + (rand() - .5) * 1.5 * (sp.span ?? sp.len), -0.1 - rand() * 1.5, P.pos.z + (rand() - .5) * 1.5); splash(Math.min(1, Math.abs(P.vel.y) / 3)); P.shake = Math.max(P.shake || 0, 0.25); } P.wasUp = upNow;
}
  // surfacing, as each body really does it: a dolphin rolls through in an arc and blows; a manatee lifts its snout, breathes, and sinks
function surfacing(sp, dt) {
  let surfPitch = 0, surfY = 0;
  if (P.surf) { const S = P.surf; S.t += dt; const u = Math.min(1, S.t / S.len), head = fwdOf(P.yaw, 0).multiplyScalar((sp.len || 1) * 0.35).add(P.pos);
    if (sp.id === 'dolphin') { surfPitch = 0.5 * Math.cos(Math.PI * u); surfY = 0.3 * Math.sin(Math.PI * u); if (!S.puff && u > 0.2) { S.puff = true; for (let i = 0; i < 26; i++) emitSpray(head.x, 0.2, head.z, (rand() - .5) * 0.8, 2.5 + rand() * 2, (rand() - .5) * 0.8); } }
    else { surfPitch = 0.32 * Math.sin(Math.PI * u); surfY = 0.12 * Math.sin(Math.PI * u); if (!S.puff && u > 0.35) { S.puff = true; for (let i = 0; i < 8; i++) emitSpray(head.x, 0.08, head.z, (rand() - .5) * 0.4, 0.8 + rand() * 0.6, (rand() - .5) * 0.4); } }
    if (u >= 1) P.surf = null; }
  return { surfPitch, surfY };
}
  // at the top: a cownose ray's wingtips cut the water; a shark's dorsal leaves a wake
function wake(sp, dt) {
  if (P.pos.y > -0.45 && P.speed > 0.3) { P.cutT = (P.cutT || 0) - dt; if (P.cutT <= 0) { P.cutT = 0.12;
    const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw), b = fwdOf(P.yaw, 0);
    if (sp.kind === 'ray') for (const side of [-1, 1]) { const x = P.pos.x + rx * side * (sp.span || 1) * 0.5, z = P.pos.z + rz * side * (sp.span || 1) * 0.5; emitBubble(x, -0.06, z); if (rand() < 0.5) emitSpray(x, 0.02, z, -b.x * P.speed * 0.3 + rx * side * 0.4, 0.6 + rand() * 0.5, -b.z * P.speed * 0.3 + rz * side * 0.4); }
    else if (PREDATORS.has(sp.id) && P.pos.y > -0.6) { emitBubble(P.pos.x - b.x * 0.4, -0.06, P.pos.z - b.z * 0.4); for (const side of [-1, 1]) emitSpray(P.pos.x + rx * side * 0.1, 0.02, P.pos.z + rz * side * 0.1, rx * side * 0.6 - b.x * 0.3, 0.5 + rand() * 0.4, rz * side * 0.6 - b.z * 0.3); } } }
}
// the body where it is, how it is turned, how hard its wings or tail are working, and its trail of bubbles
function poseBody(sp, thrust, { surfPitch, surfY }, dt) {
  P.mesh.position.copy(P.pos); P.mesh.position.y += surfY;
  P.mesh.position.y += Math.sin(P.mesh.material.uniforms.uPhase.value) * 0.025 * (sp.span ?? sp.len); orient(P.mesh, P.yaw, P.pitch + surfPitch, P.roll);
  P.mesh.material.uniforms.uGlow.value += ((P.lit ? 2.4 : 1.3) - P.mesh.material.uniforms.uGlow.value) * Math.min(1, 3 * dt);
  { const u = P.mesh.material.uniforms, work = THREE.MathUtils.clamp(thrust / (0.6 * sp.max) + 0.15, 0, 1);
    if (sp.kind === 'ray') {   // rays glide between beats when there's little to do
      P.glide = (P.glide || 0) + dt; const gliding = work < 0.25 && Math.sin(P.glide * 0.6) > 0.2;
      u.uFlap.value += ((gliding ? 0.12 : 0.3 + 0.7 * work) - u.uFlap.value) * Math.min(1, 2.5 * dt);
    } else u.uFlap.value = 0.35 + 0.65 * work; }
  { const u = P.mesh.material.uniforms, target = sp.kind === 'ray' ? strouhalRad(sp, P.speed, u.uFlap.value) : sp.freq * (0.7 + 0.6 * THREE.MathUtils.clamp(thrust / sp.max, 0, 1.2)); u.uFreq.value += (target - u.uFreq.value) * Math.min(1, 2 * dt); }
  if (P.speed > sp.cruise * 1.3) for (let i = 0; i < 2; i++) if (rand() < 0.5) emitBubble(P.pos.x + (rand() - .5) * (sp.span ?? sp.len) * 0.8, P.pos.y - 0.1, P.pos.z + 0.3);
  else if (rand() < 0.04) emitBubble(P.pos.x, P.pos.y, P.pos.z);
}
function stepPhotoCam(dt) {   // photo mode: orbit and zoom around the body; keys, sticks, mouse and wheel all work
  const k = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0), z = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0), u = (keys.Space ? 1 : 0) - (keys.KeyC ? 1 : 0);
  photo.yaw += (k * 1.2 - pad.lookX * 1.6 - pad.turn * 1.2) * dt; photo.pitch = THREE.MathUtils.clamp(photo.pitch + (u * 0.9 + pad.lookY * 1.2) * dt, -1.3, 1.3);
  photo.dist = THREE.MathUtils.clamp(photo.dist * (1 + (z - pad.climb) * dt), 1.2, 60); photo.t += dt;
  camPos.set(P.pos.x + Math.sin(photo.yaw) * Math.cos(photo.pitch) * photo.dist, P.pos.y + Math.sin(photo.pitch) * photo.dist, P.pos.z + Math.cos(photo.yaw) * Math.cos(photo.pitch) * photo.dist);
  camPos.y = Math.max(camPos.y, floorAt(camPos.x, camPos.z) + 0.3);
  camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(P.pos);
  above = camPos.y > 0; aboveMix += ((above ? 1 : 0) - aboveMix) * Math.min(1, 6 * dt);
  WU.uFogD.value = THREE.MathUtils.lerp(0.018, 0.00018, aboveMix); WU.uFogB.value = (0.05 + 0.3 * WU.uSun.value) * aboveMix;
}
function stepCamera(dt) {
  if (photo) { stepPhotoCam(dt); return; }
  P.burstMix = (P.burstMix || 0) + ((P.bursting ? 1 : 0) - (P.burstMix || 0)) * Math.min(1, (P.bursting ? 5 : 2) * dt);   // snaps in, eases out
  const size = P.mesh.userData.size, dist = 2.4 + size * 2.5 + P.speed * 0.12 + P.burstMix * (1 + size), h = 1.0 + size * 0.6;
  camera.fov = (camera.userData.baseFov || 60) + (settings.speedFx ? 14 : 0) * P.burstMix; camera.updateProjectionMatrix();   // the view widens at speed, unless that's turned off for comfort
  { const want = settings.vignette ? Math.min(0.85, 0.75 * P.burstMix + 0.6 * Math.min(1, Math.abs(P.yawRate || 0) / 1.2) + 0.35 * Math.min(1, (P.speed || 0) / Math.max(1, P.sp.max))) : 0;
    dotPass.uniforms.uTunnel.value += (want - dotPass.uniforms.uTunnel.value) * Math.min(1, 4 * dt); }
  P.idleCam = (input.turn || input.climb || sprinting()) ? 0 : (P.idleCam || 0) + dt;
  const sway = settings.sway ? 1 : 0;   // the camera never moves on its own unless that's wanted
  const drift = sway * (started ? Math.sin(WU.uTime.value * 0.05) * 0.9 * THREE.MathUtils.smoothstep(P.idleCam, 12, 30) : Math.sin(WU.uTime.value * 0.07) * 0.5);
  if (Math.abs(pad.lookX) > 0 || Math.abs(pad.lookY) > 0) { aim.lookYaw -= pad.lookX * 2.4 * dt; aim.lookPitch = THREE.MathUtils.clamp(aim.lookPitch + pad.lookY * 1.6 * dt, -0.8, 0.8); aim.lookT = 0; }
  aim.lookT += dt; if (!aim.look && aim.lookT > 0.8) { const k = Math.min(1, 2.5 * dt); aim.lookYaw *= 1 - k; aim.lookPitch *= 1 - k; }   // let go and it comes back behind you
  aim.lookYaw = Math.atan2(Math.sin(aim.lookYaw), Math.cos(aim.lookYaw));
  const yawT = P.yaw + drift + aim.lookYaw + (P.endingCam ? Math.sin(WU.uTime.value * 0.08) * 1.2 * sway : 0);
  const back = fwdOf(yawT, P.pitch * 0.45 + aim.lookPitch).multiplyScalar(-dist); back.y += h;
  const want = _want.copy(P.pos).add(back);
  // the camera stays under until you break the surface, and stays up until you really dive (no popping at the line)
  if (P.pos.y > 0.05) P.camUp = true; else if (P.pos.y < -0.6) P.camUp = false;   // breathing happens just under the line; only a breach takes the camera up
  if (P.camUp) want.y = Math.max(want.y, 1.2 + size * 0.3); else want.y = Math.min(want.y, -0.35);   // just under the surface, never level with you
  want.x += Math.sin(WU.uTime.value * 0.35) * 0.12 * sway; want.y += Math.sin(WU.uTime.value * 0.5 + 1.0) * 0.08 * sway;
  camPos.lerp(want, Math.min(1, 5 * dt));
  camPos.y = Math.max(camPos.y, floorAt(camPos.x, camPos.z) + 0.5);
  const nearTop = !P.camUp ? THREE.MathUtils.smoothstep(P.pos.y, -2.5, -0.3) : 0;
  camLook.lerp(_v.copy(P.pos).addScaledVector(fwdOf(P.yaw, P.pitch * 0.6), 6 * (1 - Math.min(1, Math.abs(aim.lookYaw)))).add(_sc.set(0, 0.6 + size * 0.3 + nearTop * 0.8, 0)), Math.min(1, 8 * dt));
  camera.position.copy(camPos); { const k = settings.horizonTilt ? P.roll * 0.15 : 0; camera.up.set(-Math.cos(P.yaw) * Math.sin(k), Math.cos(k), Math.sin(P.yaw) * Math.sin(k)); } P.shake = Math.max(0, (P.shake || 0) - dt * 1.5); if (P.shake > 0 && settings.shake) camera.position.add(_sc.set(rand() - .5, rand() - .5, rand() - .5).multiplyScalar(P.shake * 0.35)); camera.lookAt(camLook);
  above = camPos.y > 0;
  aboveMix += ((above ? 1 : 0) - aboveMix) * Math.min(1, 6 * dt);
  WU.uFogD.value = THREE.MathUtils.lerp(0.018, 0.00018, aboveMix) * (1 - 0.55 * (P.reveal || 0)); WU.uFogB.value = (0.05 + 0.3 * WU.uSun.value) * aboveMix;
}
function stepAmbient(dt, t) {
  updateClipmap(P.pos.x, P.pos.z); surface.position.set(camPos.x, 0, camPos.z); sky.position.copy(camPos);
  if (grassCenter.distanceTo(_xz.set(P.pos.x, P.pos.z)) > 28) rebuildGrass(P.pos.x, P.pos.z);
  shaftSeeds.forEach((s, i) => { const a = s.a + t * 0.01, x = camPos.x + Math.cos(a) * s.r, z = camPos.z + Math.sin(a) * s.r;
    placeInstance(shafts, i, x, 0, z, 0, Math.atan2(camPos.x - x, camPos.z - z) + Math.sin(t * 0.3 + s.s) * 0.2, 0, s.w, 26 + Math.sin(t * 0.2 + s.s) * 4, 1); });
  shafts.instanceMatrix.needsUpdate = true;
  { const a = snow.geometry.attributes.position.array, hb = snowBox / 2;
    for (let i = 0; i < a.length; i += 3) { a[i + 1] -= 0.08 * dt; a[i] += _cur.x * dt; a[i + 2] += _cur.z * dt; for (let k = 0; k < 3; k++) { const d = a[i + k] - camPos.getComponent(k); if (d > hb) a[i + k] -= snowBox; else if (d < -hb) a[i + k] += snowBox; } }
    snow.geometry.attributes.position.needsUpdate = true; }
  { const a = bubbles.geometry.attributes.position.array;
    const la = bubbles.geometry.attributes.aLife.array;
    for (let i = 0; i < 600; i++) { bubbleLife[i] += dt; la[i] = bubbleLife[i]; if (bubbleLife[i] <= 14) { a[i * 3 + 1] = Math.min(-0.05, a[i * 3 + 1] + (0.3 + Math.min(bubbleLife[i], 6) * 0.14) * dt); a[i * 3] += Math.sin(t * 5 + i) * 0.12 * dt; a[i * 3 + 2] += Math.cos(t * 4 + i) * 0.09 * dt; } else a[i * 3 + 1] = 9999; }
    bubbles.geometry.attributes.position.needsUpdate = true; bubbles.geometry.attributes.aLife.needsUpdate = true; }
  if (world.buoyMesh) { world.buoys.forEach((b, i) => { _m.makeRotationZ(Math.sin(t * 0.8 + b.ph) * 0.08); _m.setPosition(b.x, Math.sin(t * 1.1 + b.ph) * 0.2 - 0.4, b.z); world.buoyMesh.setMatrixAt(i, _m); }); world.buoyMesh.instanceMatrix.needsUpdate = true; }
  // mullet schools
  let k = 0;
  for (const s of schools) {
    if (s.c.lengthSq() === 0 || s.c.distanceTo(P.pos) > 160) { const sp = spotNear(25, 85, 1.5); if (!sp) continue; s.c.set(sp.x, Math.min(-1.5, sp.f + 2 + rand() * 3), sp.z); s.base = s.spread; for (const fish of s.fish) fish.alive = true; }
    const pd = s.c.distanceTo(P.pos);
    if (pd < 6 && P.speed > P.sp.cruise * 1.2) s.panic = 3;   // a charge scatters the school
    if (s.panic <= 0) for (const w of wild) if (w.sp && PREDATORS.has(w.sp.id) && w.pos.distanceTo(s.c) < 14) { s.panic = 3; if (pd < 50) flush(s.c.x, s.c.z, 1 - pd / 50); break; }   // sharks are silent; their prey is not
    s.panic = Math.max(0, s.panic - dt); s.spread += ((s.panic > 0 ? s.base * 3 : s.base) - s.spread) * Math.min(1, 3 * dt);
    if (s.panic > 0) { steerToSchool(s, 2 * s.c.x - P.pos.x, 2 * s.c.z - P.pos.z); }
    s.turn += (rand() - 0.5) * dt * 2; s.turn *= 0.98; s.dir += s.turn * dt; const sv = s.v * (s.panic > 0 ? 4 : 1); s.c.x += -Math.sin(s.dir) * sv * dt; s.c.z += -Math.cos(s.dir) * sv * dt;
    const f = floorAt(s.c.x, s.c.z); if (f > -2.5) s.dir += 2 * dt; s.c.y = THREE.MathUtils.clamp(s.c.y, f + 1, -1.2);
    for (const fish of s.fish) { const ph = t * fish.w + fish.ph; _e.set(Math.sin(ph * 1.7) * 0.1, s.dir + Math.cos(ph) * 0.35, 0); _m.makeRotationFromEuler(_e);
      const fx = s.c.x + fish.off.x * s.spread + Math.sin(ph) * 0.6, fy = s.c.y + fish.off.y * s.spread, fz = s.c.z + fish.off.z * s.spread + Math.cos(ph * 0.8) * 0.6;
      if (fish.alive && (PREDATORS.has(P.sp.id) || P.sp.id === 'dolphin') && (P.speed > P.sp.cruise * 1.3 || P.strikeT > 0) && Math.abs(fx - P.pos.x) < (P.strikeT > 0 ? 1.8 : 1) && Math.abs(fz - P.pos.z) < (P.strikeT > 0 ? 1.8 : 1) && Math.abs(fy - P.pos.y) < 1.2) { fish.alive = false; P.fed = (P.fed || 0) + 1; if (P.fed % 3 === 0 && P.hp < HP_MAX) { P.hp++; say('♥  well fed', 1.2); } s.panic = 3; emitBubble(fx, fy, fz); }
      if (!fish.alive) _m.scale(GONE);
      _m.setPosition(fx, fy, fz); fishMesh.setMatrixAt(k++, _m); }
  }
  fishMesh.instanceMatrix.needsUpdate = true;
  // birds
  k = 0;
  for (const fl of flocks) {
    if (fl.c.lengthSq() === 0 || fl.c.distanceTo(P.pos) > 900) { const a = rand() * 6.28, r = 120 + rand() * 500; fl.c.set(P.pos.x + Math.cos(a) * r, fl.h, P.pos.z + Math.sin(a) * r); fl.dir = rand() * 6.28; }
    if (fl.kind === 'line') { fl.dir += Math.sin(t * 0.1 + fl.ph) * 0.1 * dt; fl.c.x += -Math.sin(fl.dir) * 9 * dt; fl.c.z += -Math.cos(fl.dir) * 9 * dt;
      for (let i = 0; i < fl.n; i++) { const back = fwdOf(fl.dir, 0).multiplyScalar(-i * 3.2), side = (i % 2 ? 1 : -1) * i * 1.2; _e.set(0, fl.dir, 0); _m.makeRotationFromEuler(_e);
        _m.setPosition(fl.c.x + back.x + Math.cos(fl.dir) * side, fl.h + Math.sin(t * 0.7 + i) * 0.6, fl.c.z + back.z - Math.sin(fl.dir) * side); birdMesh.setMatrixAt(k++, _m); } }
    else for (let i = 0; i < fl.n; i++) { const a = t * 0.25 + i * 0.42 + fl.ph, r = 25 + (i % 5) * 7; _e.set(0, -a + Math.PI, 0.3); _m.makeRotationFromEuler(_e);
      _m.setPosition(fl.c.x + Math.cos(a) * r, fl.h + 8 + Math.sin(t * 0.3 + i) * 4, fl.c.z + Math.sin(a) * r); birdMesh.setMatrixAt(k++, _m); }
  }
  for (const d of dives) { if (!d.pos || k >= BIRDS) continue; _e.set(d.pitch, d.yaw, 0); _m.makeRotationFromEuler(_e); _m.scale(_sc.set(d.fold, 1, 1)); _m.setPosition(d.pos.x, d.pos.y, d.pos.z); birdMesh.setMatrixAt(k++, _m); }
  birdMesh.count = k; birdMesh.instanceMatrix.needsUpdate = true;
}
// which way the tide is pushing you, as you look at it: ahead, behind, or off to a side
const tideArrow = () => { const rel = Math.atan2(_cur.x, -_cur.z) + P.yaw, a = Math.atan2(Math.sin(rel), Math.cos(rel)); return Math.abs(a) < 0.79 ? '↑' : Math.abs(a) > 2.36 ? '↓' : a > 0 ? '→' : '←'; };
function stepHud(dt) {
  const f = lastFloor / vex, [lat, lon] = toLL(P.pos.x, P.pos.z);
  const tide = (P.current || 0) > 0.15 ? `  TIDE ${P.current.toFixed(1)}${tideArrow()}` : '';
  tl.textContent = `DOWN ${Math.max(0, -P.pos.y).toFixed(1)}M  FLOOR ${(-f).toFixed(0)}M  ${P.speed.toFixed(1)}M/S${tide}  ${'♥'.repeat(P.hp)}${P.fed ? '  +' + P.fed : ''}`;
  poiTimer -= dt;
  if (poiTimer < 0) { poiTimer = 0.5; let best = 'Gulf of Mexico', bd = 1e12;
    for (const [plat, plon, name] of POIS) { const [x, z] = toXZ(plat, plon), d = (x - P.pos.x) ** 2 + (z - P.pos.z) ** 2; if (d < bd && d < 2500 ** 2) { bd = d; best = name; } if (d < 350 ** 2 && started) discover(name, x, z); }
    for (const w of world.wrecks) { const d = Math.hypot(w.x - P.pos.x, w.z - P.pos.z); if (d < 22 && started && LORE[w.name]) tip('lore:' + w.name, () => LORE[w.name], w.name.toUpperCase()); if (d < 60) { best = w.name; if (started) discover(w.name, w.x, w.z); } }
    nearestPoi = best; }
  tr.textContent = nearestPoi;
  const { b, d } = nearestBoat(); const danger = b && d < (b.type === BOAT_TYPES.ship ? 220 : 60) && P.pos.y > -2.5;
  const hunter = wild.find(w => w.hunting);
  const L = hunter && hunter.lunge, tele = L ? (L.phase === 'wind' ? `${L.side < 0 ? '◄' : '►'} ${L.side < 0 ? 'LEFT' : 'RIGHT'} · wait` : L.phase === 'lunge' ? 'TURN' : hunter.sp.name.toUpperCase()) : '';
  warn.textContent = danger ? `▲ DIVE` : hunter ? `▲ ${tele}` : ''; warn.style.opacity = danger || hunter ? 1 : 0;
  const landmarks = [];
  if (story.goal) landmarks.push({ name: 'goal', bearing: bearingTo(...story.goal), dist: Math.hypot(story.goal[0] - P.pos.x, story.goal[1] - P.pos.z), goal: true });
  for (const [plat, plon, name] of POIS) { const [x, z] = toXZ(plat, plon), dist = Math.hypot(x - P.pos.x, z - P.pos.z); if (dist < 8000 && dist > 150) landmarks.push({ name, bearing: bearingTo(x, z), dist }); }
  drawCompass(landmarks);
  if (sayTimer > 0) { sayTimer -= dt; if (sayTimer <= 0) { storyEl.style.opacity = 0; sayEndT = performance.now(); } }
}
// ── time. the world moves in slices of at most 1/50 s, up to three a frame, so it runs at real speed down to ~17 fps and
//    never depends on the display's rate. the screen (camera, HUD, sound, the render) updates once a frame.
//    in ?test nothing moves on its own: a test steps the world in exact 1/60 s slices (src/16-test.js).
const SIM_MAX = 1 / 50, SIM_STEPS = 3;
let photoUrl = null;
let simTime = 0, timeScale = 1;   // seconds of world time; ?dev can speed the world up or slow it down
// something meant to last a while (TUNE.timing), on the right clock: 'screen' keeps running through a pause (cards, flashes), 'world' stops with it
const timers = { screen: [], world: [] };
function later(secs, fn, clock = 'screen') { timers[clock].push({ at: (clock === 'world' ? simTime : WU.uTime.value) + secs, fn }); }
function runTimers(clock, now) { const q = timers[clock]; if (!q.length || !q.some(t => t.at <= now)) return; timers[clock] = q.filter(t => t.at > now); for (const t of q) if (t.at <= now) t.fn(); }
function simStep(dt) {
  readInput(); stepStrokes(dt); const t = simTime;
  if (started && !paused) { dayClock = (dayClock + dt / 60) % 24; saveTimer += dt; if (saveTimer > 30) { saveTimer = 0; saveGame(); } stepPlayer(dt); story.step(dt); }
  if (!started) {   // attract: after a while the ray wanders off on its own and the words fade
    P.titleIdle = (P.titleIdle || 0) + dt; if (P.titleIdle > 40) { $('title').classList.add('attract'); logo.release();
      P.yaw += Math.sin(t * 0.12) * 0.25 * dt; fwdInto(_f, P.yaw).multiplyScalar(1.6 * dt); const nx = P.pos.x + _f.x, nz = P.pos.z + _f.z; if (floorAt(nx, nz) < -2.5) { P.pos.x = nx; P.pos.z = nz; } else P.yaw += 1.2 * dt;
      P.pos.y = THREE.MathUtils.clamp(P.pos.y + Math.sin(t * 0.07) * 0.15 * dt, floorAt(P.pos.x, P.pos.z) + 1.2, -1.5); P.mesh.position.copy(P.pos); orient(P.mesh, P.yaw, 0, 0); } }
  if (!paused) { stepDives(dt, t); stepAmbient(dt, t); stepWild(dt, t); stepJellies(dt, t); stepFood(dt, t); stepSeeps(dt); stepBoats(dt, t); stepGig(dt, t); stepFever(dt, t); stepSpray(dt); stepThing(dt); simTime += dt; runTimers('world', simTime); }
}
function frame() {
  booting = false;
  requestAnimationFrame(frame);
  const real = Math.min(0.25, clock.getDelta()); WU.uTime.value = clock.elapsedTime;
  stepQuality(); pollPad(); if (started && needFull() && !menu) openMenu('main');
  paused = started && (mapOpen || helpOpen || !!menu || !!photo || needFull() || portrait());   // a real pause: sharks, boats and lights wait too
  stepVolume(); stepTips(); runTimers('screen', WU.uTime.value);
  if (!TEST) { const want = real * timeScale, n = Math.min(SIM_STEPS * Math.ceil(timeScale), Math.max(1, Math.ceil(want / SIM_MAX - 1e-9))); for (let i = 0; i < n; i++) simStep(Math.min(want, n * SIM_MAX) / n); }
  { const a = (dayClock - 6) / 12 * Math.PI, el = Math.sin(a); WU.uSun.value = THREE.MathUtils.smoothstep(el, -0.12, 0.25); WU.uSunDir.value.set(Math.cos(a), el, -0.25).normalize(); }
  stepCamera(real); stepLogo(real); stepGoalBeam(); stepAudio(!started ? above : P.pos.y > -0.2); /* sound follows your ears, not the camera */ stepHud(real);
  renderer.setRenderTarget(lowRT); renderer.render(scene, camera); renderer.setRenderTarget(cellRT); renderer.render(cellScene, cellCam); renderer.setRenderTarget(null); drawPanel(); composer.render();
  if (photo && photo.shot) { photo.shot = false; photo.savedT = photo.t; renderer.domElement.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `brackish-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`; a.click(); if (photoUrl) URL.revokeObjectURL(photoUrl); photoUrl = a.href; }, 'image/png'); }   /* the last photo's file is let go when the next is taken: no browser says when a download has finished reading it */   /* the frame just drawn, before it is cleared */
}

// seagrass (instanced blades in the shallows)
const GRASS_MAX = MOBILE ? 5000 : 14000;
const tuftGeo = mergeGeometries([0, 1, 2].map(i => new THREE.PlaneGeometry(0.045, 0.45 + i * 0.08).translate(0, 0.25 + i * 0.04, 0).rotateZ(0.18).rotateY(i * 2.09).toNonIndexed()), false);
const grass = new THREE.InstancedMesh(tuftGeo, mat({ side: THREE.DoubleSide,
  vertexShader: GLSL_COMMON + `varying float vD, vY, vU;
    void main(){ vec3 p = position; vec3 o = (instanceMatrix * vec4(0,0,0,1)).xyz; p.x += sin(uTime * 1.1 + o.x * 0.7 + o.z * 0.4) * uv.y * uv.y * 0.22; p.z += cos(uTime * 0.9 + o.x * 0.3) * uv.y * uv.y * 0.12;
      vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0); vY = w.y; vU = uv.y; vec4 mv = viewMatrix * w; vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
  uniforms: { uLift: { value: 0 } },
  fragmentShader: GLSL_COMMON + `uniform float uLift; varying float vD, vY, vU; void main(){ float b = (0.06 + uLift + 0.3 * vU * vU) * mix(0.4, 1.0, depthLight(vY)); gl_FragColor = outB(applyFog(b, vD)); }` }), GRASS_MAX);
grass.frustumCulled = false; grass.count = 0; scene.add(grass);
const ROCK_MAX = 1600, FAN_MAX = 1200;
const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), structMat, ROCK_MAX); rocks.frustumCulled = false; rocks.count = 0; scene.add(rocks);
const fanGeo = mergeGeometries([new THREE.CircleGeometry(0.55, 12, 0, Math.PI).translate(0, 0.35, 0).toNonIndexed(), new THREE.PlaneGeometry(0.05, 0.4).translate(0, 0.2, 0).toNonIndexed()], false);
const fanMat = grass.material.clone(); fanMat.uniforms.uTime = WU.uTime; fanMat.uniforms.uFogD = WU.uFogD; fanMat.uniforms.uFogB = WU.uFogB; fanMat.uniforms.uSun = WU.uSun; fanMat.uniforms.uSunDir = WU.uSunDir; fanMat.uniforms.uLift = { value: 0.14 };
const fans = new THREE.InstancedMesh(fanGeo, fanMat, FAN_MAX); fans.frustumCulled = false; fans.count = 0; scene.add(fans);
function rebuildGrass(px, pz) {
  const m = new THREE.Matrix4(), R = 70, step = 1.4; let k = 0; const cx = Math.round(px / step) * step, cz = Math.round(pz / step) * step;
  for (let z = cz - R; z <= cz + R && k < GRASS_MAX; z += step) for (let x = cx - R; x <= cx + R && k < GRASS_MAX; x += step) {
    if (hash2(x * 7, z * 13) > 0.2) continue; const f = floorAt(x, z); if (f > -0.4 || f < -5.5) continue;
    const jx = (hash2(x, z) - 0.5) * step, jz = (hash2(z, x) - 0.5) * step, s = 0.6 + hash2(x + 1, z + 1) * 0.9;
    m.makeRotationY(hash2(x + 3, z) * 6.28); m.scale(_sc.set(1, s, 1)); m.setPosition(x + jx, floorAt(x + jx, z + jz), z + jz); grass.setMatrixAt(k++, m);
  }
  grass.count = k; grass.instanceMatrix.needsUpdate = true; grassCenter.set(px, pz);
  // rocks where the bottom is steep (channel walls, the hole), sea fans on deeper hard bottom
  let kr = 0, kf = 0; const stepR = 2.2;
  for (let z = cz - R; z <= cz + R; z += stepR) for (let x = cx - R; x <= cx + R; x += stepR) {
    const f = floorAt(x, z); if (f > -1.2) continue;
    const slope = Math.abs(floorAt(x + 3, z) - floorAt(x - 3, z)) + Math.abs(floorAt(x, z + 3) - floorAt(x, z - 3));
    const h = hash2(x * 3 + 7, z * 5 + 1);
    if (kr < ROCK_MAX && slope > 0.9 && h < Math.min(0.6, slope * 0.25)) { const sz = 0.3 + hash2(x, z + 9) * (0.6 + slope * 0.4);
      m.makeRotationFromEuler(_e.set(hash2(x + 2, z) * 3, hash2(x, z + 2) * 6, 0)); m.scale(_sc.set(sz * 1.4, sz * 0.8, sz)); m.setPosition(x + (h - .5) * 2, f + sz * 0.35, z + (hash2(z, x) - .5) * 2); rocks.setMatrixAt(kr++, m); }
    else if (kf < FAN_MAX && f < -6 && slope < 0.5 && h > 0.955) { const sz = 0.5 + hash2(x + 5, z) * 1.2;
      m.makeRotationY(hash2(x + 3, z) * 6.28); m.scale(_sc.set(sz, sz, 1)); m.setPosition(x, f, z); fans.setMatrixAt(kf++, m); }
  }
  rocks.count = kr; rocks.instanceMatrix.needsUpdate = true; fans.count = kf; fans.instanceMatrix.needsUpdate = true;
}
