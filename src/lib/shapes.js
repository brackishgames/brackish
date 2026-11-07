import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// What every model in the game is made from: bodies lofted through cross-sections and carved, solid fins, smooth lumps, tubes, propellers.
export const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));   // a soft rise at c, about w wide: what carving is made of
const catmull = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
export function bodyAt(rows, s) { let i = 0; while (i < rows.length - 2 && rows[i + 1][0] <= s) i++; const r = k => rows[Math.max(0, Math.min(rows.length - 1, k))], t = (s - rows[i][0]) / (rows[i + 1][0] - rows[i][0]), v = c => Math.max(0.001, catmull(r(i - 1)[c], r(i)[c], r(i + 1)[c], r(i + 2)[c], t)); return [v(1), v(2), v(3)]; }
const finish = (pos, idx, smooth = true) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0.5), 2)); if (idx) g.setIndex(idx); g.computeVertexNormals(); return g; };
// a body through its cross-sections, nose (s = 0) at -z. rows: [s, half width, height above, depth below], as parts of L. stations crowd toward the head, where the detail is.
// carve(s, a) pushes the skin in or out at that place (a: 0 is the right side, pi/2 the back), in parts of L
export function loft(rows, L, { along = 56, around = 30, carve = null, crowd = 1 } = {}) {
  const pos = [], idx = [];
  for (let j = 0; j <= along; j++) { const s = Math.pow(j / along, crowd), [w, up, dn] = bodyAt(rows, s);
    for (let i = 0; i < around; i++) { const a = i / around * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a), push = carve ? carve(s, a, ca, sa) : 0; pos.push(ca * (w + push) * L, sa * ((sa > 0 ? up : dn) + push) * L, (s - 0.5) * L); } }
  for (let j = 0; j < along; j++) for (let i = 0; i < around; i++) { const a = j * around + i, b = j * around + (i + 1) % around, c = a + around, d = b + around; idx.push(a, c, b, b, c, d); }
  return finish(pos, idx);
}
const bez = (a, c, b, t) => a.map((v, i) => (1 - t) * (1 - t) * v + 2 * t * (1 - t) * c[i] + t * t * b[i]);
const mixV = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// a fin with real thickness: fattest a third back from its leading edge, sharp at the trailing edge and tip, curved in outline (bow: the leading edge out; draw: the trailing edge in)
export function foil(lead, trail, tip, { bow = 0.25, draw = -0.15, thick = 0.09, span = 9, chord = 6 } = {}) {
  const c = lead.map((v, i) => v - trail[i]), lc = mixV(lead, tip, 0.55).map((v, i) => v + c[i] * bow), tc = mixV(trail, tip, 0.55).map((v, i) => v + c[i] * draw), mid = mixV(lead, trail, 0.5), n = new THREE.Vector3(...c).cross(new THREE.Vector3(...tip.map((v, i) => v - mid[i]))).normalize(), cl = new THREE.Vector3(...c).length(), pos = [], idx = [], row = chord + 1;
  for (const side of [1, -1]) { const base = pos.length / 3; for (let j = 0; j <= span; j++) { const t = j / span, a = bez(lead, lc, tip, t), b = bez(trail, tc, tip, t); for (let i = 0; i <= chord; i++) { const v = i / chord, h = side * thick * cl * (1 - t * t) * Math.pow(v, 0.5) * Math.pow(1 - v, 1.1) * 1.6, p = mixV(a, b, v); pos.push(p[0] + n.x * h, p[1] + n.y * h, p[2] + n.z * h); } }
    for (let j = 0; j < span; j++) for (let i = 0; i < chord; i++) { const q = base + j * row + i, r = q + row; side > 0 ? idx.push(q, r, q + 1, q + 1, r, r + 1) : idx.push(q, q + 1, r, q + 1, r + 1, r); } }
  return finish(pos, idx);
}
export const pod = (rx, ry, rz, w = 18, h = 11) => { const g = new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz); g.computeVertexNormals(); return g; };   // a smooth lump
// a tube along points, each with its radius: masts, necks, whips, shafts
export function tube(points, radii, around = 8) { const pos = [], idx = [], at = new THREE.Vector3(), t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  points.forEach((p, j) => { at.set(...p); t.set(...points[Math.min(j + 1, points.length - 1)]).sub(new THREE.Vector3(...points[Math.max(j - 1, 0)])).normalize(); a.set(Math.abs(t.y) < 0.9 ? 0 : 1, Math.abs(t.y) < 0.9 ? 1 : 0, 0).cross(t).normalize(); b.crossVectors(t, a); const r = radii[Math.min(j, radii.length - 1)]; for (let i = 0; i < around; i++) { const u = i / around * Math.PI * 2; pos.push(at.x + (a.x * Math.cos(u) + b.x * Math.sin(u)) * r, at.y + (a.y * Math.cos(u) + b.y * Math.sin(u)) * r, at.z + (a.z * Math.cos(u) + b.z * Math.sin(u)) * r); } });
  for (let j = 0; j + 1 < points.length; j++) for (let i = 0; i < around; i++) { const q = j * around + i, r = j * around + (i + 1) % around; idx.push(q, q + around, r, r, q + around, r + around); }
  return finish(pos, idx); }
// a propeller on its shaft line, axis along z: broad swept blades around a hub
export function propeller(r, blades = 4, at = [0, 0, 0]) { const parts = [pod(r * 0.2, r * 0.2, r * 0.32, 10, 7)]; for (let k = 0; k < blades; k++) { const a = k / blades * Math.PI * 2, u = [Math.cos(a), Math.sin(a)], w = [-u[1], u[0]]; parts.push(foil([u[0] * r * 0.15 + w[0] * r * 0.2, u[1] * r * 0.15 + w[1] * r * 0.2, -r * 0.14], [u[0] * r * 0.15 - w[0] * r * 0.2, u[1] * r * 0.15 - w[1] * r * 0.2, r * 0.14], [u[0] * r, u[1] * r, r * 0.04], { bow: 0.5, draw: 0.2, thick: 0.06, span: 5, chord: 3 })); } return join(parts).translate(...at); }
export const join = parts => mergeGeometries(parts.map(p => { const g = p.index ? p.toNonIndexed() : p; for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name); return g; }), false);
export const box = (x, y, z, cx = 0, cy = 0, cz = 0) => new THREE.BoxGeometry(x, y, z).translate(cx, cy, cz);
