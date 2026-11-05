import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeGrid } from '../lib/collide.js?v=__BUILD__';
import { toXZ } from '../lib/geo.js?v=__BUILD__';
import { rand } from '../core/random.js?v=__BUILD__';
import { _E, _M, _s, fwdOf } from '../core/space.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { creatureMat } from '../render/materials.js?v=__BUILD__';
import { ANCHORAGE, CHANNEL, SKYWAY, WRECKS, floorAt } from './geo.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  STRUCTURES  —  bridges (OSM geometry: pilings to the bottom, decks
//  above), channel buoys with chains, wrecks and rubble. Built after data.
// ═══════════════════════════════════════════════════════════════════
export const structMat = creatureMat({ glow: 0.62 });
export let bridges = [];   // [{ name, pts:[[x,z],...] }]: the built-in set, then OpenStreetMap's (18-boot.js)
export function setBridges(list) { bridges = list; }
export function hullGeometry(L, W, draft, free, cabin = true) {
  const parts = [new THREE.BoxGeometry(W, draft + free, L * 0.78).translate(0, (free - draft) / 2, L * 0.11)];
  parts.push(new THREE.ConeGeometry(W / 2, L * 0.3, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 4).scale(1, (draft + free) / W, 1).translate(0, (free - draft) / 2, -L * 0.42));
  if (cabin) parts.push(new THREE.BoxGeometry(W * 0.7, free * 1.6, L * 0.25).translate(0, free + free * 0.8, L * 0.25));
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false);
}
export const boatMat = creatureMat({ glow: 0.45 });   // hulls afloat: a little dimmer than the wrecks' steel
export const BOAT_TYPES = {
  ship: { L: 180, W: 28, draft: 9, free: 8, speed: 6.5, name: 'cargo ship' },
  cruiser: { L: 12, W: 4, draft: 1.1, free: 1.2, speed: 8, name: 'cruiser' },
  skiff: { L: 6, W: 2.2, draft: 0.5, free: 0.7, speed: 11, name: 'skiff' },
};
for (const t of Object.values(BOAT_TYPES)) t.geo = hullGeometry(t.L, t.W, t.draft, t.free, t !== BOAT_TYPES.skiff);

