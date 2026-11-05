import * as THREE from 'three';
import { toXZ } from '../lib/geo.js?v=__BUILD__';
import { DEV } from '../core/env.js?v=__BUILD__';
import { rand } from '../core/random.js?v=__BUILD__';
import { _f, _s, fwdInto, fwdOf } from '../core/space.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { emitBubble } from '../render/effects.js?v=__BUILD__';
import { GLSL_COMMON, mat } from '../render/materials.js?v=__BUILD__';
import { CHANNEL, floorAt, isWater, spotNear } from '../world/geo.js?v=__BUILD__';
import { BOAT_TYPES, boatMat } from '../world/structures.js?v=__BUILD__';
import { isNight } from '../world/time.js?v=__BUILD__';
import { P, hurt } from './player.js?v=__BUILD__';
import { stab } from '../systems/audio.js?v=__BUILD__';
import { rumble } from '../systems/input.js?v=__BUILD__';
import { started } from '../systems/story.js?v=__BUILD__';
import { say } from '../ui/hud.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  BOATS  —  ships work the channel, small craft wander the flats.
//  You hear them before you see them. Near the surface they can hit you.
// ═══════════════════════════════════════════════════════════════════
export const UP = new THREE.Vector3(0, 1, 0);
export const boats = [];
export function addBoat(type, route) {
  const t = BOAT_TYPES[type], m = new THREE.Mesh(t.geo, boatMat); m.frustumCulled = false; scene.add(m);
  boats.push({ type: t, mesh: m, pos: new THREE.Vector3(), yaw: 0, route, seg: 0, dir: 1, u: rand(), turn: 0, bob: rand() * 6 });
}
addBoat('ship', CHANNEL); addBoat('ship', CHANNEL); boats[1].dir = -1; boats[1].seg = CHANNEL.length - 2;
for (let i = 0; i < 5; i++) addBoat('skiff', null); for (let i = 0; i < 3; i++) addBoat('cruiser', null);
export function stepBoats(dt, t) {
  for (const b of boats) {
    if (b.route) {
      const i = b.seg, [ax, az] = b.route[i], [bx, bz] = b.route[i + 1], len = Math.hypot(bx - ax, bz - az);
      b.u += b.dir * b.type.speed * dt / len;
      if (b.u > 1) { if (i + 2 < b.route.length) { b.seg++; b.u = 0; } else { b.dir = -1; b.u = 1; } }
      if (b.u < 0) { if (i > 0) { b.seg--; b.u = 1; } else { b.dir = 1; b.u = 0; } }
      b.pos.set(ax + (bx - ax) * b.u, 0, az + (bz - az) * b.u); b.yaw = Math.atan2(-(bx - ax) * b.dir, -(bz - az) * b.dir);
    } else {
      if (b.pos.lengthSq() === 0 || b.pos.distanceTo(P.pos) > 700) { const sp = spotNear(P.pos, 150, 500, 2, 20); if (sp) { b.pos.set(sp.x, 0, sp.z); b.yaw = rand() * 6.28; } }
      b.turn += (rand() - 0.5) * dt; b.turn *= 0.98;
      fwdInto(_f, b.yaw).multiplyScalar(60).add(b.pos); if (!isWater(_f.x, _f.z, 2)) b.turn += 1.2 * dt;
      b.yaw += b.turn * dt; b.pos.addScaledVector(fwdInto(_f, b.yaw), b.type.speed * dt);
    }
    b.pos.y = Math.sin(t * 1.3 + b.bob) * 0.12;
    b.mesh.position.copy(b.pos); b.mesh.rotation.set(Math.sin(t * 0.9 + b.bob) * 0.015, b.yaw, Math.sin(t * 1.1 + b.bob) * 0.03);
    if (b.pos.distanceTo(P.pos) < 220) for (let i = 0; i < (b.type === BOAT_TYPES.ship ? 3 : 1); i++) { const back = fwdOf(b.yaw, 0).multiplyScalar(-b.type.L * (0.45 + rand() * 0.6)); emitBubble(b.pos.x + back.x + (rand() - .5) * b.type.W, -b.type.draft * (0.2 + rand() * 0.9), b.pos.z + back.z); }
    // hull frame: strike, bow-wave shove, prop wash
    const dist = b.pos.distanceTo(P.pos);
    if (dist < b.type.L + 60 && P.vel) {
      const rel = _s.copy(P.pos).sub(b.pos).applyAxisAngle(UP, -b.yaw), W = b.type.W, L = b.type.L, big = b.type === BOAT_TYPES.ship;
      if (P.stun <= 0 && Math.abs(rel.x) < W / 2 + 0.6 && Math.abs(rel.z) < L / 2 + 1 && P.pos.y > -b.type.draft - 0.8) strike(b);
      const nearHull = Math.abs(rel.z) < L / 2 + 12 && Math.abs(rel.x) < W / 2 + (big ? 18 : 6) && P.pos.y > -b.type.draft - (big ? 6 : 2);
      if (nearHull) {   // the displaced water pushes you out and down
        const side = Math.sign(rel.x || 1), fall = 1 - Math.min(1, (Math.abs(rel.x) - W / 2) / (big ? 18 : 6));
        P.vel.addScaledVector(_f.set(side * Math.cos(b.yaw), 0, -side * Math.sin(b.yaw)), b.type.speed * 0.5 * fall * dt * 4); P.vel.y -= fall * (big ? 2.5 : 0.8) * dt;
        P.shake = Math.max(P.shake || 0, fall * (big ? 0.6 : 0.2));
      }
      const astern = rel.z > L / 2 - 2 && rel.z < L / 2 + (big ? 90 : 25) && Math.abs(rel.x) < W * 0.8 && P.pos.y > -b.type.draft - 4;
      if (astern) {   // prop wash: turbulence, a shove astern, a lot of air
        const k = 1 - (rel.z - L / 2) / (big ? 90 : 25);
        P.vel.x += (rand() - 0.5) * 6 * k * dt; P.vel.y += (rand() - 0.3) * 5 * k * dt; P.vel.z += (rand() - 0.5) * 6 * k * dt;
        P.vel.addScaledVector(fwdInto(_f, b.yaw), -b.type.speed * 0.35 * k * dt * 3);
        P.shake = Math.max(P.shake || 0, k * (big ? 0.8 : 0.3)); P.wash = Math.max(P.wash || 0, k); if (rand() < 0.1) rumble(0.1, 0.5 * k, 120);
        for (let i = 0; i < (big ? 4 : 1); i++) emitBubble(P.pos.x + (rand() - .5) * 3, P.pos.y + (rand() - .5) * 2, P.pos.z + (rand() - .5) * 3);
      }
    }
  }
}
export function nearestBoat() { let best = null, bd = 1e9; for (const b of boats) { const d = b.pos.distanceTo(P.pos); if (d < bd) { bd = d; best = b; } } return { b: best, d: bd }; }
// ── night gigging: a skiff poled over the flats with a light shining on the bottom. what the light finds, the gig takes.
//    giggers look for exactly a ray's outline. a gig reaches about two metres; deeper water or darkness is safe.
export const gigLight = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0), mat({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: GLSL_COMMON + `varying float vY; void main(){ float b = 0.3 * (1.0 + vY) * (0.9 + 0.1 * sin(uTime * 7.0)); gl_FragColor = outB(b); }` }));
gigLight.frustumCulled = false; gigLight.visible = false; scene.add(gigLight);
export const gig = { on: false, pos: new THREE.Vector3(), bow: new THREE.Vector3(), yaw: 0, turn: 0, inT: 0, strikeT: 0, mesh: new THREE.Mesh(BOAT_TYPES.skiff.geo, boatMat) };
gig.mesh.visible = false; gig.mesh.frustumCulled = false; scene.add(gig.mesh);
if (DEV) window.__bay = { floorAt: (lat, lon) => floorAt(...toXZ(lat, lon)) };   // local dev only: lets tools check depths
export function stepGig(dt, t) {
  if (!gig.on) { if (isNight() && started && rand() < dt / 25) { const sp = spotNear(P.pos, 70, 170, 0.5, 24); if (sp && sp.f > -2.2) { if (DEV) console.log('[gig] a light out on the flats'); gig.on = true; gig.pos.set(sp.x, 0, sp.z); gig.yaw = rand() * 6.28; gig.inT = 0; } } }
  else if (!isNight() || gig.pos.distanceTo(P.pos) > 300) gig.on = false;
  gig.mesh.visible = gigLight.visible = gig.on; P.lit = false; if (!gig.on) return;
  // poled along the flats at a walk, turning back from the channel edge and the sand bars
  const ahead = fwdOf(gig.yaw).multiplyScalar(12).add(gig.pos), fa = floorAt(ahead.x, ahead.z);
  gig.turn += (rand() - 0.5) * dt; gig.turn *= 0.98; if (fa < -2.6 || fa > -0.3) gig.turn += 0.8 * dt;
  gig.yaw += gig.turn * 0.4 * dt; gig.pos.addScaledVector(fwdOf(gig.yaw), 0.7 * dt); gig.pos.y = Math.sin(t * 1.2) * 0.05;
  gig.mesh.position.copy(gig.pos); gig.mesh.rotation.set(0, gig.yaw, Math.sin(t * 0.9) * 0.02);
  gig.bow.copy(fwdOf(gig.yaw)).multiplyScalar(2.5).add(gig.pos); const f = floorAt(gig.bow.x, gig.bow.z), depth = Math.max(0.5, -f), rad = 1.1 + depth * 0.45;
  gigLight.position.set(gig.bow.x, 0.6, gig.bow.z); gigLight.scale.set(rad, depth + 0.6, rad);
  const r = Math.hypot(P.pos.x - gig.bow.x, P.pos.z - gig.bow.z); P.lit = r < rad && P.pos.y > -2.6;
  if (P.lit) { gig.inT += dt; if (!gig.warned) { gig.warned = true; say('a light on the water. get out of it.', 2); } } else { gig.inT = Math.max(0, gig.inT - dt * 0.5); if (gig.inT === 0) gig.warned = false; }
  gig.strikeT = Math.max(0, gig.strikeT - dt);
  if (P.lit && gig.inT > 1.4 && gig.strikeT <= 0) {   // a second and a half in the light is all they need to see you
    gig.strikeT = 3; gig.inT = 0.5; stab(gig.bow.x, gig.bow.z);
    for (let i = 0; i < 14; i++) { const k = i / 14; emitBubble(gig.bow.x + (P.pos.x - gig.bow.x) * k, P.pos.y * k, gig.bow.z + (P.pos.z - gig.bow.z) * k); }
    if (r < 0.8 + (P.sp.span ?? P.sp.len) * 0.35 && P.stun <= 0) hurt(0.6, 'GIGGED\nthey look for your outline in the light. stay out of it.'); else say('it missed', 1.2);
  }
}
export function strike(b) {
  hurt(b.type === BOAT_TYPES.ship ? 1.2 : 0.7, `STRUCK BY A ${b.type.name.toUpperCase()}\nDIVE WHEN THE WATER HUMS`);
  if (P.vel) { P.vel.addScaledVector(fwdOf(b.yaw), b.type.speed * 0.8); P.vel.y = -(b.type === BOAT_TYPES.ship ? 5 : 2.5); }
}
