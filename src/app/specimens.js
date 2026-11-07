import * as THREE from 'three';
import { toXZ } from '../lib/geo.js?v=__BUILD__';
import { DEV, TEST } from '../core/env.js?v=__BUILD__';
import { camera, lowRT, renderer, scene, setDotPitch } from '../render/display.js?v=__BUILD__';
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
//  game's own display, from four fixed angles at once, so there is nothing to operate and nowhere to get lost. /?dev&specimens is the page;
//  tools/specimens.mjs prints the sheet, the sizes and the STL files.
// ═══════════════════════════════════════════════════════════════════
const SEARCH = new URLSearchParams(location.search);
export const SPECIMENS_PAGE = (DEV || TEST) && SEARCH.has('specimens');
export const specimen = { on: false, item: null, obj: null, dist: 5, at: new THREE.Vector3(), radius: 1, wire: false, turning: false, raw: SEARCH.get('view') !== 'game', size: new THREE.Vector3(), half: new THREE.Vector3(1, 1, 1), tris: 0 };
const _tiny = new THREE.Vector3(0.01, 0.01, 0.01), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _c = new THREE.Vector3();
const VIEW = { '3/4': [Math.PI - 0.75, 0.3], SIDE: [Math.PI / 2, 0.02], TOP: [Math.PI, 1.5], FRONT: [Math.PI, 0.03], ABOVE: [Math.PI, 1.45], LOW: [Math.PI - 0.75, 0.22] };   // around (the nose is toward -z), up
const ALL_FOUR = ['3/4', 'SIDE', 'TOP', 'FRONT'], PLACE = ['ABOVE', 'LOW'];   // what a model needs to be judged: a flat thing has no use for its edge, a map needs room
const WORK_Y = -3;   // a specimen hangs just under the surface, where the light is good
const SPEC_LAYER = 1;   // the camera sees this layer alone, so nothing the bay does can wander into the picture
const one = (geo, material) => { const m = new THREE.InstancedMesh(geo, material, 1); m.setMatrixAt(0, new THREE.Matrix4()); m.frustumCulled = false; return m; };
const part = (name) => world.meshes.find(m => m.name === name);
const buoy = () => { const g = new THREE.Group(), [cone, chain, sinker] = ['channel buoys', 'buoy chains', 'buoy sinkers'].map(part); const c = new THREE.Mesh(cone.geometry, structMat); const l = new THREE.Mesh(chain.geometry, structMat); l.position.y = -8; l.scale.y = 8; const k = new THREE.Mesh(sinker.geometry, structMat); k.position.y = -8.6; g.add(c, l, k); return g; };
export const SPECIMENS = [
  ...SPECIES.map(sp => ({ id: sp.id, name: sp.name, group: 'animals', real: sp.span ?? sp.len, make: () => creatureMesh(sp) })),
  { id: 'fever-ray', name: 'Cownose Ray, in the fever', group: 'animals', real: speciesById.cownose.span, make: () => one(feverMesh.geometry, feverMesh.material) },
  { id: 'school-fish', name: 'Schooling mullet', group: 'animals', make: () => one(fishMesh.geometry, fishMesh.material) },
  { id: 'jelly', name: 'Jellyfish', group: 'animals', views: ['SIDE', 'TOP'], make: () => one(jellyMesh.geometry, jellyMesh.material) },
  { id: 'bird', name: 'Seabird', group: 'animals', make: () => one(birdMesh.geometry, birdMesh.material) },
  ...Object.entries(BOAT_TYPES).map(([id, t]) => ({ id, name: t.name, group: 'boats', real: t.L, make: () => new THREE.Mesh(t.geo, boatMat) })),
  { id: 'buoy', name: 'Channel buoy, chain and sinker', group: 'structures', views: ['SIDE', '3/4'], make: buoy },
  { id: 'clam', name: 'Clam', group: 'plants and the bottom', make: () => one(foodMesh.geometry, foodMesh.material) },
  { id: 'seagrass', name: 'Seagrass tuft', group: 'plants and the bottom', views: ['SIDE', '3/4', 'TOP'], make: () => one(grass.geometry, grass.material) },
  { id: 'sea-fan', name: 'Sea fan', group: 'plants and the bottom', views: ['FRONT', '3/4'], make: () => one(fans.geometry, fans.material) },
  { id: 'rock', name: 'Rock', group: 'plants and the bottom', views: ['3/4', 'TOP'], make: () => one(rocks.geometry, rocks.material) },
  { id: 'the-bay', name: 'Tampa Bay, from above', group: 'maps and places', views: ['ABOVE'], place: () => [...toXZ(27.72, -82.62), 8000] },
  { id: 'skyway', name: 'Sunshine Skyway main span', group: 'maps and places', place: () => [...skywayFrame().slice(0, 2), 620] },
  ...WRECKS.map(w => ({ id: w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: w.name, group: 'maps and places', place: () => { const [x, z] = toXZ(...w.ll), t = BOAT_TYPES[w.kind]; return [x, z, t ? t.L * (w.s || 1) * 1.1 : 70]; } })),
].filter((s, i, all) => all.findIndex(o => o.id === s.id) === i);

