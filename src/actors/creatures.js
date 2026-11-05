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
  { id: 'dolphin', name: 'Bottlenose Dolphin', kind: 'fish', len: 2.6, fat: 0.23, dorsal: 1, pect: 1, fluke: 'h', cruise: 3.0, max: 8.3, turn: 1.5, alt: 0.8, zone: 'surface', freq: 3, amp: 0.08 },
  { id: 'manatee', name: 'West Indian Manatee', kind: 'fish', len: 3.0, fat: 0.42, round: 0.45, dorsal: 0, pect: 0.6, fluke: 'paddle', cruise: 2.0, max: 6.7, turn: 0.8, alt: 0.6, zone: 'shallow', freq: 1.2, amp: 0.06 },
  { id: 'bull', name: 'Bull Shark', kind: 'fish', len: 2.4, fat: 0.2, dorsal: 1.3, pect: 1.2, fluke: 'shark', cruise: 1.3, max: 5.5, turn: 1.2, alt: 0.8, zone: 'deep', freq: 2.2, amp: 0.11 },
  { id: 'hammer', name: 'Great Hammerhead', kind: 'fish', len: 3.4, fat: 0.13, dorsal: 1.7, pect: 1, fluke: 'shark', hammer: true, cruise: 1.2, max: 6.0, turn: 1.0, alt: 0.9, zone: 'deep', freq: 2, amp: 0.1 },
  { id: 'mullet', name: 'Striped Mullet', kind: 'fish', len: 0.45, fat: 0.14, dorsal: 0.4, pect: 0.3, fluke: 'v', cruise: 1.0, max: 3.5, turn: 2.5, alt: 0.2, zone: 'shallow', freq: 6, amp: 0.1 },
];
export const speciesById = Object.fromEntries(SPECIES.map(s => [s.id, s]));

