import * as THREE from 'three';
import { makeGrid } from '../lib/collide.js?v=__BUILD__';
import { toXZ } from '../lib/geo.js?v=__BUILD__';
import { box, foil, join, pod, propeller, tube } from '../lib/shapes.js?v=__BUILD__';
import { rand } from '../core/random.js?v=__BUILD__';
import { _E, _M, _s, fwdOf } from '../core/space.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { creatureMat } from '../render/materials.js?v=__BUILD__';
import { SKYWAY_SPEC, TRESTLE, clearanceOf, isSkyway, skywayStations, skywayUnderside } from './bridges.js?v=__BUILD__';
import { ANCHORAGE, CHANNEL, SKYWAY, WRECKS, floorAt } from './geo.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  STRUCTURES  —  bridges (OSM geometry: pilings to the bottom, decks
//  above), channel buoys with chains, wrecks and rubble. Built after data.
// ═══════════════════════════════════════════════════════════════════
export const structMat = creatureMat({ glow: 0.62 });
export let bridges = [];   // [{ name, pts:[[x,z],...] }]: the built-in set, then OpenStreetMap's (18-boot.js)
export function setBridges(list) { bridges = list; }
// a hull you could believe from any side, and in this game you mostly see them from below: a real section (flat and full for a freighter, a deep V for a small boat), a bow that narrows and lifts, a run that rises aft to clear the propeller and rudder, a keel, and what sits on deck
export function hullGeometry(L, W, draft, free, kind = 'ship') {
  const ship = kind === 'ship', skiff = kind === 'skiff', vee = ship ? 0.3 : 0.85, entry = ship ? 0.22 : 0.42, along = 44, around = 15, pos = [], idx = [];
  const rim = []; for (let j = 0; j <= along; j++) { const s = j / along, w = W / 2 * Math.pow(Math.min(1, s / entry), ship ? 0.55 : 0.7) * Math.min(1, 0.72 + (1 - s) * 2.8), sheer = free * (1 + 0.55 * (1 - s) * (1 - s) * (1 - s)), run = 1 - (ship ? 0.72 : 0.5) * THREE.MathUtils.smoothstep(s, 0.84, 0.985), deep = draft * Math.min(1, 0.25 + s * 3) * run, z = (s - 0.5) * L; rim.push([w, sheer, z]);
    for (let i = 0; i <= around; i++) { const a = i / around * Math.PI, sa = i === 0 || i === around ? 0 : Math.sin(a); pos.push(Math.cos(a) * w, sheer - (sheer + deep) * Math.pow(sa, vee), z); } }   // exactly at the rim, so hull and deck meet
  for (let j = 0; j < along; j++) for (let i = 0; i < around; i++) { const a = j * (around + 1) + i, c = a + around + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
  const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0.5), 2)); hull.setIndex(idx); hull.computeVertexNormals();
  const floorY = skiff ? free * 0.3 : null, wall = skiff ? 0.9 : 1, deck = [], quad = (a, b, c, d) => deck.push(...a, ...c, ...b, ...b, ...c, ...d); for (let j = 0; j < along; j++) { const p = rim[j], q = rim[j + 1];
    if (skiff) for (const sx of [1, -1]) { quad([sx * p[0], p[1], p[2]], [sx * q[0], q[1], q[2]], [sx * p[0] * wall, p[1], p[2]], [sx * q[0] * wall, q[1], q[2]]); quad([sx * p[0] * wall, p[1], p[2]], [sx * q[0] * wall, q[1], q[2]], [sx * p[0] * wall, floorY, p[2]], [sx * q[0] * wall, floorY, q[2]]); }   // an open boat: a gunwale, sides you can see inside, and a sole
    quad([p[0] * wall, floorY ?? p[1], p[2]], [q[0] * wall, floorY ?? q[1], q[2]], [-p[0] * wall, floorY ?? p[1], p[2]], [-q[0] * wall, floorY ?? q[1], q[2]]); }
  const lid = new THREE.BufferGeometry(); lid.setAttribute('position', new THREE.Float32BufferAttribute(deck, 3)); lid.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(deck.length / 3 * 2).fill(0.5), 2)); lid.computeVertexNormals();
  const parts = [hull, lid], bot = -draft;
  // the transom, closing the stern
  { const st = rim[along], tr = []; for (let i = 0; i < around; i++) { const a = pos.slice((along * (around + 1) + i) * 3, (along * (around + 1) + i) * 3 + 3), b = pos.slice((along * (around + 1) + i + 1) * 3, (along * (around + 1) + i + 1) * 3 + 3); tr.push(...a, ...b, ...pos.slice(along * (around + 1) * 3, along * (around + 1) * 3 + 3)); } const t = new THREE.BufferGeometry(); t.setAttribute('position', new THREE.Float32BufferAttribute(tr, 3)); t.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(tr.length / 3 * 2).fill(0.5), 2)); t.computeVertexNormals(); parts.push(t); }
  if (ship) {   // below: a bulbous bow, bilge keels, one great propeller and a rudder. above: hatch covers and container stacks, two cranes, a bridge with its wings, lifeboats, a funnel
    parts.push(pod(W * 0.13, draft * 0.26, L * 0.05).translate(0, bot * 0.62, -L * 0.47));
    for (const sx of [-1, 1]) parts.push(box(W * 0.02, draft * 0.08, L * 0.32, sx * W * 0.47, bot * 0.8, L * 0.02));
    parts.push(propeller(draft * 0.42, 5, [0, bot * 0.55, L * 0.455]), tube([[0, bot * 0.55, L * 0.41], [0, bot * 0.55, L * 0.455]], [draft * 0.05], 8), foil([0, bot * 0.2, L * 0.475], [0, bot * 0.2, L * 0.497], [0, bot * 0.95, L * 0.49], { bow: 0, draw: 0, thick: 0.06, span: 3, chord: 2 }));
    for (let i = 0; i < 7; i++) { const h = free * (1 + (i % 3) * 0.35), z = L * (-0.3 + i * 0.095); parts.push(box(W * 0.84, free * 0.2, L * 0.085, 0, free * 1.1, z), box(W * 0.8, h, L * 0.08, 0, free * 1.2 + h / 2, z)); }
    for (const z of [-0.19, 0.0, 0.2]) parts.push(tube([[W * 0.42, free, L * z], [W * 0.42, free * 3.4, L * z]], [W * 0.018, W * 0.012], 6), tube([[W * 0.42, free * 3.2, L * z], [-W * 0.1, free * 2.9, L * (z + 0.02)]], [W * 0.01, W * 0.005], 5));
    parts.push(box(W * 0.86, free * 2.6, L * 0.09, 0, free * 2.3, L * 0.38), box(W * 1.02, free * 0.26, L * 0.035, 0, free * 3.55, L * 0.345), box(W * 0.6, free * 0.5, L * 0.05, 0, free * 3.9, L * 0.37), new THREE.CylinderGeometry(W * 0.07, W * 0.09, free * 1.5, 16).translate(0, free * 4.1, L * 0.43), tube([[0, free * 4.2, L * 0.37], [0, free * 5, L * 0.37]], [W * 0.01], 5));
    for (const sx of [-1, 1]) parts.push(pod(W * 0.035, W * 0.035, L * 0.018, 10, 7).translate(sx * W * 0.47, free * 2, L * 0.39));
  } else if (kind === 'cruiser') {   // below: a keel, spray rails, twin shafts on struts with their propellers and rudders. above: a raked cabin, a flybridge with its screen, a bow rail, a radar arch, a swim platform
    parts.push(box(W * 0.03, draft * 0.3, L * 0.62, 0, bot * 1.05, L * -0.02));
    for (const sx of [-1, 1]) { parts.push(box(W * 0.02, draft * 0.05, L * 0.66, sx * W * 0.28, bot * 0.25, -L * 0.04)); const x = sx * W * 0.2, y = bot * 0.75; parts.push(tube([[x, bot * 0.5, L * 0.18], [x, y, L * 0.44]], [draft * 0.035], 6), propeller(draft * 0.24, 4, [x, y, L * 0.445]), foil([x, bot * 0.42, L * 0.462], [x, bot * 0.42, L * 0.49], [x, bot * 0.92, L * 0.48], { bow: 0, draw: 0, thick: 0.08, span: 2, chord: 2 }), box(W * 0.02, draft * 0.28, L * 0.012, x, bot * 0.62, L * 0.38)); }
    const cabin = box(W * 0.68, free * 1.1, L * 0.34, 0, free * 1.55, L * 0.02), q = cabin.attributes.position; for (let i = 0; i < q.count; i++) if (q.getY(i) > free * 1.8 && q.getZ(i) < 0) q.setZ(i, q.getZ(i) + L * 0.09); cabin.computeVertexNormals();
    parts.push(cabin, box(W * 0.56, free * 0.1, L * 0.2, 0, free * 2.14, L * 0.06), box(W * 0.3, free * 0.42, free * 0.02 + L * 0.004, 0, free * 2.35, -L * 0.03), box(W * 0.74, free * 0.08, L * 0.05, 0, free * 0.5, L * 0.49));
    for (const sx of [-1, 1]) parts.push(tube([[sx * W * 0.28, free * 2.2, -L * 0.25], [sx * W * 0.18, free * 2, -L * 0.42], [0, free * 1.95, -L * 0.48]], [L * 0.0015], 5), tube([[sx * W * 0.2, free * 2.18, L * 0.14], [sx * W * 0.12, free * 3.1, L * 0.16]], [L * 0.003], 5));
    parts.push(tube([[-W * 0.12, free * 3.1, L * 0.16], [W * 0.12, free * 3.1, L * 0.16]], [L * 0.003], 5));
  } else {   // a skiff: open, with a keel, a thwart, a center console, a poling platform; and on the transom an outboard: cowling, shaft, lower unit, propeller
    parts.push(box(W * 0.03, draft * 0.3, L * 0.7, 0, bot * 1.02, -L * 0.03));
    parts.push(box(W * 0.84, free * 0.1, L * 0.08, 0, free * 0.8, -L * 0.2), box(W * 0.32, free * 0.75, L * 0.1, 0, free * 0.3 + free * 0.38, L * 0.05), box(W * 0.3, free * 0.45, L * 0.012, 0, free * 1.25, L * 0.005), box(W * 0.45, free * 0.1, L * 0.14, 0, free * 1.3, L * 0.34));
    for (const sx of [-1, 1]) parts.push(tube([[sx * W * 0.2, free * 0.3, L * 0.34], [sx * W * 0.2, free * 1.3, L * 0.34]], [L * 0.004], 5));
    const mz = L * 0.47, mh = bot * 1.2; parts.push(pod(W * 0.09, free * 0.42, L * 0.03, 12, 8).translate(0, free * 1.15, mz), tube([[0, free * 0.8, mz], [0, mh * 0.7, mz]], [L * 0.012, L * 0.009], 7), pod(L * 0.012, L * 0.012, L * 0.032, 10, 7).translate(0, mh * 0.8, mz), foil([0, mh * 0.82, mz + L * 0.01], [0, mh * 0.82, mz + L * 0.028], [0, mh * 1.3, mz + L * 0.024], { bow: 0, draw: 0, span: 2, chord: 1 }), propeller(draft * 0.5, 3, [0, mh * 0.8, mz + L * 0.03]));
  }
  return join(parts);
}
// a channel buoy: a float, a cone, and the open tower that carries its light
export function buoyGeometry() { const parts = [new THREE.CylinderGeometry(1.1, 1.1, 1.4, 20).translate(0, -0.3, 0), new THREE.CylinderGeometry(0.3, 0.45, 0.8, 12).translate(0, -1.3, 0), new THREE.TorusGeometry(0.16, 0.04, 6, 12).translate(0, -1.75, 0), new THREE.TorusGeometry(1.14, 0.09, 6, 24).rotateX(Math.PI / 2).translate(0, -0.1, 0), new THREE.CylinderGeometry(0.72, 1.1, 0.7, 20).translate(0, 0.75, 0), new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10).translate(0, 2.55, 0), new THREE.SphereGeometry(0.17, 12, 8).translate(0, 2.8, 0), new THREE.TorusGeometry(0.42, 0.03, 6, 16).rotateX(Math.PI / 2).translate(0, 1.55, 0), new THREE.TorusGeometry(0.22, 0.03, 6, 16).rotateX(Math.PI / 2).translate(0, 2.5, 0)];
  for (const [x, z] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) parts.push(new THREE.CylinderGeometry(0.035, 0.045, 1.6, 6).rotateZ(-x * 0.18).rotateX(z * 0.18).translate(x * 0.3, 1.8, z * 0.3));
  return join(parts); }
