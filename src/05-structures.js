'use strict';
// ═══════════════════════════════════════════════════════════════════
//  STRUCTURES  —  bridges (OSM geometry: pilings to the bottom, decks
//  above), channel buoys with chains, wrecks and rubble. Built after data.
// ═══════════════════════════════════════════════════════════════════
const structMat = creatureMat({ glow: 0.62 });
let bridges = [];   // [{ name, pts:[[x,z],...] }]
function hullGeometry(L, W, draft, free, cabin = true) {
  const parts = [new THREE.BoxGeometry(W, draft + free, L * 0.78).translate(0, (free - draft) / 2, L * 0.11)];
  parts.push(new THREE.ConeGeometry(W / 2, L * 0.3, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 4).scale(1, (draft + free) / W, 1).translate(0, (free - draft) / 2, -L * 0.42));
  if (cabin) parts.push(new THREE.BoxGeometry(W * 0.7, free * 1.6, L * 0.25).translate(0, free + free * 0.8, L * 0.25));
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false);
}
const BOAT_TYPES = {
  ship: { L: 180, W: 28, draft: 9, free: 8, speed: 6.5, name: 'cargo ship' },
  cruiser: { L: 12, W: 4, draft: 1.1, free: 1.2, speed: 8, name: 'cruiser' },
  skiff: { L: 6, W: 2.2, draft: 0.5, free: 0.7, speed: 11, name: 'skiff' },
};
for (const t of Object.values(BOAT_TYPES)) t.geo = hullGeometry(t.L, t.W, t.draft, t.free, t !== BOAT_TYPES.skiff);