const trisOf = obj => { let n = 0; obj.traverse(m => { if (m.geometry) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); }); return Math.round(n); };
export function showSpecimen(id) {
  const item = SPECIMENS.find(s => s.id === id); if (!item) throw new Error('no specimen called ' + id);
  if (specimen.obj) { scene.remove(specimen.obj); specimen.obj = null; }
  specimen.item = item;
  if (item.place) { const [x, z, r] = item.place(), f = floorAt(x, z); specimen.at.set(x, Math.min(f + r * 0.12, -1), z); specimen.radius = r; specimen.tris = 0; specimen.size.setScalar(0); specimen.half.set(r, r * 0.25, r); camera.layers.set(0); updateClipmap(x, z); }
  else { const obj = item.built ??= item.make(); obj.position.set(0, WORK_Y, 0); obj.traverse(o => { o.layers.set(SPEC_LAYER); o.frustumCulled = false; if (o.material?.uniforms?.uLift) o.material.uniforms.uLift.value = 0.3; }); scene.add(obj); obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj), s = box.getBoundingSphere(new THREE.Sphere()); specimen.obj = obj; specimen.at.copy(s.center); specimen.radius = Math.max(s.radius, 0.05); box.getSize(specimen.size); box.getCenter(specimen.at); specimen.half.copy(specimen.size).multiplyScalar(0.5).max(_tiny); specimen.tris = trisOf(obj); camera.layers.set(SPEC_LAYER); }
  setWire(specimen.wire); setTurning(specimen.turning); applySpecimen(); renderList();
  try { history.replaceState(null, '', `${location.pathname}?${TEST ? 'test' : 'dev'}&specimens=${id}`); } catch {}
  return specimenReport(item);
}
const FOV = 40;
export function applySpecimen() { WU.uFogD.value = 0.25 / Math.max(specimen.radius, 1) / 3; WU.uFogB.value = 0; day.hour = 12; }   // clear water at noon: a model is judged, not hidden
const viewsOf = item => item?.views || (item?.place ? PLACE : ALL_FOUR);
const HEAD_PX = 54;   // the page's own header
// the grid fits how many views this model has: one fills the page, two or three share a row, four make a square. in CSS pixels from the top left
const layout = (i, n) => { const on = listEl && listEl.style.display !== 'none', left = on ? LIST_PX : 0, W = innerWidth - left, H = innerHeight - HEAD_PX, cols = n === 4 ? 2 : n, rows = n === 4 ? 2 : 1, w = W / cols, h = H / rows; return { x: left + (i % cols) * w, y: HEAD_PX + Math.floor(i / cols) * h, w, h }; };
// close enough that this model fills this panel from this side, measured from its own box, so a long thin thing isn't lost in a square
function fitCamera(yaw, pitch, aspect) {
  const { at, half } = specimen, t = Math.tan(THREE.MathUtils.degToRad(FOV / 2)); _d.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  camera.position.copy(at).addScaledVector(_d, 1); camera.up.set(0, 1, 0); camera.lookAt(at); camera.updateMatrixWorld(); _r.setFromMatrixColumn(camera.matrixWorld, 0); _u.setFromMatrixColumn(camera.matrixWorld, 1);
  let need = 0, deep = 0; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { _c.set(sx * half.x, sy * half.y, sz * half.z); need = Math.max(need, Math.abs(_c.dot(_r)) / (t * aspect), Math.abs(_c.dot(_u)) / t); deep = Math.max(deep, _c.dot(_d)); }
  const dist = Math.max(need * 1.08 + deep * 0.75, deep * 1.15); camera.near = Math.max(0.005, dist * 0.02); camera.far = Math.max(30000, dist * 4); camera.updateProjectionMatrix(); camera.position.copy(at).addScaledVector(_d, dist); camera.lookAt(at);   // the lens's near limit is for a bay; a clam is closer
}
// In game: the bay's own lighting, through the dot matrix. a little fill so the dark side of a model still shows
export function renderSpecimenViews() {
  const rt = lowRT, gw = rt.width, gh = rt.height, k = gw / innerWidth, names = viewsOf(specimen.item); rt.scissorTest = true; camera.fov = FOV; WU.uRaw.value = 0; WU.uFill.value = 0;
  renderer.setClearColor(0x000000, 1); rt.viewport.set(0, 0, gw, gh); rt.scissor.set(0, 0, gw, gh); renderer.setRenderTarget(rt); renderer.clear();
  names.forEach((name, i) => { const b = layout(i, names.length), x = Math.round(b.x * k), w = Math.round(b.w * k) - 1, h = Math.round(b.h * k) - 1, y = gh - Math.round((b.y + b.h) * k); rt.viewport.set(x, y, w, h); rt.scissor.set(x, y, w, h); renderer.setRenderTarget(rt);
    camera.aspect = w / h; camera.updateProjectionMatrix(); fitCamera(...VIEW[name], camera.aspect); renderer.render(scene, camera); });
  rt.viewport.set(0, 0, gw, gh); rt.scissor.set(0, 0, gw, gh); rt.scissorTest = false; renderer.setRenderTarget(rt);
}
// Raw: the model itself, straight to the screen in studio light
export function renderSpecimenRaw() {
  const names = viewsOf(specimen.item), H = innerHeight; renderer.setRenderTarget(null); renderer.setScissorTest(true); renderer.setViewport(0, 0, innerWidth, H); renderer.setScissor(0, 0, innerWidth, H); renderer.setClearColor(0x161b21, 1); renderer.clear(); camera.fov = FOV; WU.uRaw.value = 1; WU.uFill.value = 0;
  names.forEach((name, i) => { const b = layout(i, names.length); renderer.setViewport(b.x, H - b.y - b.h, b.w - 1, b.h - 1); renderer.setScissor(b.x, H - b.y - b.h, b.w - 1, b.h - 1); camera.aspect = b.w / b.h; camera.updateProjectionMatrix(); fitCamera(...VIEW[name], camera.aspect); renderer.render(scene, camera); });
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, H); renderer.setClearColor(0x000000, 1); WU.uRaw.value = 0;
}
// the header and each panel's name, in plain type above whichever view is on
let headEl = null, labelEls = [];
function renderLabels() { if (!headEl) return; const names = viewsOf(specimen.item); headEl.style.left = (listEl.style.display === 'none' ? 0 : LIST_PX) + 'px'; headEl.innerHTML = ''; const h = document.createElement('b'), i = document.createElement('div'); h.textContent = specimen.item?.name || ''; i.textContent = specimenInfo(); i.setAttribute('style', 'color:#8ea3b6'); headEl.append(h, i);
  for (const l of labelEls) l.remove(); labelEls = names.length < 2 ? [] : names.map((n, k) => { const b = layout(k, names.length), e = document.createElement('div'); e.textContent = n; e.setAttribute('style', `position:fixed;left:${b.x + 10}px;top:${b.y + 8}px;color:#8ea3b6;font:11px ui-monospace,monospace;letter-spacing:1px;pointer-events:none;z-index:15`); document.body.append(e); return e; }); }
