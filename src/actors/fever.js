import * as THREE from 'three';
import { MOBILE } from '../core/env.js?v=__BUILD__';
import { rand } from '../core/random.js?v=__BUILD__';
import { placeInstance } from '../core/space.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { creatureMat } from '../render/materials.js?v=__BUILD__';
import { FEVER_PATH, floorAt } from '../world/geo.js?v=__BUILD__';
import { rayGeometry, speciesById } from './creatures.js?v=__BUILD__';
import { P } from './player.js?v=__BUILD__';
import { PREDATORS, wild } from './wildlife.js?v=__BUILD__';
// the fever: ~1200 cownose rays, instanced, phase-offset flapping
export const FEVER_N = MOBILE ? 500 : 1200;
export const feverMesh = new THREE.InstancedMesh(rayGeometry(speciesById.cownose, 8, 6), creatureMat({ lite: true, mode: 1, half: 0.45, len: 0.6, freq: 2.6, amp: 0.55, glow: 0.9 }), FEVER_N);
{ const ph = new Float32Array(FEVER_N); for (let i = 0; i < FEVER_N; i++) ph[i] = rand() * 6.28; feverMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); }
feverMesh.frustumCulled = false; scene.add(feverMesh);
export const fever = { c: new THREE.Vector3(FEVER_PATH[0][0], -3, FEVER_PATH[0][1]), seg: 0, t: 0, moving: false, yaw: 0, speed: 1.0,
  off: Array.from({ length: FEVER_N }, () => { const a = rand() * 6.28, r = Math.sqrt(rand()); return new THREE.Vector3(Math.cos(a) * r * 60, (rand() - 0.5) * 5, Math.sin(a) * r * 45); }) };
// 0 at the heart of the fever, 1 at its edge, large when you are nowhere near it
export function feverR(p) { if (Math.abs(p.y - fever.c.y) > 6) return 9; const dx = p.x - fever.c.x, dz = p.z - fever.c.z, cs = Math.cos(-(fever.spin || 0)), sn = Math.sin(-(fever.spin || 0));
  return Math.hypot((dx * cs - dz * sn) / 60, (dx * sn + dz * cs) / 45); }
export function stepFever(dt, t) {
  if (fever.moving && fever.seg + 1 < FEVER_PATH.length) {
    const [ax, az] = FEVER_PATH[fever.seg], [bx, bz] = FEVER_PATH[fever.seg + 1], len = Math.hypot(bx - ax, bz - az);
    fever.t += fever.speed * dt / len; if (fever.t >= 1) { fever.t = 0; fever.seg++; }
    fever.c.x = ax + (bx - ax) * fever.t; fever.c.z = az + (bz - az) * fever.t; fever.yaw = Math.atan2(-(bx - ax), -(bz - az));
  }
  const f = floorAt(fever.c.x, fever.c.z); fever.c.y = THREE.MathUtils.clamp(f * 0.5 - 1, f + 1.5, -2);
  feverMesh.visible = fever.c.distanceTo(P.pos) < 400; if (!feverMesh.visible) return;   // beyond the murk: don't move 1200 rays nobody can see
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