function buildStructures() {
  for (const m of world.meshes) scene.remove(m); world.meshes = []; world.buoys = []; world.wrecks = [];
  const add = m => { m.frustumCulled = false; scene.add(m); world.meshes.push(m); return m; };
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
  piles.forEach((p, i) => { M.makeScale(1, -p.f + 2.5, 1); M.setPosition(p.x, p.f - 1, p.z); pileMesh.setMatrixAt(i, M); });
  pileMesh.count = piles.length; add(pileMesh);
  const deckMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 1.6, 1), structMat, Math.max(1, decks.length));
  decks.forEach((d, i) => { M.makeRotationY(d.yaw); M.scale(new THREE.Vector3(1, 1, d.len)); M.setPosition(d.x, d.h, d.z); deckMesh.setMatrixAt(i, M); });
  deckMesh.count = decks.length; add(deckMesh);

  // channel markers: buoy at the surface, chain to a sinker on the bottom
  const buoys = [];
  for (let i = 0; i + 1 < CHANNEL.length; i++) {
    const [ax, az] = CHANNEL[i], [bx, bz] = CHANNEL[i + 1], len = Math.hypot(bx - ax, bz - az), nx = (bz - az) / len, nz = -(bx - ax) / len;
    for (let d = 0; d < len; d += 700) for (const o of [-110, 110]) { const x = ax + (bx - ax) * d / len + nx * o, z = az + (bz - az) * d / len + nz * o, f = floorAt(x, z); if (f < -1.5) buoys.push({ x, z, f, ph: Math.random() * 6 }); }
  }
  const buoyMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 3.2, 8).translate(0, 0.6, 0), structMat, Math.max(1, buoys.length));
  const chainMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 5).translate(0, 0.5, 0), structMat, Math.max(1, buoys.length));
  const sinkerMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), structMat, Math.max(1, buoys.length));
  buoys.forEach((b, i) => { M.makeScale(1, -b.f, 1); M.makeRotationZ(0.06); M.scale(new THREE.Vector3(1, -b.f, 1)); M.setPosition(b.x, b.f, b.z); chainMesh.setMatrixAt(i, M);
    M.makeTranslation(b.x, b.f + 0.6, b.z); sinkerMesh.setMatrixAt(i, M); });
  buoyMesh.count = chainMesh.count = sinkerMesh.count = buoys.length;
  for (const m of [buoyMesh, chainMesh, sinkerMesh]) add(m);
  world.buoys = buoys; world.buoyMesh = buoyMesh;

  // the Skyway main piers and their dolphins
  { const [ax, az] = toXZ(...SKYWAY.axis[0]), [bx, bz] = toXZ(...SKYWAY.axis[1]), L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, [cx, cz] = toXZ(...SKYWAY.center);
    const pier = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), structMat, 2), ring = new THREE.InstancedMesh(new THREE.CylinderGeometry(6, 7, 1, 16).translate(0, 0.5, 0), structMat, SKYWAY.dolphins * 2);
    let k = 0;
    [-1, 1].forEach((sgn, i) => { const px = cx + ux * sgn * SKYWAY.span / 2, pz = cz + uz * sgn * SKYWAY.span / 2, f = floorAt(px, pz);
      _M.makeRotationY(Math.atan2(ux, uz)); _M.scale(_s.set(14, -f + 60, 9)); _M.setPosition(px, (f + 60) / 2, pz); pier.setMatrixAt(i, _M);
      for (let d = 0; d < SKYWAY.dolphins; d++) { const a = d / SKYWAY.dolphins * Math.PI * 2, r = 32, dx = px + Math.cos(a) * r, dz = pz + Math.sin(a) * r, df = floorAt(dx, dz);
        _M.makeScale(1, -df + 2.5, 1); _M.setPosition(dx, df, dz); ring.setMatrixAt(k++, _M); } });
    ring.count = k; add(pier); add(ring); world.wrecks.push({ x: cx, z: cz, name: 'Skyway main span' }); }
  // ships riding at anchor, chain down into the dark
  for (const an of ANCHORAGE) { const [x, z] = toXZ(...an.ll), f = floorAt(x, z), t = BOAT_TYPES.ship, hull = new THREE.Mesh(t.geo, boatMat); hull.position.set(x, 0, z); hull.rotation.y = an.yaw; add(hull);
    const bow = fwdOf(an.yaw).multiplyScalar(t.L * 0.45), chain = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 6).translate(0, -0.5, 0), structMat);
    const top = new THREE.Vector3(x + bow.x, -1, z + bow.z), bottom = new THREE.Vector3(x + bow.x * 2.2, f, z + bow.z * 2.2); chain.position.copy(top); chain.scale.y = top.distanceTo(bottom); chain.lookAt(bottom); chain.rotateX(-Math.PI / 2); add(chain);
    world.wrecks.push({ x, z, name: 'Egmont anchorage' }); }
  // wrecks and rubble
  for (const w of WRECKS) {
    const [x, z] = toXZ(...w.ll), f = floorAt(x, z); if (f > -1) continue;
    if (w.kind === 'ruins') { const n = 22, g = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), structMat, n);   // poured-concrete batteries, tilted and broken
      for (let i = 0; i < n; i++) { const rx = x + (Math.random() - .5) * 70, rz = z + (Math.random() - .5) * 50, sx = 4 + Math.random() * 9, sy = 2 + Math.random() * 4;
        _M.makeRotationFromEuler(_E.set((Math.random() - .5) * 0.9, Math.random() * 6, (Math.random() - .5) * 0.9)); _M.scale(_s.set(sx, sy, 3 + Math.random() * 6)); _M.setPosition(rx, floorAt(rx, rz) + sy * 0.3, rz); g.setMatrixAt(i, _M); }
      add(g); world.wrecks.push({ x, z, name: w.name }); continue; }
    if (w.kind === 'rubble') { const n = 14, g = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), structMat, n);
      for (let i = 0; i < n; i++) { const rx = x + (Math.random() - .5) * 40, rz = z + (Math.random() - .5) * 40, s = 2 + Math.random() * 5; M.makeRotationFromEuler(new THREE.Euler(Math.random(), Math.random() * 6, Math.random())); M.scale(new THREE.Vector3(s, s * 0.6, s * 1.5)); M.setPosition(rx, floorAt(rx, rz) + s * 0.2, rz); g.setMatrixAt(i, M); }
      add(g); }
    else { const t = BOAT_TYPES[w.kind], m = new THREE.Mesh(t.geo, structMat); m.scale.setScalar(w.s); m.position.set(x, f + t.draft * w.s * 0.6, z); m.rotation.set(0.15, Math.random() * 6, w.rest ?? (0.55 + Math.random() * 0.4)); add(m); }
    world.wrecks.push({ x, z, name: w.name });
  }
}
const world = { buoys: [], wrecks: [], buoyMesh: null, meshes: [] };
