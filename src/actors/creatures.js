import * as THREE from 'three';
import { bodyAt, bump, foil, join, loft, pod, tube } from '../lib/shapes.js?v=__BUILD__';
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
  { id: 'dolphin', name: 'Bottlenose Dolphin', kind: 'fish', len: 2.6, fat: 0.23, dorsal: 1, pect: 1, fluke: 'h', cruise: 3.0, max: 8.3, turn: 1.5, alt: 0.8, zone: 'surface', freq: 3, amp: 0.1, wave: 4.4 },
  { id: 'manatee', name: 'West Indian Manatee', kind: 'fish', len: 3.0, fat: 0.42, round: 0.45, dorsal: 0, pect: 0.6, fluke: 'paddle', cruise: 1.5, max: 6.7, turn: 0.8, alt: 0.6, zone: 'shallow', freq: 1.2, amp: 0.11, wave: 3.6 },
  { id: 'bull', name: 'Bull Shark', kind: 'fish', len: 2.4, fat: 0.2, dorsal: 1.3, pect: 1.2, fluke: 'shark', cruise: 2.0, max: 5.5, turn: 1.2, alt: 0.8, zone: 'deep', freq: 2.2, amp: 0.09, wave: 5.8 },
  { id: 'hammer', name: 'Great Hammerhead', kind: 'fish', len: 3.4, fat: 0.13, dorsal: 1.7, pect: 1, fluke: 'shark', hammer: true, cruise: 1.8, max: 6.0, turn: 1.0, alt: 0.9, zone: 'deep', freq: 2, amp: 0.08, wave: 5.8 },
  { id: 'mullet', name: 'Striped Mullet', kind: 'fish', len: 0.45, fat: 0.14, dorsal: 0.4, pect: 0.3, fluke: 'v', cruise: 1.0, max: 3.5, turn: 2.5, alt: 0.2, zone: 'shallow', freq: 6, amp: 0.1, wave: 6.2 },
];
export const speciesById = Object.fromEntries(SPECIES.map(s => [s.id, s]));

