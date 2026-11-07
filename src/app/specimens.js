import * as THREE from 'three';
import { toXZ } from '../lib/geo.js?v=__BUILD__';
import { DEV, TEST } from '../core/env.js?v=__BUILD__';
import { camera, scene } from '../render/display.js?v=__BUILD__';
import { WU } from '../render/materials.js?v=__BUILD__';
import { WRECKS, floorAt } from '../world/geo.js?v=__BUILD__';
import { fans, grass, rocks } from '../world/seabed.js?v=__BUILD__';
import { updateClipmap } from '../world/seafloor.js?v=__BUILD__';
import { BOAT_TYPES, boatMat, skywayFrame, structMat, world } from '../world/structures.js?v=__BUILD__';
import { day } from '../world/time.js?v=__BUILD__';
import { SPECIES, creatureMesh, speciesById } from '../actors/creatures.js?v=__BUILD__';
import { feverMesh } from '../actors/fever.js?v=__BUILD__';
import { birdMesh, fishMesh, foodMesh, jellyMesh } from '../actors/life.js?v=__BUILD__';
import { $ } from '../ui/hud.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  SPECIMENS  —  every model in the game, on its own, built by the code that builds it for the bay and drawn on the
//  game's own display. /?dev&specimens is the page; tools/specimens.mjs prints the sheet, the sizes and the STL files.
// ═══════════════════════════════════════════════════════════════════
const SEARCH = new URLSearchParams(location.search);
export const SPECIMENS_PAGE = (DEV || TEST) && SEARCH.has('specimens');
export const specimen = { on: false, item: null, obj: null, yaw: 0.7, pitch: 0.32, dist: 5, at: new THREE.Vector3(), radius: 1, wire: false, size: new THREE.Vector3(), tris: 0 };
const WORK_Y = -3;   // a specimen hangs just under the surface, where the light is good
const SPEC_LAYER = 1;   // the camera sees this layer alone, so nothing the bay does can wander into the picture
const one = (geo, material) => { const m = new THREE.InstancedMesh(geo, material, 1); m.setMatrixAt(0, new THREE.Matrix4()); m.frustumCulled = false; return m; };
const part = (name) => world.meshes.find(m => m.name === name);
const buoy = () => { const g = new THREE.Group(), [cone, chain, sinker] = ['channel buoys', 'buoy chains', 'buoy sinkers'].map(part); const c = new THREE.Mesh(cone.geometry, structMat); const l = new THREE.Mesh(chain.geometry, structMat); l.position.y = -8; l.scale.y = 8; const k = new THREE.Mesh(sinker.geometry, structMat); k.position.y = -8.6; g.add(c, l, k); return g; };
export const SPECIMENS = [
  ...SPECIES.map(sp => ({ id: sp.id, name: sp.name, group: 'animals', real: sp.span ?? sp.len, make: () => creatureMesh(sp) })),
  { id: 'fever-ray', name: 'Cownose Ray, in the fever', group: 'animals', real: speciesById.cownose.span, make: () => one(feverMesh.geometry, feverMesh.material) },
  { id: 'school-fish', name: 'Schooling mullet', group: 'animals', make: () => one(fishMesh.geometry, fishMesh.material) },
  { id: 'jelly', name: 'Jellyfish', group: 'animals', make: () => one(jellyMesh.geometry, jellyMesh.material) },
  { id: 'bird', name: 'Seabird', group: 'animals', make: () => one(birdMesh.geometry, birdMesh.material) },
  ...Object.entries(BOAT_TYPES).map(([id, t]) => ({ id, name: t.name, group: 'boats', real: t.L, make: () => new THREE.Mesh(t.geo, boatMat) })),
  { id: 'buoy', name: 'Channel buoy, chain and sinker', group: 'structures', make: buoy },
  { id: 'clam', name: 'Clam', group: 'the bottom', make: () => one(foodMesh.geometry, foodMesh.material) },
  { id: 'seagrass', name: 'Seagrass tuft', group: 'the bottom', make: () => one(grass.geometry, grass.material) },
  { id: 'sea-fan', name: 'Sea fan', group: 'the bottom', make: () => one(fans.geometry, fans.material) },
  { id: 'rock', name: 'Rock', group: 'the bottom', make: () => one(rocks.geometry, rocks.material) },
  { id: 'skyway', name: 'Sunshine Skyway main span', group: 'places', place: () => [...skywayFrame().slice(0, 2), 620] },
  ...WRECKS.map(w => ({ id: w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: w.name, group: 'places', place: () => { const [x, z] = toXZ(...w.ll), t = BOAT_TYPES[w.kind]; return [x, z, t ? t.L * (w.s || 1) * 1.1 : 70]; } })),
].filter((s, i, all) => all.findIndex(o => o.id === s.id) === i);