export const boatMat = creatureMat({ glow: 0.45 });   // hulls afloat: a little dimmer than the wrecks' steel
export const BOAT_TYPES = {
  ship: { L: 180, W: 28, draft: 9, free: 8, speed: 6.5, name: 'cargo ship' },
  cruiser: { L: 12, W: 4, draft: 1.1, free: 1.2, speed: 8, name: 'cruiser' },
  skiff: { L: 6, W: 2.2, draft: 0.5, free: 0.7, speed: 11, name: 'skiff' },
};
for (const t of Object.values(BOAT_TYPES)) t.geo = hullGeometry(t.L, t.W, t.draft, t.free, t === BOAT_TYPES.ship ? 'ship' : t === BOAT_TYPES.skiff ? 'skiff' : 'cruiser');

// the point on the Skyway's path nearest the charted main span, and the direction the path runs there (north to south, as SKYWAY.axis)
export function skywayFrame() {
  const [cx, cz] = toXZ(...SKYWAY.center), [ax0, az0] = toXZ(...SKYWAY.axis[0]), [bx0, bz0] = toXZ(...SKYWAY.axis[1]);
  const paths = bridges.filter(b => isSkyway(b.name)).map(b => b.pts), lines = paths.length ? paths : [[[ax0, az0], [bx0, bz0]]];
  let best = null;
  for (const pts of lines) for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; if (L2 < 1) continue;
    const u = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / L2)), x = ax + dx * u, z = az + dz * u, d = Math.hypot(cx - x, cz - z);
    if (!best || d < best.d) { const L = Math.sqrt(L2), s = Math.sign((bx0 - ax0) * dx + (bz0 - az0) * dz) || 1; best = { d, x, z, ux: s * dx / L, uz: s * dz / L }; }
  }
  return [best.x, best.z, best.ux, best.uz];
}
export function buildStructures() {
  for (const m of world.meshes) { scene.remove(m); if (m.userData.own) { m.geometry.dispose(); m.dispose?.(); } }   // a rebuild frees what the last one built (hull shapes are shared, so they stay)
  world.meshes = []; world.buoys = []; world.wrecks = []; world.colliders = makeGrid(40); world.solids = [];
  const add = (m, own = true) => { m.frustumCulled = false; m.userData.own = own; scene.add(m); world.meshes.push(m); return m; };
  const solid = c => { world.colliders.add(c); world.solids.push(c); };   // what you can't swim through: src/lib/collide.js
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), at = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const place = (mesh, i, x, y, z, yaw, pitch, sx, sy, sz) => { e.set(-pitch, yaw, 0); q.setFromEuler(e); M.compose(at.set(x, y, z), q, _s.set(sx, sy, sz)); mesh.setMatrixAt(i, M); };
  // the Skyway's own frame: distance along it from the middle of the main span. the middle is found on the bridge's own path
  // (whichever path the game has: OpenStreetMap's or the built-in one), nearest the charted main span, so the pylons, piers,
  // cables and the deck's profile all stand on the deck that is actually drawn
  const S = SKYWAY_SPEC, [scx, scz, sux, suz] = skywayFrame(), syaw = Math.atan2(sux, suz), along = (x, z) => (x - scx) * sux + (z - scz) * suz;
  const stations = skywayStations(), mainBridge = stations[stations.length - 1];
  const decks = [], piles = [], columns = [];
  for (const br of bridges) {
    const sky = isSkyway(br.name), clear = clearanceOf(br.name), width = sky ? S.deckWidth : TRESTLE.deckWidth, depth = sky ? S.deckDepth : TRESTLE.deckDepth;
    // the path, every 20 m or so, with how far along it each point is and which way it runs
    const pts = []; let run = 0;
    for (let i = 0; i + 1 < br.pts.length; i++) {
      const [ax, az] = br.pts[i], [bx, bz] = br.pts[i + 1], len = Math.hypot(bx - ax, bz - az); if (len < 1) continue;
      const n = Math.max(1, Math.ceil(len / 20)), yaw = Math.atan2(bx - ax, bz - az), nx = (bz - az) / len, nz = -(bx - ax) / len;
      for (let k = pts.length ? 1 : 0; k <= n; k++) pts.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n, d: run + len * k / n, yaw, nx, nz });
      run += len;
    }
    if (pts.length < 2) continue;
    // a trestle rises to its clearance over the channel, where it crosses deepest; the Skyway follows its measured profile
    let deep = pts[0]; for (const p of pts) if (floorAt(p.x, p.z) < floorAt(deep.x, deep.z)) deep = p;
    for (const p of pts) p.u = sky ? skywayUnderside(along(p.x, p.z)) : Math.max(TRESTLE.underside, clear - TRESTLE.grade * Math.abs(p.d - deep.d));   // the deck's underside here
    for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
      decks.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: (a.u + b.u) / 2 + depth / 2, len: len + 0.2, yaw: Math.atan2(b.x - a.x, b.z - a.z), pitch: Math.atan2(b.u - a.u, len), width, depth, lo: Math.min(a.u, b.u), hi: Math.max(a.u, b.u) + depth }); }
    // what holds it up, all the way to the deck: a column where the deck is high, a bent of piles where it's low, nothing in a navigation span
    let next = 0;
    for (const p of pts) {
      if (p.d < next) continue; const f = floorAt(p.x, p.z);
      if (f > -0.4) { next = p.d + 10; continue; }                                   // on land: the causeway carries it
      if (sky && Math.abs(along(p.x, p.z)) < mainBridge + 1) continue;               // the main bridge stands on its own measured piers (below)
      if (!sky && Math.abs(p.d - deep.d) < TRESTLE.navHalf) continue;               // the channel span
      if (p.u > TRESTLE.underside + 3) { columns.push({ x: p.x, z: p.z, f, top: p.u, yaw: p.yaw }); next = p.d + S.approachPier; }
      else { for (const o of [-1, 1]) piles.push({ x: p.x + p.nx * o * width * 0.3, z: p.z + p.nz * o * width * 0.3, f, top: p.u }); next = p.d + TRESTLE.bent; }
    }
  }
  // the Skyway's main bridge: the back-span piers at their measured stations (the pylons, at the first, come after)
  for (const st of stations.slice(1)) for (const sgn of [-1, 1]) { const x = scx + sux * sgn * st, z = scz + suz * sgn * st, f = floorAt(x, z); if (f < -0.4) columns.push({ x, z, f, top: skywayUnderside(st), yaw: syaw }); }
  const pileMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(TRESTLE.pileR, TRESTLE.pileR * 1.15, 1, 8).translate(0, 0.5, 0), structMat, Math.max(1, piles.length));
  piles.forEach((p, i) => { place(pileMesh, i, p.x, p.f - 1, p.z, 0, 0, 1, p.top - p.f + 1, 1); solid({ kind: 'c', x: p.x, z: p.z, r: TRESTLE.pileR + 0.2, y0: p.f - 1, y1: p.top }); });
  pileMesh.count = piles.length; pileMesh.name = 'bridge pilings'; add(pileMesh);
  const [colAlong, colAcross] = S.column, colMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), structMat, Math.max(1, columns.length));
  columns.forEach((c, i) => { place(colMesh, i, c.x, c.f - 1, c.z, c.yaw, 0, colAcross, c.top - c.f + 1, colAlong); solid({ kind: 'b', x: c.x, z: c.z, hx: colAcross / 2, hz: colAlong / 2, yaw: c.yaw, y0: c.f - 1, y1: c.top }); });
  colMesh.count = columns.length; colMesh.name = 'bridge piers'; add(colMesh);
  const deckMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), structMat, Math.max(1, decks.length));
  decks.forEach((d, i) => { place(deckMesh, i, d.x, d.y, d.z, d.yaw, d.pitch, d.width, d.depth, d.len); solid({ kind: 'b', x: d.x, z: d.z, hx: d.width / 2, hz: d.len / 2, yaw: d.yaw, y0: d.lo, y1: d.hi }); });
  deckMesh.count = decks.length; deckMesh.name = 'bridge decks'; add(deckMesh);

  // channel markers: buoy at the surface, chain to a sinker on the bottom
  const buoys = [];
  for (let i = 0; i + 1 < CHANNEL.length; i++) {
    const [ax, az] = CHANNEL[i], [bx, bz] = CHANNEL[i + 1], len = Math.hypot(bx - ax, bz - az), nx = (bz - az) / len, nz = -(bx - ax) / len;
    for (let d = 0; d < len; d += 700) for (const o of [-110, 110]) { const x = ax + (bx - ax) * d / len + nx * o, z = az + (bz - az) * d / len + nz * o, f = floorAt(x, z); if (f < -1.5) buoys.push({ x, z, f, ph: rand() * 6 }); }
  }
  const buoyMesh = new THREE.InstancedMesh(buoyGeometry(), structMat, Math.max(1, buoys.length));
  const chainMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 5).translate(0, 0.5, 0), structMat, Math.max(1, buoys.length));
  const sinkerMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), structMat, Math.max(1, buoys.length));
  buoys.forEach((b, i) => { M.makeRotationZ(0.06); M.scale(_s.set(1, -b.f, 1)); M.setPosition(b.x, b.f, b.z); chainMesh.setMatrixAt(i, M);
    M.makeTranslation(b.x, b.f + 0.6, b.z); sinkerMesh.setMatrixAt(i, M);
    solid({ kind: 'c', x: b.x, z: b.z, r: 1.4, y0: b.f, y1: b.f + 1.2 }); solid({ kind: 'c', x: b.x, z: b.z, r: 1.1, y0: -1.2, y1: 2.5 }); });   // the sinker on the bottom, the buoy at the top
  buoyMesh.count = chainMesh.count = sinkerMesh.count = buoys.length; buoyMesh.name = 'channel buoys'; chainMesh.name = 'buoy chains'; sinkerMesh.name = 'buoy sinkers';
  for (const m of [buoyMesh, chainMesh, sinkerMesh]) add(m);
  world.buoys = buoys; world.buoyMesh = buoyMesh;

  // the Skyway's two pylons: a pier from the bottom to the deck, then the tower to 131 m, tapering along the bridge, with its fan of
  // stay cables in one plane down the middle (21 a pylon); and the ring of concrete dolphins round each pier against ships
  { const deckTop = S.clearance + S.deckDepth, tAlong = S.pylonAlong[1], bAlong = S.pylonAlong[0];
    const pier = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), structMat, 2);
    const tower = new THREE.InstancedMesh(new THREE.CylinderGeometry(Math.SQRT1_2 * tAlong / bAlong, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), structMat, 2);   // a square frustum, 1 across at the base
    const half = S.cables / 2, cable = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 1, 4).translate(0, 0.5, 0), structMat, S.cables);
    const ring = new THREE.InstancedMesh(new THREE.CylinderGeometry(6, 7, 1, 16).translate(0, 0.5, 0), structMat, SKYWAY.dolphins * 2);
    let k = 0, c = 0;
    [-1, 1].forEach((sgn, i) => {
      const px = scx + sux * sgn * S.mainSpan / 2, pz = scz + suz * sgn * S.mainSpan / 2, f = floorAt(px, pz);
      place(pier, i, px, f - 1, pz, syaw, 0, 14, S.clearance - f + 1, 9); solid({ kind: 'b', x: px, z: pz, hx: 7, hz: 4.5, yaw: syaw, y0: f - 1, y1: S.clearance, tag: 'skyway pier' });
      place(tower, i, px, deckTop, pz, syaw, 0, S.pylonAcross, S.pylonTop - deckTop, bAlong); solid({ kind: 'b', x: px, z: pz, hx: S.pylonAcross / 2, hz: bAlong / 2, yaw: syaw, y0: deckTop, y1: S.pylonTop });
      // the semi-fan: anchors spread up the top of the tower, out along the deck to near midspan on one side and the end of the side span on the other
      for (const [dir, n, reach] of [[-sgn, Math.floor(half / 2), S.mainSpan / 2 - 6], [sgn, Math.ceil(half / 2), S.sideSpan - 6]]) for (let j = 0; j < n; j++) {
        const u = n > 1 ? j / (n - 1) : 1, top = new THREE.Vector3(px, deckTop + 30 + (S.pylonTop - 4 - deckTop - 30) * u, pz);
        const out = 20 + (reach - 20) * u, foot = new THREE.Vector3(px + sux * dir * out, deckTop, pz + suz * dir * out), v = top.clone().sub(foot), len = v.length();
        q.setFromUnitVectors(up, v.normalize()); M.compose(foot, q, _s.set(1, len, 1)); cable.setMatrixAt(c++, M); }
      for (let d = 0; d < SKYWAY.dolphins; d++) { const a = d / SKYWAY.dolphins * Math.PI * 2, r = 32, dx = px + Math.cos(a) * r, dz = pz + Math.sin(a) * r, df = floorAt(dx, dz);
        _M.makeScale(1, -df + 2.5, 1); _M.setPosition(dx, df, dz); ring.setMatrixAt(k++, _M); solid({ kind: 'c', x: dx, z: dz, r: 7, y0: df, y1: 2.5 }); }
    });
    ring.count = k; cable.count = c; pier.name = 'Skyway pylon piers'; tower.name = 'Skyway pylons'; cable.name = 'Skyway stay cables'; ring.name = 'Skyway fenders';
    for (const m of [pier, tower, cable, ring]) add(m); world.wrecks.push({ x: scx, z: scz, name: 'Skyway main span' }); }
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