// a cownose ray, seen from every side: a raised, notched head with its eyes on the sides, a ridge down the back, wings swept to points;
// underneath, the mouth and five pairs of gill slits; behind, a small dorsal fin, the spine at the tail's base, and the long whip
export function rayGeometry(sp, nu = 60, nv = 36) {
  const pos = [], uv = [], idx = [], half = sp.span / 2, far = nu < 20;
  const TIP = 0.46, width = t => t >= 0.86 ? 0.0001 : t < TIP ? half * Math.pow(t / TIP, 0.8) : half * Math.pow(1 - (t - TIP) / (0.86 - TIP), 1.25);   // a straight leading edge sweeping back to a pointed tip, then a shorter trailing edge
  for (const sideSign of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) { const t = j / nv, w = width(t);
      for (let i = 0; i <= nu; i++) { const u = i / nu * 2 - 1, x = u * w, r = Math.abs(x) / sp.span;
        let y = (1 - u * u) * 0.11 * sp.len * Math.pow(Math.sin(Math.PI * Math.min(t / 0.86, 1)), 0.6) * Math.max(0, 1 - Math.abs(u) * 1.2);
        if (!far && sideSign > 0) y += sp.len * (0.07 * bump(t, 0.13, 0.09) * bump(r, 0, 0.09) + 0.012 * bump(r, 0, 0.018) * (t > 0.12 ? 1 : 0));   // the head stands proud; the backbone shows
        if (!far && sideSign < 0) { let cut = 0.012 * bump(t, 0.1 + 0.2 * r, 0.006) * bump(r, 0, 0.05); for (let k = 0; k < 5; k++) cut += 0.006 * bump(t, 0.17 + k * 0.024, 0.0055) * bump(r, 0.075, 0.03); y = Math.max(0.001, y - cut * sp.len); }   // the mouth; the gills
        pos.push(x, sideSign * y, (t - 0.32) * sp.len); uv.push(Math.abs(u), t); } }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (sideSign > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const parts = [g], tb = (0.86 - 0.32) * sp.len - 0.05, tail = [], n = far ? 4 : 16; for (let i = 0; i <= n; i++) tail.push([0, 0, tb + sp.tail * i / n]);
  parts.push(tube(tail, tail.map((_, i) => (0.016 * sp.span) * Math.pow(1 - i / n, 1.4) + 0.0012), far ? 3 : 7));
  if (!far) { parts.push(foil([0, 0.008, tb + 0.02], [0, 0.008, tb + 0.08], [0, 0.05, tb + 0.09], { thick: 0.08, span: 5, chord: 3 }), tube([[0, 0.012, tb + 0.08], [0, 0.016, tb + 0.14]], [0.003, 0.0006], 4));   // the small dorsal, and the spine behind it
    for (const sx of [-1, 1]) parts.push(pod(0.032 * sp.span, 0.03 * sp.len, 0.085 * sp.len).translate(sx * 0.036 * sp.span, -0.012 * sp.len, -0.332 * sp.len), pod(0.016 * sp.span, 0.016 * sp.span, 0.016 * sp.span, 10, 8).translate(sx * 0.066 * sp.span, 0.045 * sp.len, -0.25 * sp.len), pod(0.007 * sp.span, 0.004 * sp.span, 0.012 * sp.span, 8, 6).translate(sx * 0.05 * sp.span, 0.075 * sp.len, -0.215 * sp.len)); }   // the two lobes that notch the snout; eyes on the sides of the head; the spiracle behind each
  return join(parts);
}
// each animal's body, station by station from the nose (s = 0) to the base of the tail (s = 1): half width, height above the centre line, depth below it, all
// as parts of its length. shaped by hand from the proportions in field guides and published side views: faithful in outline, not a scan
export const BODIES = {
  dolphin: [[0, .004, .004, .006], [.05, .015, .014, .016], [.1, .02, .018, .019], [.118, .03, .04, .024], [.15, .055, .068, .042], [.22, .083, .088, .066], [.35, .098, .098, .09], [.5, .084, .09, .078], [.65, .058, .068, .05], [.8, .03, .043, .029], [.9, .013, .027, .017], [1, .005, .009, .006]],   // the beak, the melon behind it, a tall narrow peduncle
  manatee: [[0, .028, .03, .042], [.03, .062, .06, .072], [.08, .08, .072, .08], [.14, .095, .085, .09], [.25, .155, .13, .14], [.45, .195, .16, .165], [.65, .165, .13, .135], [.82, .115, .08, .08], [.95, .085, .04, .04], [1, .07, .022, .022]],   // a blunt muzzle that hangs down, no neck, a great barrel
  bull: [[0, .004, .003, .003], [.02, .03, .018, .02], [.06, .058, .038, .038], [.14, .082, .062, .058], [.25, .098, .08, .086], [.36, .1, .088, .095], [.5, .08, .075, .076], [.65, .052, .052, .046], [.8, .03, .032, .026], [.92, .016, .02, .018], [1, .008, .012, .012]],   // the blunt snout and heavy belly it is known for
  hammer: [[0, .018, .008, .008], [.05, .03, .022, .024], [.12, .044, .04, .042], [.25, .058, .058, .06], [.38, .062, .066, .068], [.52, .052, .056, .054], [.68, .036, .04, .034], [.82, .021, .026, .02], [.93, .011, .016, .012], [1, .006, .009, .008]],   // long and slim behind the head
  mullet: [[0, .004, .004, .004], [.03, .03, .028, .03], [.12, .058, .056, .062], [.3, .072, .085, .085], [.5, .06, .085, .076], [.7, .04, .06, .05], [.88, .018, .03, .026], [1, .01, .015, .015]],   // a torpedo with a broad flat head
};
// each animal's skin, in parts of its length: what the outline can't say
const sideOn = (sa, at = 0.1, w = 0.45) => bump(sa, at, w);
export const SKIN = {
  bull(s, a, ca, sa) { let c = 0; for (let k = 0; k < 5; k++) c -= 0.0045 * bump(s, 0.205 + k * 0.016, 0.004) * sideOn(sa);   // five gill slits on each side
    c -= 0.007 * bump(s, 0.085 + 0.05 * Math.abs(ca), 0.0045) * bump(sa, -0.95, 0.5);   // the mouth, an arch under the snout
    c -= 0.004 * bump(s, 0.035, 0.004) * bump(Math.abs(ca), 0.55, 0.14) * bump(sa, -0.6, 0.35);   // nostrils
    c -= 0.004 * bump(s, 0.075, 0.009) * bump(sa, 0.3, 0.2);   // the eye sits in a socket
    return c; },
  hammer(s, a, ca, sa) { let c = 0; for (let k = 0; k < 5; k++) c -= 0.0035 * bump(s, 0.19 + k * 0.014, 0.0035) * sideOn(sa); return c - 0.005 * bump(s, 0.055 + 0.03 * Math.abs(ca), 0.004) * bump(sa, -0.95, 0.5); },
  dolphin(s, a, ca, sa) { let c = -0.0045 * bump(sa, -0.1 - Math.max(0, s - 0.1) * 0.6, 0.09) * (s < 0.17 ? 1 : 0) * (s > 0.005 ? 1 : 0);   // the line of the mouth, along the beak to the corner of a smile
    c -= 0.006 * bump(s, 0.2, 0.007) * bump(ca, 0, 0.13) * (sa > 0 ? 1 : 0);   // the blowhole, on top of the head
    return c - 0.002 * bump(s, 0.14, 0.008) * bump(sa, 0.05, 0.2); },
  manatee(s, a, ca, sa) { let c = s > 0.1 ? 0.0003 * Math.sin(s * 120) : 0;   // the folds of its skin
    c -= 0.007 * bump(s, 0.015, 0.008) * bump(Math.abs(ca), 0.35, 0.16) * (sa > 0 ? 1 : 0);   // two nostrils on top of the muzzle, that close when it dives
    c -= 0.004 * bump(s, 0.03, 0.006) * bump(sa, -0.35, 0.16);   // the mouth under the heavy lip
    return c - 0.002 * bump(s, 0.08, 0.006) * bump(sa, 0.25, 0.14); },
  mullet(s, a, ca, sa) { let c = -0.0035 * bump(s, 0.24 - 0.04 * Math.abs(sa), 0.005) * bump(sa, -0.05, 0.75);   // the edge of the gill cover
    c += 0.0007 * Math.sin(sa * 22) * (s > 0.25 && s < 0.95 ? 1 : 0);   // the stripes along its flanks that name it
    return c - 0.003 * bump(s, 0.012, 0.006) * bump(sa, -0.15, 0.2); },
};
export function fishGeometry(sp) {
  const L = sp.len, rows = BODIES[sp.id] || BODIES.mullet, at = s => bodyAt(rows, Math.min(1, s)), z = s => (s - 0.5) * L, parts = [loft(rows, L, { along: 90, around: 32, carve: SKIN[sp.id], crowd: 1.5 })];
  const up = s => at(s)[1] * L, dn = s => at(s)[2] * L, wd = s => at(s)[0] * L, F = (...a) => parts.push(foil(...a));
  const back = (a, b, h, tipS = b + (b - a) * 0.25, o = {}) => F([0, up(a) * 0.95, z(a)], [0, up(b) * 0.95, z(b)], [0, up((a + b) / 2) + h * L, z(tipS)], { bow: 0.25, draw: -0.2, ...o });   // a fin along the back
  const belly = (a, b, h, tipS = b + (b - a) * 0.3) => F([0, -dn(a) * 0.95, z(a)], [0, -dn(b) * 0.95, z(b)], [0, -dn((a + b) / 2) - h * L, z(tipS)], { bow: 0.2, draw: -0.15, span: 6, chord: 4 });
  const paired = (a, b, out, drop, tipS, o = {}) => { for (const sx of [-1, 1]) { const y = -dn((a + b) / 2) * 0.45, x = wd((a + b) / 2) * 0.88; F([sx * x, y, z(a)], [sx * x, y, z(b)], [sx * (x + out * L), y - drop * L, z(tipS)], { bow: 0.22, draw: -0.12, ...o }); } };
  if (sp.fluke === 'shark') {   // a tall first dorsal, a small second, swept pectorals, pelvics, an anal fin, and a tail far longer above than below
    back(0.36, 0.5, sp.hammer ? 0.2 : 0.14, 0.53); back(0.72, 0.78, 0.035); belly(0.58, 0.63, 0.04); belly(0.74, 0.79, 0.035); paired(0.24, 0.33, 0.2, 0.09, 0.38);
    F([0, up(0.93), z(0.93)], [0, up(1), z(1)], [0, 0.25 * L, z(1.18)], { bow: 0.12, draw: -0.22 }); F([0, -dn(0.95), z(0.95)], [0, -dn(1), z(1)], [0, -0.11 * L, z(1.07)], { bow: 0.2, draw: -0.12, span: 6, chord: 4 });
  } else if (sp.fluke === 'h') {   // a hooked dorsal, flippers, and flukes lying flat with the notch between them
    back(0.44, 0.58, 0.11, 0.62, { draw: -0.3, thick: 0.13 }); paired(0.22, 0.29, 0.16, 0.06, 0.37, { thick: 0.12 });
    for (const sx of [-1, 1]) F([0, 0, z(0.965)], [sx * 0.005 * L, 0, z(1.02)], [sx * 0.13 * L, 0, z(1.07)], { bow: 0.5, draw: -0.35, thick: 0.09 });
  } else if (sp.fluke === 'paddle') {   // rounded flippers with their nails; the great flat tail
    paired(0.15, 0.22, 0.15, 0.09, 0.25, { bow: 0.4, draw: 0.2, thick: 0.14 });
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) parts.push(pod(0.006 * L, 0.003 * L, 0.009 * L, 8, 6).translate(sx * (wd(0.18) * 0.88 + (0.125 + k * 0.012) * L), -dn(0.18) * 0.45 - (0.07 + k * 0.006) * L, z(0.2 + k * 0.012)));
    for (const sx of [-1, 1]) parts.push(pod(0.02 * L, 0.016 * L, 0.022 * L, 12, 8).translate(sx * 0.016 * L, -0.016 * L, z(0.012)));   // the split, bristled upper lip
    parts.push(pod(0.13 * L, 0.018 * L, 0.15 * L).translate(0, 0, z(1.06)));
  } else {   // a mullet: two small dorsals, pectorals set high, belly fins, a forked tail
    back(0.42, 0.5, 0.06, 0.52); back(0.66, 0.74, 0.05); belly(0.68, 0.74, 0.04); belly(0.46, 0.52, 0.03); paired(0.24, 0.3, 0.1, 0.01, 0.38);
    for (const u of [1, -1]) F([0, u * up(0.97) * 0.8, z(0.97)], [0, 0, z(1.03)], [0, u * 0.11 * L, z(1.14)], { bow: 0.1, draw: -0.15 });
  }
  if (sp.hammer) { const foilHead = new THREE.SphereGeometry(1, 40, 12).scale(0.15 * L, 0.014 * L, 0.04 * L), q = foilHead.attributes.position; for (let i = 0; i < q.count; i++) { const x = q.getX(i) / (0.15 * L), front = q.getZ(i) < 0 ? 1 : 0.6; q.setZ(i, q.getZ(i) * (1 - 0.35 * x * x) * front + 0.05 * L * x * x + (q.getZ(i) < 0 ? 0.012 * L * bump(Math.abs(x), 0.55, 0.14) + 0.012 * L * bump(x, 0, 0.1) : 0)); } foilHead.computeVertexNormals(); parts.push(foilHead.translate(0, 0, z(0.02))); }   // the cephalofoil: a thin wing with the notches of a great hammerhead's straight front edge, swept at the tips
  const eye = sp.hammer ? [0.145 * L, 0, z(0.05)] : [wd(sp.fluke === 'paddle' ? 0.08 : sp.fluke === 'h' ? 0.14 : 0.075) * 0.94, up(0.1) * (sp.fluke === 'shark' ? 0.32 : 0.2), z(sp.fluke === 'paddle' ? 0.08 : sp.fluke === 'h' ? 0.14 : 0.075)];   // eyes: a hammerhead's out at the tips, the rest in their sockets
  for (const sx of [-1, 1]) parts.push(pod(0.009 * L + 0.002, 0.009 * L + 0.002, 0.009 * L + 0.002, 10, 8).translate(sx * eye[0], eye[1], eye[2]));
  const g = join(parts);
  g.computeBoundingBox(); const k = L / (g.boundingBox.max.z - g.boundingBox.min.z); g.translate(0, 0, -(g.boundingBox.max.z + g.boundingBox.min.z) / 2).scale(k, k, k);   // the whole animal, fins and all, is as long as the real one
  return g;
}
// the far-off mullet in a school, hundreds at once: the same body in a few pieces, and a tail
export function schoolFishGeometry(L = 0.31) { return join([loft(BODIES.mullet, L, { along: 6, around: 5 }), foil([0, 0.012, L * 0.46], [0, 0, L * 0.5], [0, 0.04, L * 0.6], { span: 2, chord: 1 }), foil([0, -0.012, L * 0.46], [0, 0, L * 0.5], [0, -0.04, L * 0.6], { span: 2, chord: 1 })]); }
// a brown pelican: the great bill and pouch folded back on an S of neck, long broad wings with spread fingers at the tips, a short tail
export function birdGeometry(span = 2.0) {
  const parts = [pod(span * 0.075, span * 0.07, span * 0.2, 12, 8).translate(0, 0, span * 0.03), tube([[0, span * 0.02, -span * 0.13], [0, span * 0.09, -span * 0.17], [0, span * 0.1, -span * 0.11], [0, span * 0.12, -span * 0.1]], [span * 0.03, span * 0.024, span * 0.022, span * 0.03], 6), pod(span * 0.03, span * 0.03, span * 0.038, 8, 6).translate(0, span * 0.13, -span * 0.105), pod(span * 0.012, span * 0.012, span * 0.095, 6, 5).translate(0, span * 0.125, -span * 0.2), pod(span * 0.018, span * 0.03, span * 0.07, 6, 5).translate(0, span * 0.092, -span * 0.19)];
  for (const sx of [-1, 1]) { parts.push(foil([sx * span * 0.05, span * 0.02, -span * 0.08], [sx * span * 0.05, span * 0.02, span * 0.1], [sx * span * 0.5, span * 0.015, -span * 0.01], { bow: 0.12, draw: 0.32, thick: 0.05, span: 5, chord: 3 })); }
  parts.push(foil([-span * 0.04, 0, span * 0.2], [span * 0.04, 0, span * 0.2], [0, 0, span * 0.31], { bow: 0, draw: 0, thick: 0.04, span: 3, chord: 2 }));
  return join(parts);
}
export const geoCache = {};
export function creatureGeometry(sp) { return geoCache[sp.id] ??= sp.kind === 'ray' ? rayGeometry(sp) : fishGeometry(sp); }
export function creatureMesh(sp, glow = 1) {
  const size = sp.span ?? sp.len;
  const m = new THREE.Mesh(creatureGeometry(sp), creatureMat({ mode: sp.kind === 'ray' ? 1 : (sp.fluke === 'h' || sp.fluke === 'paddle') ? 6 : 2, half: (sp.span ?? sp.len) / 2, len: sp.len, freq: sp.freq, amp: sp.amp, wave: sp.wave, glow }));
  m.userData.sp = sp; m.userData.size = size; m.frustumCulled = false; return m;
}
