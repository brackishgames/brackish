import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { creatureMat } from '../render/materials.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  CREATURES  —  species registry, procedural bodies, one animated
//  brightness material (rim-lit silhouettes; flat normals from derivatives).
//  Modes: 1 ray flap · 2 fish tail · 4 bird wings · 5 jelly · 6 vertical fluke
// ═══════════════════════════════════════════════════════════════════
// Species of the bay. sizes in metres; cruise/max in m/s; zone picks the wild AI's preferred depth.
// speeds are the real animals' (m/s): cruise at the top of each one's measured cruising range, max its published sprint
export const SPECIES = [
  { id: 'cownose', name: 'Cownose Ray', kind: 'ray', span: 0.9, len: 0.6, pointy: 1.0, tail: 0.9, cruise: 1.5, max: 3.6, turn: 1.8, alt: 0.4, zone: 'shallow', freq: 2.6, amp: 0.55 },
  { id: 'dolphin', name: 'Bottlenose Dolphin', kind: 'fish', len: 2.6, fat: 0.23, dorsal: 1, pect: 1, fluke: 'h', cruise: 3.0, max: 8.3, turn: 1.5, alt: 0.8, zone: 'surface', freq: 3, amp: 0.08, wave: 4.4 },
  { id: 'manatee', name: 'West Indian Manatee', kind: 'fish', len: 3.0, fat: 0.42, round: 0.45, dorsal: 0, pect: 0.6, fluke: 'paddle', cruise: 2.0, max: 6.7, turn: 0.8, alt: 0.6, zone: 'shallow', freq: 1.2, amp: 0.06, wave: 3.6 },
  { id: 'bull', name: 'Bull Shark', kind: 'fish', len: 2.4, fat: 0.2, dorsal: 1.3, pect: 1.2, fluke: 'shark', cruise: 1.3, max: 5.5, turn: 1.2, alt: 0.8, zone: 'deep', freq: 2.2, amp: 0.11, wave: 5.8 },
  { id: 'hammer', name: 'Great Hammerhead', kind: 'fish', len: 3.4, fat: 0.13, dorsal: 1.7, pect: 1, fluke: 'shark', hammer: true, cruise: 1.2, max: 6.0, turn: 1.0, alt: 0.9, zone: 'deep', freq: 2, amp: 0.1, wave: 5.8 },
  { id: 'mullet', name: 'Striped Mullet', kind: 'fish', len: 0.45, fat: 0.14, dorsal: 0.4, pect: 0.3, fluke: 'v', cruise: 1.0, max: 3.5, turn: 2.5, alt: 0.2, zone: 'shallow', freq: 6, amp: 0.1, wave: 6.2 },
];
export const speciesById = Object.fromEntries(SPECIES.map(s => [s.id, s]));