export function buildStructures() {
  for (const m of world.meshes) { scene.remove(m); if (m.userData.own) { m.geometry.dispose(); m.dispose?.(); } }   // a rebuild frees what the last one built (hull shapes are shared, so they stay)
  world.meshes = []; world.buoys = []; world.wrecks = []; world.colliders = makeGrid(40); world.solids = [];
  const add = (m, own = true) => { m.frustumCulled = false; m.userData.own = own; scene.add(m); world.meshes.push(m); return m; };
  const solid = c => { world.colliders.add(c); world.solids.push(c); };   // what you can't swim through: src/lib/collide.js
  const M = new THREE.Matrix4(), piles = [], decks = [];
  for (const br of bridges) {
    for (let i = 0; i + 1 < br.pts.length; i++) {
      const [ax, az] = br.pts[i], [bx, bz] = br.pts[i + 1], len = Math.hypot(bx - ax, bz - az); if (len < 1) continue;
      const nx = (bz - az) / len, nz = -(bx - ax) / len;
      for (let d = 0; d < len; d += 40) {
        const x = ax + (bx - ax) * d / len, z = az + (bz - az) * d / len;
        for (const o of [-5, 5]) { const px = x + nx * o, pz = z + nz * o, f = floorAt(px, pz);
          if (f > -0.4 || f < -11.5) continue;   // no piers on land, none in the navigation span
          piles.push({ x: px, z: pz, f }); }
      }
      // deck: a slab 7 m over the water (14 m at the Skyway main span), seen from the surface
      const mid = Math.max(0, -floorAt((ax + bx) / 2, (az + bz) / 2)), h = 6 + Math.min(40, mid * 3.5);
      decks.push({ x: (ax + bx) / 2, z: (az + bz) / 2, len, yaw: Math.atan2(bx - ax, bz - az), h });
    }
  }
  const pileMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.3, 1, 8).translate(0, 0.5, 0), structMat, Math.max(1, piles.length));
  piles.forEach((p, i) => { M.makeScale(1, -p.f + 2.5, 1); M.setPosition(p.x, p.f - 1, p.z); pileMesh.setMatrixAt(i, M); solid({ kind: 'c', x: p.x, z: p.z, r: 1.3, y0: p.f - 1, y1: 1.5 }); });
  pileMesh.count = piles.length; add(pileMesh);
  const deckMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 1.6, 1), structMat, Math.max(1, decks.length));
  decks.forEach((d, i) => { M.makeRotationY(d.yaw); M.scale(_s.set(1, 1, d.len)); M.setPosition(d.x, d.h, d.z); deckMesh.setMatrixAt(i, M); solid({ kind: 'b', x: d.x, z: d.z, hx: 7, hz: d.len / 2, yaw: d.yaw, y0: d.h - 0.8, y1: d.h + 0.8 }); });   // only a leap reaches a deck
  deckMesh.count = decks.length; add(deckMesh);

  // channel markers: buoy at the surface, chain to a sinker on the bottom
  const buoys = [];
  for (let i = 0; i + 1 < CHANNEL.length; i++) {
    const [ax, az] = CHANNEL[i], [bx, bz] = CHANNEL[i + 1], len = Math.hypot(bx - ax, bz - az), nx = (bz - az) / len, nz = -(bx - ax) / len;
    for (let d = 0; d < len; d += 700) for (const o of [-110, 110]) { const x = ax + (bx - ax) * d / len + nx * o, z = az + (bz - az) * d / len + nz * o, f = floorAt(x, z); if (f < -1.5) buoys.push({ x, z, f, ph: rand() * 6 }); }
  }
  const buoyMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 3.2, 8).translate(0, 0.6, 0), structMat, Math.max(1, buoys.length));
  const chainMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 5).translate(0, 0.5, 0), structMat, Math.max(1, buoys.length));
  const sinkerMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), structMat, Math.max(1, buoys.length));
  buoys.forEach((b, i) => { M.makeRotationZ(0.06); M.scale(_s.set(1, -b.f, 1)); M.setPosition(b.x, b.f, b.z); chainMesh.setMatrixAt(i, M);
    M.makeTranslation(b.x, b.f + 0.6, b.z); sinkerMesh.setMatrixAt(i, M);
    solid({ kind: 'c', x: b.x, z: b.z, r: 1.4, y0: b.f, y1: b.f + 1.2 }); solid({ kind: 'c', x: b.x, z: b.z, r: 1.1, y0: -1.2, y1: 2.5 }); });   // the sinker on the bottom, the buoy at the top
  buoyMesh.count = chainMesh.count = sinkerMesh.count = buoys.length;
  for (const m of [buoyMesh, chainMesh, sinkerMesh]) add(m);
  world.buoys = buoys; world.buoyMesh = buoyMesh;

  // the Skyway main piers and their dolphins
  { const [ax, az] = toXZ(...SKYWAY.axis[0]), [bx, bz] = toXZ(...SKYWAY.axis[1]), L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, [cx, cz] = toXZ(...SKYWAY.center);
    const pier = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), structMat, 2), ring = new THREE.InstancedMesh(new THREE.CylinderGeometry(6, 7, 1, 16).translate(0, 0.5, 0), structMat, SKYWAY.dolphins * 2);
    let k = 0;
    [-1, 1].forEach((sgn, i) => { const px = cx + ux * sgn * SKYWAY.span / 2, pz = cz + uz * sgn * SKYWAY.span / 2, f = floorAt(px, pz);
      _M.makeRotationY(Math.atan2(ux, uz)); _M.scale(_s.set(14, -f + 60, 9)); _M.setPosition(px, (f + 60) / 2, pz); pier.setMatrixAt(i, _M); solid({ kind: 'b', x: px, z: pz, hx: 7, hz: 4.5, yaw: Math.atan2(ux, uz), y0: f, y1: 60 });
      for (let d = 0; d < SKYWAY.dolphins; d++) { const a = d / SKYWAY.dolphins * Math.PI * 2, r = 32, dx = px + Math.cos(a) * r, dz = pz + Math.sin(a) * r, df = floorAt(dx, dz);
        _M.makeScale(1, -df + 2.5, 1); _M.setPosition(dx, df, dz); ring.setMatrixAt(k++, _M); solid({ kind: 'c', x: dx, z: dz, r: 7, y0: df, y1: 2.5 }); } });
    ring.count = k; add(pier); add(ring); world.wrecks.push({ x: cx, z: cz, name: 'Skyway main span' }); }
  // ships riding at anchor, chain down into the dark
  for (const an of ANCHORAGE) { const [x, z] = toXZ(...an.ll), f = floorAt(x, z), t = BOAT_TYPES.ship, hull = new THREE.Mesh(t.geo, boatMat); hull.position.set(x, 0, z); hull.rotation.y = an.yaw; add(hull, false); solid({ kind: 'b', x, z, hx: t.W / 2, hz: t.L / 2, yaw: an.yaw, y0: -t.draft, y1: t.free });
    const bow = fwdOf(an.yaw).multiplyScalar(t.L * 0.45), chain = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 6).translate(0, -0.5, 0), structMat);
    const top = new THREE.Vector3(x + bow.x, -1, z + bow.z), bottom = new THREE.Vector3(x + bow.x * 2.2, f, z + bow.z * 2.2); chain.position.copy(top); chain.scale.y = top.distanceTo(bottom); chain.lookAt(bottom); chain.rotateX(-Math.PI / 2); add(chain);
    world.wrecks.push({ x, z, name: 'Egmont anchorage' }); }
  // wrecks and rubble
  for (const w of WRECKS) {
    const [x, z] = toXZ(...w.ll), f = floorAt(x, z); if (f > -1) continue;
    if (w.kind === 'ruins') { const n = 22, g = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), structMat, n);   // poured-concrete batteries, tilted and broken
      for (let i = 0; i < n; i++) { const rx = x + (rand() - .5) * 70, rz = z + (rand() - .5) * 50, sx = 4 + rand() * 9, sy = 2 + rand() * 4;
        _M.makeRotationFromEuler(_E.set((rand() - .5) * 0.9, rand() * 6, (rand() - .5) * 0.9)); const sz = 3 + rand() * 6, fy = floorAt(rx, rz); _M.scale(_s.set(sx, sy, sz)); _M.setPosition(rx, fy + sy * 0.3, rz); g.setMatrixAt(i, _M); solid({ kind: 'c', x: rx, z: rz, r: Math.max(sx, sz) * 0.45, y0: fy, y1: fy + sy * 0.8 }); }
      add(g); world.wrecks.push({ x, z, name: w.name }); continue; }
    if (w.kind === 'rubble') { const n = 14, g = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), structMat, n);
      for (let i = 0; i < n; i++) { const rx = x + (rand() - .5) * 40, rz = z + (rand() - .5) * 40, s = 2 + rand() * 5; M.makeRotationFromEuler(_E.set(rand(), rand() * 6, rand())); M.scale(_s.set(s, s * 0.6, s * 1.5)); const fy = floorAt(rx, rz); M.setPosition(rx, fy + s * 0.2, rz); g.setMatrixAt(i, M); solid({ kind: 'c', x: rx, z: rz, r: s * 0.7, y0: fy, y1: fy + s * 0.6 }); }
      add(g); }
    else { const t = BOAT_TYPES[w.kind], m = new THREE.Mesh(t.geo, structMat); m.scale.setScalar(w.s); m.position.set(x, f + t.draft * w.s * 0.6, z); m.rotation.set(0.15, rand() * 6, w.rest ?? (0.55 + rand() * 0.4)); add(m, false); solid({ kind: 'b', x, z, hx: t.W * w.s / 2, hz: t.L * w.s / 2, yaw: m.rotation.y, y0: f, y1: f + (t.draft + t.free) * w.s }); }
    world.wrecks.push({ x, z, name: w.name });
  }
}
export const world = { buoys: [], wrecks: [], buoyMesh: null, meshes: [], colliders: null, solids: [] };