export function setTurning(on) { specimen.turning = on; if (specimen.obj) specimen.obj.traverse(o => { if (o.material?.uniforms?.uBend) o.material.uniforms.uBend.value = on ? 1 : 0; }); }
export function setWire(on) { specimen.wire = on; const walk = o => { if (o.material) o.material.wireframe = on; }; if (specimen.obj) specimen.obj.traverse(walk); }
export const specimenInfo = () => { const { item, size, tris } = specimen; if (!item || item.place) return item ? 'THE REAL PLACE, AS BUILT IN THE BAY' : ''; const measured = item.id === 'cownose' || item.id === 'fever-ray' ? size.x : size.z; return `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} M · ${tris.toLocaleString('en-US')} TRIS${item.real ? ` · REAL ${item.real} M ${Math.abs(measured - item.real) / item.real < 0.05 ? 'OK' : 'OFF'}` : ''}`; };
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
const LIST_PX = 210; let listEl = null, wireBtn = null, turnBtn = null, viewBtn = null;
function renderList() { if (!listEl) return; renderLabels(); for (const b of listEl.querySelectorAll('button[data-id]')) { const on = b.dataset.id === specimen.item?.id; b.style.color = on ? '#fff' : '#7f93a6'; b.style.background = on ? '#1c2a38' : 'none'; if (on) b.scrollIntoView({ block: 'nearest' }); }
  if (wireBtn) { viewBtn.textContent = `View: ${specimen.raw ? 'raw' : 'in game'}`; wireBtn.textContent = `Wires: ${specimen.wire ? 'on' : 'off'}`; turnBtn.textContent = `Swimming: ${specimen.turning ? 'a turn' : 'straight'}`; } }