export function rayGeometry(sp, nu = 40, nv = 24) {
  const pos = [], uv = [], idx = [], half = sp.span / 2;
  const width = t => t < 0.86 ? half * Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.86)), sp.pointy) : 0.0001;
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
  const tail = new THREE.PlaneGeometry(0.03 * sp.span, sp.tail).translate(0, sp.tail / 2, 0).rotateX(Math.PI / 2).translate(0, 0, (0.86 - 0.32) * sp.len - 0.05);
  parts.push(tail);
  if (sp.lobes) for (const sx of [-1, 1]) parts.push(new THREE.PlaneGeometry(0.045 * sp.span, 0.2 * sp.len).rotateX(-Math.PI / 2).rotateY(sx * 0.35).translate(sx * 0.085 * sp.span, 0, -0.32 * sp.len - 0.07 * sp.len));
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false) ?? g;
}
export function tri(a, b, c) {   // a thin fin: one triangle, both sides lit by the double-sided material
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));   // zero normal = fin: shaded as a thin edge
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
}
export function fishGeometry(sp) {
  const L = sp.len, R = sp.fat * L, round = sp.round ?? 0.7, shark = sp.fluke === 'shark', dolphin = sp.fluke === 'h';
  const flat = sp.flat ?? (dolphin ? 0.9 : shark ? 0.78 : sp.fluke === 'paddle' ? 1.0 : 0.55);   // most fish are taller than they are wide
  const prof = s => R * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), round) * (0.55 + 0.45 * s) * (0.3 + 0.7 * THREE.MathUtils.smoothstep(s, 0, 0.22)) * (1.0 - 0.45 * Math.pow(THREE.MathUtils.smoothstep(s, 0.78, 1.0), 1.5));
  const pts = []; for (let i = 0; i <= 26; i++) { const s = i / 26; pts.push(new THREE.Vector2(0.002 + prof(s), s * L)); }
  const body = new THREE.LatheGeometry(pts, 18).rotateX(-Math.PI / 2).translate(0, 0, L * 0.5).scale(flat, 1, 1);
  const parts = [body], rm = prof(0.55), rh = prof(0.82), x = (s) => prof(s) * flat;
  // dorsal: swept-back blade
  if (sp.dorsal) { const h = 0.2 * L * sp.dorsal; parts.push(tri([0, rm * 0.9, -0.08 * L], [0, rm * 0.9, 0.16 * L], [0, rm * 0.9 + h, 0.1 * L])); }
  if (shark) parts.push(tri([0, prof(0.3) * 0.9, 0.3 * L], [0, prof(0.3) * 0.9, 0.4 * L], [0, prof(0.3) * 0.9 + 0.06 * L, 0.38 * L]));
  // pectorals: angled down and back
  for (const sx of [-1, 1]) { const px = x(0.7) * 0.9, w = 0.22 * L * sp.pect;
    parts.push(tri([sx * px, -rm * 0.2, -0.2 * L], [sx * px, -rm * 0.2, -0.06 * L], [sx * (px + w * 0.85), -rm * 0.2 - w * 0.45, -0.02 * L])); }
  // tails
  if (sp.fluke === 'v') { parts.push(tri([0, 0, 0.48 * L], [0, 0.17 * L, 0.63 * L], [0, 0.03 * L, 0.57 * L])); parts.push(tri([0, 0, 0.48 * L], [0, -0.17 * L, 0.63 * L], [0, -0.03 * L, 0.57 * L])); }
  if (shark) { parts.push(tri([0, 0, 0.47 * L], [0, 0.3 * L, 0.68 * L], [0, 0.02 * L, 0.6 * L])); parts.push(tri([0, 0, 0.47 * L], [0, -0.13 * L, 0.6 * L], [0, -0.02 * L, 0.56 * L])); }
  if (dolphin) for (const sx of [-1, 1]) parts.push(tri([0, 0, 0.47 * L], [sx * 0.2 * L, 0, 0.6 * L], [0, 0, 0.56 * L]));
  if (sp.fluke === 'paddle') parts.push(new THREE.CircleGeometry(0.16 * L, 12).rotateX(-Math.PI / 2).scale(1, 1, 1.3).translate(0, 0, L * 0.5 + 0.08 * L));
  if (dolphin) parts.push(new THREE.ConeGeometry(prof(0.95) * 0.8, 0.09 * L, 8).rotateX(-Math.PI / 2).translate(0, -prof(0.95) * 0.2, -0.52 * L));   // rostrum
  if (sp.hammer) parts.push(new THREE.BoxGeometry(0.3 * L, 0.025 * L, 0.06 * L).translate(0, 0, -L * 0.5 + 0.03 * L));
  // eyes: a bright point each side
  for (const sx of [-1, 1]) parts.push(new THREE.SphereGeometry(0.012 * L + 0.012, 6, 4).translate(sx * (sp.hammer ? 0.15 * L : x(0.88) * 0.9), rh * 0.25, (sp.hammer ? -0.47 : -0.38) * L));
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false);
}
export function birdGeometry(span = 2.0) {
  const parts = []; for (const sx of [-1, 1]) parts.push(new THREE.PlaneGeometry(span / 2, span * 0.12).translate(sx * span / 4, 0, 0).rotateX(-Math.PI / 2));
  parts.push(new THREE.PlaneGeometry(span * 0.06, span * 0.35).rotateX(-Math.PI / 2));
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p), false);
}
export const geoCache = {};
export function creatureGeometry(sp) { return geoCache[sp.id] ??= sp.kind === 'ray' ? rayGeometry(sp) : fishGeometry(sp); }
export function creatureMesh(sp, glow = 1) {
  const size = sp.span ?? sp.len;
  const m = new THREE.Mesh(creatureGeometry(sp), creatureMat({ mode: sp.kind === 'ray' ? 1 : (sp.fluke === 'h' || sp.fluke === 'paddle') ? 6 : 2, half: (sp.span ?? sp.len) / 2, len: sp.len, freq: sp.freq, amp: sp.amp, glow }));
  m.userData.sp = sp; m.userData.size = size; m.frustumCulled = false; return m;
}
