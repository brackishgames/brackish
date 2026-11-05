import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2 } from '../lib/rng.js?v=__BUILD__';
import { rand } from '../core/random.js?v=__BUILD__';
import { placeInstance } from '../core/space.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { emitBubble } from '../render/effects.js?v=__BUILD__';
import { creatureMat } from '../render/materials.js?v=__BUILD__';
import { floorAt, spotNear } from '../world/geo.js?v=__BUILD__';
import { birdGeometry } from './creatures.js?v=__BUILD__';
import { ABILITY, HP_MAX, P, abilityName } from './player.js?v=__BUILD__';
import { bloop, splash } from '../systems/audio.js?v=__BUILD__';
import { kn } from '../systems/input.js?v=__BUILD__';
import { started } from '../systems/story.js?v=__BUILD__';
import { say, tip } from '../ui/hud.js?v=__BUILD__';
import { _xz } from '../app/frame.js?v=__BUILD__';
// The bay's small life: moon jellies, clams and shrimp to eat, mullet schools, pelicans and gulls.
// moon jellies: slow, pulsing, harmless, lovely in the dark
export function jellyGeometry() {
  const bell = new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.6, 1);
  const parts = [bell];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; parts.push(new THREE.PlaneGeometry(0.02, 0.5).translate(0, -0.26, 0).rotateY(a).translate(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12)); }
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false);
}
export const JELLIES = 36;
export const jellyMesh = new THREE.InstancedMesh(jellyGeometry(), creatureMat({ mode: 5, freq: 1.4, glow: 0.85 }), JELLIES);
{ const ph = new Float32Array(JELLIES); for (let i = 0; i < JELLIES; i++) ph[i] = rand() * 6.28; jellyMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); }
jellyMesh.frustumCulled = false; scene.add(jellyMesh);
export const jellies = Array.from({ length: JELLIES }, () => ({ p: new THREE.Vector3(), ph: rand() * 6.28, s: 0.6 + rand() * 1.2 }));
export function stepJellies(dt, t) {
  for (let i = 0; i < JELLIES; i++) { const j = jellies[i];
    if (j.p.lengthSq() === 0 || j.p.distanceTo(P.pos) > 130) { const sp = spotNear(P.pos, 20, 110, 3); if (!sp) { placeInstance(jellyMesh, i, 0, 9999, 0); continue; } j.p.set(sp.x, sp.f * (0.3 + rand() * 0.5), sp.z); }
    const f = floorAt(j.p.x, j.p.z);
    j.p.y = THREE.MathUtils.clamp(j.p.y + Math.sin(t * 0.3 + j.ph) * 0.08 * dt + 0.02 * dt, f + 1, -1.5); j.p.x += Math.sin(t * 0.1 + j.ph) * 0.05 * dt; j.p.z += Math.cos(t * 0.13 + j.ph) * 0.05 * dt;
    placeInstance(jellyMesh, i, j.p.x, j.p.y, j.p.z, Math.sin(t * 0.4 + j.ph) * 0.2, j.ph, Math.cos(t * 0.3 + j.ph) * 0.2, j.s); }
  jellyMesh.instanceMatrix.needsUpdate = true;
}

// food: clam beds on the bottom give a heart back, shrimp clouds in mid-water refill the burst.
// they sit in fixed places (hashed by 60 m cell) so you can learn where they are; eaten ones stay eaten.
export const FOOD_MAX = 60, eaten = new Set();
export const foodMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.18, 1), creatureMat({ glow: 1.4 }), FOOD_MAX);
foodMesh.frustumCulled = false; foodMesh.count = 0; scene.add(foodMesh);
export let foodList = [], foodCenter = new THREE.Vector2(1e9, 1e9);
export function rebuildFood() {
  foodList = []; const C = 60, R = 240, cx = Math.floor(P.pos.x / C), cz = Math.floor(P.pos.z / C);
  for (let gz = cz - R / C; gz <= cz + R / C; gz++) for (let gx = cx - R / C; gx <= cx + R / C; gx++) {
    const h = hash2(gx * 31 + 11, gz * 17 + 5); if (h > 0.5) continue; const key = gx + ',' + gz; if (eaten.has(key)) continue;
    const x = (gx + 0.2 + hash2(gx, gz) * 0.6) * C, z = (gz + 0.2 + hash2(gz, gx) * 0.6) * C, f = floorAt(x, z); if (f > -1.5) continue;
    const clam = h < 0.3; foodList.push({ key, x, z, y: clam ? f + 0.25 : Math.max(f + 2, f * 0.5), clam, ph: h * 40 });
  }
  foodCenter.set(P.pos.x, P.pos.z);
}
export function stepFood(dt, t) {
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
export const GONE = new THREE.Vector3(0.001, 0.001, 0.001);
export function steerToSchool(s, tx, tz) { const want = Math.atan2(-(tx - s.c.x), -(tz - s.c.z)); let d = want - s.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); s.turn = THREE.MathUtils.clamp(d * 3, -2, 2); }
export const fishGeo = new THREE.BufferGeometry();
fishGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.14, 0, 0.045, 0.02, 0, -0.045, 0.02, 0, 0, 0.11, 0, 0.055, 0.17, 0, -0.055, 0.17], 3));
fishGeo.setIndex([0, 1, 2, 1, 3, 2, 3, 4, 5]);
export const SCHOOLS = 7, FISH_PER = 55;
export const fishMesh = new THREE.InstancedMesh(fishGeo, creatureMat({ glow: 0.8 }), SCHOOLS * FISH_PER);
fishMesh.frustumCulled = false; scene.add(fishMesh);
export const schools = Array.from({ length: SCHOOLS }, () => ({ c: new THREE.Vector3(), dir: rand() * 6.28, turn: 0, v: 0.6 + rand() * 0.6, spread: 2.5 + rand() * 3, base: 0, panic: 0,
  fish: Array.from({ length: FISH_PER }, () => ({ off: new THREE.Vector3(rand() - .5, (rand() - .5) * 0.5, rand() - .5), ph: rand() * 6.28, w: 0.4 + rand() * 0.5, alive: true })) }));

// birds: pelican lines and gull wheels, above the surface
export const BIRDS = 96;   // 90 in flocks + 6 slots for diving pelicans
export const birdMesh = new THREE.InstancedMesh(birdGeometry(), creatureMat({ mode: 4, freq: 3.2, amp: 0.5, glow: 1 }), BIRDS);
{ const ph = new Float32Array(BIRDS); for (let i = 0; i < BIRDS; i++) ph[i] = rand() * 6.28; birdMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); }
birdMesh.frustumCulled = false; scene.add(birdMesh);
export const dives = [];
// Pelicans fold and plunge on mullet when you're up near the surface with a school close by.
export function stepDives(dt, t) {
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
export const flocks = Array.from({ length: 6 }, (_, i) => ({ c: new THREE.Vector3(), dir: rand() * 6.28, kind: i < 3 ? 'line' : 'wheel', n: 15, h: 3 + rand() * 25, ph: rand() * 6 }));