export function stepSpecimenList(d) { const i = SPECIMENS.indexOf(specimen.item); showSpecimen(SPECIMENS[(i + d + SPECIMENS.length) % SPECIMENS.length].id); }
const BTN = 'display:block;width:100%;text-align:left;background:none;border:0;padding:2px 6px;border-radius:3px;cursor:pointer;font:inherit;color:#7f93a6';
export function enterSpecimens() {
  specimen.on = true; $('title').classList.add('gone'); document.title = 'BRACKISH models'; setDotPitch(3);
  listEl = document.createElement('nav'); listEl.setAttribute('style', `position:fixed;left:0;top:0;bottom:0;width:${LIST_PX}px;box-sizing:border-box;overflow:auto;padding:10px;background:#05080c;border-right:1px solid #1c2a38;font:12px/1.5 ui-monospace,monospace;z-index:20`);
  const tool = (fn) => { const b = document.createElement('button'); b.setAttribute('style', BTN + ';border:1px solid #1c2a38;margin-bottom:4px'); b.onclick = () => { fn(); renderList(); }; listEl.append(b); return b; };
  viewBtn = tool(() => { specimen.raw = !specimen.raw; }); wireBtn = tool(() => setWire(!specimen.wire)); turnBtn = tool(() => setTurning(!specimen.turning));
  let group = ''; for (const s of SPECIMENS) { if (s.group !== group) { group = s.group; const h = document.createElement('div'); h.textContent = group.toUpperCase(); h.setAttribute('style', 'color:#4d6072;margin:12px 0 2px'); listEl.append(h); }
    const b = document.createElement('button'); b.textContent = s.name; b.dataset.id = s.id; b.setAttribute('style', BTN); b.onclick = () => showSpecimen(s.id); listEl.append(b); }
  document.body.append(listEl);
  headEl = document.createElement('header'); headEl.setAttribute('style', `position:fixed;top:0;right:0;height:${HEAD_PX}px;box-sizing:border-box;padding:9px 14px;background:#05080c;border-bottom:1px solid #1c2a38;color:#e6edf3;font:13px/1.45 ui-monospace,monospace;z-index:15`); document.body.append(headEl); addEventListener('resize', renderLabels);
  addEventListener('keydown', e => { if (e.code === 'ArrowDown' || e.code === 'ArrowRight') { e.preventDefault(); stepSpecimenList(1); } if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') { e.preventDefault(); stepSpecimenList(-1); } });
  showSpecimen(SEARCH.get('specimens') || SPECIMENS[0].id);
}
