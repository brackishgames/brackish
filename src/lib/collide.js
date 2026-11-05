// Structure collision on the horizontal plane: pilings and buoys are circles, piers and hulls are boxes turned by a yaw.
// Each collider also has a vertical span, so you can pass over a sunken hull or under a deck.
//   circle: { kind: 'c', x, z, r, y0, y1 }    box: { kind: 'b', x, z, hx, hz, yaw, y0, y1 }
export function makeGrid(cell = 40, margin = 3) {
  const cells = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
  return {
    add(c) { const ext = (c.kind === 'c' ? c.r : Math.hypot(c.hx, c.hz)) + margin;
      for (let i = Math.floor((c.x - ext) / cell); i <= Math.floor((c.x + ext) / cell); i++) for (let j = Math.floor((c.z - ext) / cell); j <= Math.floor((c.z + ext) / cell); j++) {
        const k = key(i, j); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(c); } },
    near(x, z) { return cells.get(key(Math.floor(x / cell), Math.floor(z / cell))) || []; },
    clear() { cells.clear(); },
  };
}
// push a body of radius r at (x, y, z) out of one collider. returns null, or { x, z, nx, nz, depth } with the outward normal
export function pushOut(c, x, y, z, r) {
  if (y < c.y0 - r || y > c.y1 + r) return null;
  if (c.kind === 'c') { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), need = c.r + r; if (d >= need) return null;
    const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0; return { x: c.x + nx * need, z: c.z + nz * need, nx, nz, depth: need - d }; }
  // box: into its frame, clamp to the inflated box, back out
  const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), dx = x - c.x, dz = z - c.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  const ex = c.hx + r, ez = c.hz + r; if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) return null;
  const px = ex - Math.abs(lx), pz = ez - Math.abs(lz); let ox = lx, oz = lz, lnx = 0, lnz = 0;
  if (px < pz) { ox = Math.sign(lx || 1) * ex; lnx = Math.sign(lx || 1); } else { oz = Math.sign(lz || 1) * ez; lnz = Math.sign(lz || 1); }
  return { x: c.x + ox * cs + oz * sn, z: c.z - ox * sn + oz * cs, nx: lnx * cs + lnz * sn, nz: -lnx * sn + lnz * cs, depth: Math.min(px, pz) };
}