const trisOf = obj => { let n = 0; obj.traverse(m => { if (m.geometry) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); }); return Math.round(n); };
export function showSpecimen(id) {
  const item = SPECIMENS.find(s => s.id === id); if (!item) throw new Error('no specimen called ' + id);
  if (specimen.obj) { scene.remove(specimen.obj); specimen.obj = null; }
  specimen.item = item;
  if (item.place) { const [x, z, r] = item.place(), f = floorAt(x, z); specimen.at.set(x, Math.min(f + r * 0.12, -1), z); specimen.radius = r; specimen.tris = 0; specimen.size.setScalar(0); camera.layers.set(0); updateClipmap(x, z); }
  else { const obj = item.make(); obj.position.set(0, WORK_Y, 0); obj.traverse(o => { o.layers.set(SPEC_LAYER); o.frustumCulled = false; }); scene.add(obj); obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj), s = box.getBoundingSphere(new THREE.Sphere()); specimen.obj = obj; specimen.at.copy(s.center); specimen.radius = Math.max(s.radius, 0.05); box.getSize(specimen.size); specimen.tris = trisOf(obj); camera.layers.set(SPEC_LAYER); }
  specimen.yaw = 0.7; specimen.pitch = 0.32; specimen.dist = specimen.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15;
  setWire(specimen.wire); applySpecimen(); renderList();
  try { history.replaceState(null, '', `${location.pathname}?${TEST ? 'test' : 'dev'}&specimens=${id}`); } catch {}
  return specimenReport(item);
}
export function applySpecimen() {   // the lens, every step
  const { yaw, pitch, dist, at, radius } = specimen; camera.position.set(at.x + Math.sin(yaw) * Math.cos(pitch) * dist, at.y + Math.sin(pitch) * dist, at.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.up.set(0, 1, 0); camera.lookAt(at); camera.fov = 50; camera.updateProjectionMatrix(); WU.uFogD.value = 0.25 / Math.max(radius, 1) / 3; WU.uFogB.value = 0; day.hour = 12;
}
export function setWire(on) { specimen.wire = on; const walk = o => { if (o.material) o.material.wireframe = on; }; if (specimen.obj) specimen.obj.traverse(walk); }
export const specimenInfo = () => { const { item, size, tris } = specimen; if (!item || item.place) return item ? 'THE REAL PLACE, AS BUILT IN THE BAY' : ''; return `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} M · ${tris.toLocaleString('en-US')} TRIS`; };
export const specimenReport = item => ({ id: item.id, name: item.name, group: item.group, place: !!item.place, real: item.real ?? null, size: specimen.size.toArray().map(v => +v.toFixed(3)), triangles: specimen.tris });
// a binary STL of what is on show, for GitHub's 3D viewer: it shows geometry, at rest
export function specimenStl() {
  const tris = [], M = new THREE.Matrix4(), I = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), base = specimen.at;
  specimen.obj.traverse(m => { if (!m.geometry) return; const pos = m.geometry.attributes.position, idx = m.geometry.index, count = idx ? idx.count : pos.count;
    for (let k = 0; k < (m.isInstancedMesh ? m.count : 1); k++) { M.copy(m.matrixWorld); if (m.isInstancedMesh) { m.getMatrixAt(k, I); M.multiply(I); }
      for (let i = 0; i + 2 < count; i += 3) { const at = j => idx ? idx.getX(i + j) : i + j; a.fromBufferAttribute(pos, at(0)).applyMatrix4(M).sub(base); b.fromBufferAttribute(pos, at(1)).applyMatrix4(M).sub(base); c.fromBufferAttribute(pos, at(2)).applyMatrix4(M).sub(base);
        n.subVectors(b, a).cross(c.clone().sub(a)).normalize(); tris.push([n.x, n.y, n.z, a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z]); } } });
  const buf = new ArrayBuffer(84 + tris.length * 50), v = new DataView(buf); v.setUint32(80, tris.length, true);
  tris.forEach((t, i) => t.forEach((f, j) => v.setFloat32(84 + i * 50 + j * 4, f, true)));
  let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s);
}
// ── the page: a list down the side; drag to turn, wheel to zoom, ← → for the next one, F for the wires
let listEl = null;
function renderList() { if (!listEl) return; for (const b of listEl.querySelectorAll('button')) b.style.color = b.dataset.id === specimen.item?.id ? '#fff' : '#7f93a6'; }
export function stepSpecimenList(d) { const i = SPECIMENS.indexOf(specimen.item); showSpecimen(SPECIMENS[(i + d + SPECIMENS.length) % SPECIMENS.length].id); }
export function enterSpecimens() {
  specimen.on = true; $('title').classList.add('gone'); document.title = 'BRACKISH specimens';
  listEl = document.createElement('nav'); listEl.setAttribute('style', 'position:fixed;left:0;top:0;bottom:0;width:190px;overflow:auto;padding:10px;background:#000c;font:12px/1.5 ui-monospace,monospace;z-index:20');
  let group = ''; for (const s of SPECIMENS) { if (s.group !== group) { group = s.group; const h = document.createElement('div'); h.textContent = group.toUpperCase(); h.setAttribute('style', 'color:#4d6072;margin:10px 0 2px'); listEl.append(h); }
    const b = document.createElement('button'); b.textContent = s.name; b.dataset.id = s.id; b.setAttribute('style', 'display:block;width:100%;text-align:left;background:none;border:0;padding:1px 0;cursor:pointer;font:inherit'); b.onclick = () => showSpecimen(s.id); listEl.append(b); }
  const keys = document.createElement('div'); keys.textContent = 'drag turns · wheel zooms · ← → next · F wires'; keys.setAttribute('style', 'color:#4d6072;margin-top:12px'); listEl.append(keys); document.body.append(listEl);
  let held = null; const pick = e => !e.target.closest?.('nav');
  addEventListener('pointerdown', e => { if (pick(e)) held = [e.clientX, e.clientY]; });
  addEventListener('pointerup', () => { held = null; });
  addEventListener('pointermove', e => { if (!held) return; specimen.yaw -= (e.clientX - held[0]) * 0.008; specimen.pitch = THREE.MathUtils.clamp(specimen.pitch + (e.clientY - held[1]) * 0.008, -1.4, 1.4); held = [e.clientX, e.clientY]; applySpecimen(); });
  addEventListener('wheel', e => { specimen.dist *= e.deltaY > 0 ? 1.1 : 0.9; applySpecimen(); }, { passive: true });
  addEventListener('keydown', e => { if (e.code === 'ArrowRight') stepSpecimenList(1); if (e.code === 'ArrowLeft') stepSpecimenList(-1); if (e.code === 'KeyF') setWire(!specimen.wire); });
  showSpecimen(SEARCH.get('specimens') || SPECIMENS[0].id);
}