export function rayGeometry(sp, nu = 40, nv = 24) {
  const pos = [], uv = [], idx = [], half = sp.span / 2;
  const TIP = 0.46, width = t => t >= 0.86 ? 0.0001 : t < TIP ? half * Math.pow(t / TIP, 0.8) : half * Math.pow(1 - (t - TIP) / (0.86 - TIP), 1.25);   // the wings: a straight leading edge sweeping back to a pointed tip, then a shorter trailing edge
  for (const sideSign of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) { const t = j / nv, w = width(t);
      for (let i = 0; i <= nu; i++) { const u = i / nu * 2 - 1;
        const bulge = (1 - u * u) * 0.11 * sp.len * Math.pow(Math.sin(Math.PI * Math.min(t / 0.86, 1)), 0.6) * Math.max(0, 1 - Math.abs(u) * 1.2);
        pos.push(u * w, sideSign * bulge, (t - 0.32) * sp.len); uv.push(Math.abs(u), t); } }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (sideSign > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const parts = [g];
  const tail = new THREE.CylinderGeometry(0.0015 * sp.span, 0.016 * sp.span, sp.tail, 6, 14).rotateX(Math.PI / 2).translate(0, 0, (0.86 - 0.32) * sp.len - 0.05 + sp.tail / 2);   // a whip, round and tapering, in enough pieces to wave
  parts.push(tail);
  for (const sx of [-1, 1]) parts.push(new THREE.SphereGeometry(1, 14, 10).scale(0.034 * sp.span, 0.03 * sp.len, 0.085 * sp.len).translate(sx * 0.036 * sp.span, -0.012 * sp.len, -0.32 * sp.len - 0.012 * sp.len));   // the notched head that names it: two soft lobes under the snout
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false) ?? g;
}
const mixV = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// a fin: a curved blade from two root points to a rounded tip, the leading edge bowed out, the trailing edge drawn in. thin, so it is shaded as an edge (zero normal)
export function fin(lead, trail, tip, { bow = 0.3, draw = 0.2, segs = 8 } = {}) {
  const chord = lead.map((v, i) => v - trail[i]), lc = mixV(lead, tip, 0.55).map((v, i) => v + chord[i] * bow), tc = mixV(trail, tip, 0.55).map((v, i) => v + chord[i] * draw);
  const bez = (a, c, b, t) => a.map((v, i) => (1 - t) * (1 - t) * v + 2 * t * (1 - t) * c[i] + t * t * b[i]), pos = [];
  for (let i = 0; i < segs; i++) { const t0 = i / segs, t1 = (i + 1) / segs, a = bez(lead, lc, tip, t0), b = bez(trail, tc, tip, t0), c = bez(lead, lc, tip, t1), d = bez(trail, tc, tip, t1); pos.push(...a, ...b, ...c, ...c, ...b, ...d); }
  const g = new THREE.BufferGeometry(), n = pos.length / 3; g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(n * 2).fill(0.5), 2));
  return g;
}
const pod = (rx, ry, rz) => new THREE.SphereGeometry(1, 20, 12).scale(rx, ry, rz);   // a smooth rounded lump
// each animal's body, station by station from the nose (s = 0) to the base of the tail (s = 1): half width, height above the centre line, depth below it, all
// as parts of its length. shaped by hand from the proportions in field guides and published side views: faithful in outline, not a scan
export const BODIES = {
  dolphin: [[0, .004, .004, .006], [.05, .015, .014, .016], [.1, .02, .018, .019], [.118, .03, .04, .024], [.15, .055, .068, .042], [.22, .083, .088, .066], [.35, .098, .098, .09], [.5, .084, .09, .078], [.65, .058, .068, .05], [.8, .03, .043, .029], [.9, .013, .027, .017], [1, .005, .009, .006]],   // the beak, the melon behind it, a tall narrow peduncle
  manatee: [[0, .028, .03, .042], [.03, .062, .06, .072], [.08, .08, .072, .08], [.14, .095, .085, .09], [.25, .155, .13, .14], [.45, .195, .16, .165], [.65, .165, .13, .135], [.82, .115, .08, .08], [.95, .085, .04, .04], [1, .07, .022, .022]],   // a blunt muzzle that hangs down, no neck, a great barrel
  bull: [[0, .004, .003, .003], [.02, .03, .018, .02], [.06, .058, .038, .038], [.14, .082, .062, .058], [.25, .098, .08, .086], [.36, .1, .088, .095], [.5, .08, .075, .076], [.65, .052, .052, .046], [.8, .03, .032, .026], [.92, .016, .02, .018], [1, .008, .012, .012]],   // the blunt snout and heavy belly it is known for
  hammer: [[0, .018, .008, .008], [.05, .03, .022, .024], [.12, .044, .04, .042], [.25, .058, .058, .06], [.38, .062, .066, .068], [.52, .052, .056, .054], [.68, .036, .04, .034], [.82, .021, .026, .02], [.93, .011, .016, .012], [1, .006, .009, .008]],   // long and slim behind the head
  mullet: [[0, .004, .004, .004], [.03, .03, .028, .03], [.12, .058, .056, .062], [.3, .072, .085, .085], [.5, .06, .085, .076], [.7, .04, .06, .05], [.88, .018, .03, .026], [1, .01, .015, .015]],   // a torpedo with a broad flat head
};
const catmull = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
export function bodyAt(rows, s) { let i = 0; while (i < rows.length - 2 && rows[i + 1][0] <= s) i++; const r = k => rows[Math.max(0, Math.min(rows.length - 1, k))], t = (s - rows[i][0]) / (rows[i + 1][0] - rows[i][0]), v = c => Math.max(0.001, catmull(r(i - 1)[c], r(i)[c], r(i + 1)[c], r(i + 2)[c], t)); return [v(1), v(2), v(3)]; }
function loft(rows, L, along = 56, around = 30) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= along; j++) { const s = j / along, [w, up, dn] = bodyAt(rows, s);
    for (let i = 0; i < around; i++) { const a = i / around * Math.PI * 2, sa = Math.sin(a); pos.push(Math.cos(a) * w * L, sa * (sa > 0 ? up : dn) * L, (s - 0.5) * L); uv.push(0.5, s); } }
  for (let j = 0; j < along; j++) for (let i = 0; i < around; i++) { const a = j * around + i, b = j * around + (i + 1) % around, c = a + around, d = b + around; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
export function fishGeometry(sp) {
  const L = sp.len, rows = BODIES[sp.id] || BODIES.mullet, at = s => bodyAt(rows, Math.min(1, s)), z = s => (s - 0.5) * L, parts = [loft(rows, L)];
  const up = s => at(s)[1] * L, dn = s => at(s)[2] * L, wd = s => at(s)[0] * L, F = (...a) => parts.push(fin(...a));
  const back = (a, b, h, tipS = b + (b - a) * 0.25, o = {}) => F([0, up(a) * 0.95, z(a)], [0, up(b) * 0.95, z(b)], [0, up((a + b) / 2) + h * L, z(tipS)], { bow: 0.25, draw: -0.2, ...o });   // a fin along the back
  const belly = (a, b, h, tipS = b + (b - a) * 0.3) => F([0, -dn(a) * 0.95, z(a)], [0, -dn(b) * 0.95, z(b)], [0, -dn((a + b) / 2) - h * L, z(tipS)], { bow: 0.2, draw: -0.15, segs: 6 });
  const paired = (a, b, out, drop, tipS, o = {}) => { for (const sx of [-1, 1]) { const y = -dn((a + b) / 2) * 0.45, x = wd((a + b) / 2) * 0.88; F([sx * x, y, z(a)], [sx * x, y, z(b)], [sx * (x + out * L), y - drop * L, z(tipS)], { bow: 0.22, draw: -0.12, ...o }); } };
  if (sp.fluke === 'shark') {   // a tall first dorsal, a small second, swept pectorals, and a tail far longer above than below
    back(0.36, 0.5, sp.hammer ? 0.2 : 0.14, 0.53); back(0.72, 0.78, 0.035); belly(0.58, 0.63, 0.04); belly(0.74, 0.79, 0.035); paired(0.24, 0.33, 0.2, 0.09, 0.38);
    F([0, up(0.93), z(0.93)], [0, up(1), z(1)], [0, 0.25 * L, z(1.18)], { bow: 0.12, draw: -0.22 }); F([0, -dn(0.95), z(0.95)], [0, -dn(1), z(1)], [0, -0.11 * L, z(1.07)], { bow: 0.2, draw: -0.12, segs: 6 });
  } else if (sp.fluke === 'h') {   // a hooked dorsal, flippers, and flukes lying flat
    back(0.44, 0.58, 0.11, 0.62, { draw: -0.3 }); paired(0.22, 0.29, 0.16, 0.06, 0.37);
    for (const sx of [-1, 1]) F([0, 0, z(0.965)], [0, 0, z(1)], [sx * 0.13 * L, 0, z(1.07)], { bow: 0.5, draw: -0.35 });
  } else if (sp.fluke === 'paddle') {   // rounded flippers; the great flat tail
    paired(0.15, 0.22, 0.15, 0.09, 0.25, { bow: 0.4, draw: 0.2 }); parts.push(pod(0.13 * L, 0.018 * L, 0.15 * L).translate(0, 0, z(1.06)));
  } else {   // a mullet: two small dorsals, pectorals set high, a forked tail
    back(0.42, 0.5, 0.06, 0.52); back(0.66, 0.74, 0.05); belly(0.68, 0.74, 0.04); paired(0.24, 0.3, 0.1, 0.01, 0.38);
    for (const u of [1, -1]) F([0, u * up(0.97) * 0.8, z(0.97)], [0, 0, z(1.03)], [0, u * 0.11 * L, z(1.14)], { bow: 0.1, draw: -0.15 });
  }
  if (sp.hammer) { const foil = new THREE.SphereGeometry(1, 28, 10).scale(0.15 * L, 0.014 * L, 0.04 * L), q = foil.attributes.position; for (let i = 0; i < q.count; i++) { const x = q.getX(i) / (0.15 * L); q.setZ(i, q.getZ(i) * (1 - 0.35 * x * x) + 0.05 * L * x * x); } foil.computeVertexNormals(); parts.push(foil.translate(0, 0, z(0.02))); }   // the cephalofoil: a thin wing, swept at the tips
  const eye = sp.hammer ? [0.145 * L, 0, z(0.05)] : [wd(sp.fluke === 'paddle' ? 0.07 : 0.12) * 0.92, up(0.12) * 0.25, z(sp.fluke === 'paddle' ? 0.07 : 0.12)];   // eyes: a bright point each side; a hammerhead's are out at the tips
  for (const sx of [-1, 1]) parts.push(new THREE.SphereGeometry(0.008 * L + 0.012, 10, 8).translate(sx * eye[0], eye[1], eye[2]));
  const g = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false);
  g.computeBoundingBox(); const k = L / (g.boundingBox.max.z - g.boundingBox.min.z); g.translate(0, 0, -(g.boundingBox.max.z + g.boundingBox.min.z) / 2).scale(k, k, k);   // the whole animal, fins and all, is as long as the real one
  return g;
}
// the far-off mullet in a school, hundreds at once: the same body in a few pieces, and a tail
export function schoolFishGeometry(L = 0.31) { return mergeGeometries([loft(BODIES.mullet, L, 8, 6).toNonIndexed(), fin([0, 0.012, L * 0.46], [0, 0, L * 0.5], [0, 0.04, L * 0.6], { segs: 2 }), fin([0, -0.012, L * 0.46], [0, 0, L * 0.5], [0, -0.04, L * 0.6], { segs: 2 })], false); }
export function birdGeometry(span = 2.0) {
  const parts = [pod(span * 0.05, span * 0.05, span * 0.2)]; for (const sx of [-1, 1]) parts.push(fin([sx * span * 0.03, 0, -span * 0.07], [sx * span * 0.03, 0, span * 0.07], [sx * span / 2, 0, span * 0.05], { bow: 0.3, draw: 0.1 }));
  parts.push(fin([0, 0, span * 0.14], [0, 0, span * 0.14], [0, 0, span * 0.3], { segs: 2 }));
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false);
}
export const geoCache = {};
export function creatureGeometry(sp) { return geoCache[sp.id] ??= sp.kind === 'ray' ? rayGeometry(sp) : fishGeometry(sp); }
export function creatureMesh(sp, glow = 1) {
  const size = sp.span ?? sp.len;
  const m = new THREE.Mesh(creatureGeometry(sp), creatureMat({ mode: sp.kind === 'ray' ? 1 : (sp.fluke === 'h' || sp.fluke === 'paddle') ? 6 : 2, half: (sp.span ?? sp.len) / 2, len: sp.len, freq: sp.freq, amp: sp.amp, wave: sp.wave, glow }));
  m.userData.sp = sp; m.userData.size = size; m.frustumCulled = false; return m;
}
