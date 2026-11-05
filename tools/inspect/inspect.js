// Look at a model exported from the game (tools/export-model.mjs), lit plainly, with sea level shown and heights read out.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const name = new URLSearchParams(location.search).get('model') || 'skyway';
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(devicePixelRatio); renderer.setSize(innerWidth, innerHeight); document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1016);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 20000); camera.position.set(400, 260, 500);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 10, 0);
// ?cam=x,y,z&look=x,y,z (metres from the model's centre, y up): open on a particular view, to share or compare
for (const [key, v] of [['cam', camera.position], ['look', controls.target]]) { const q = new URLSearchParams(location.search).get(key)?.split(',').map(Number); if (q?.length === 3 && q.every(Number.isFinite)) v.set(...q); }
controls.update();
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a3020, 1.2)); const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(300, 600, 200); scene.add(sun);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f7fbf, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
scene.add(sea);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
new GLTFLoader().load(`models/${name}.glb`, gltf => {
  const model = gltf.scene, info = model.userData || {}, R = info.radius ?? 900; scene.add(model); sea.scale.set(2 * R, 1, 2 * R);
  document.getElementById('info').innerHTML = `<small>${name}.glb · ${R} m around ${info.centre ? info.centre.join(', ') : 'its centre'}${info.bridges ? ` · ${info.bridges} bridges` : ''}</small>`;
  // glTF turns the spaces in names into underscores: they go back for the list and the readout
  const groups = new Map(); model.traverse(o => { if (o.isMesh) { const k = (o.name || 'part').replace(/_/g, ' '); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); } });
  const parts = document.getElementById('parts');
  for (const [k, list] of groups) { const count = list.reduce((n, o) => n + (o.isInstancedMesh ? o.count : 1), 0), l = document.createElement('label');
    l.innerHTML = `<input type="checkbox" checked> ${k} <small>(${count})</small>`; l.querySelector('input').onchange = e => list.forEach(o => o.visible = e.target.checked); parts.append(l); }
}, undefined, e => { document.getElementById('info').textContent = `could not load models/${name}.glb: run node tools/export-model.mjs first`; console.error(e); });
// what's under the pointer, and how high it is relative to the sea
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), readout = document.getElementById('readout');
addEventListener('pointermove', e => {
  ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(scene.children, true).find(h => h.object !== sea && h.object.visible);
  if (!hit) { readout.textContent = 'point at something to read its height'; return; }
  const y = hit.point.y; readout.textContent = `${(hit.object.name || 'part').replace(/_/g, ' ')} · ${y >= 0 ? y.toFixed(1) + ' m above the sea' : (-y).toFixed(1) + ' m below the sea'}`;
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
