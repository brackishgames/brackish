// Export what the game built around a point (structures, and a patch of the real seabed) as a .glb, to look at in
// tools/inspect or any glTF viewer.   node tools/export-model.mjs [lat lon radius name]     (default: the Skyway, 900 m)
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from '../tests/chrome.mjs';
import { serve } from './serve.mjs';
const [lat = 27.6205, lon = -82.6555, radius = 900, name = 'skyway'] = process.argv.slice(2).map((v, i) => i < 3 ? +v : v);
const server = await serve(0), browser = await launch(), page = await browser.page();
await page.open(`http://localhost:${server.address().port}/?dev`);
// the bridges the game uses: OpenStreetMap's when they arrive, the built-in set if not
const osm = await page.until('bridges.length > 4', "OpenStreetMap's bridges").then(() => true, () => false);
const b64 = await page.eval(`(async () => {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const [cx, cz] = toXZ(${lat}, ${lon}), R = ${radius}, out = new THREE.Scene(), M = new THREE.Matrix4(), at = new THREE.Vector3(), size = new THREE.Vector3();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.7, metalness: 0.1 });
  for (const m of world.meshes) {
    if (m.isInstancedMesh) {
      const keep = []; for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); at.setFromMatrixPosition(M); size.setFromMatrixScale(M); if (Math.hypot(at.x - cx, at.z - cz) < R + Math.max(size.x, size.z) / 2) keep.push(M.clone()); }
      if (!keep.length) continue;
      const im = new THREE.InstancedMesh(m.geometry, steel, keep.length); im.name = m.name || 'structure';
      keep.forEach((k, i) => { k.elements[12] -= cx; k.elements[14] -= cz; im.setMatrixAt(i, k); }); out.add(im);
    } else if (Math.hypot(m.position.x - cx, m.position.z - cz) < R) {
      const c = new THREE.Mesh(m.geometry, steel); c.name = m.name || 'structure'; c.position.set(m.position.x - cx, m.position.y, m.position.z - cz); c.quaternion.copy(m.quaternion); c.scale.copy(m.scale); out.add(c);
    }
  }
  // the seabed, from the same depths the game uses (the game displaces it on the GPU, so it is rebuilt here)
  const n = 180, floor = new THREE.PlaneGeometry(2 * R, 2 * R, n, n).rotateX(-Math.PI / 2), pos = floor.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, floorAt(pos.getX(i) + cx, pos.getZ(i) + cz));
  floor.computeVertexNormals(); const bed = new THREE.Mesh(floor, new THREE.MeshStandardMaterial({ color: 0x6b6150, roughness: 1 })); bed.name = 'seabed'; out.add(bed);
  out.userData = { centre: [${lat}, ${lon}], radius: R, bridges: bridges.length };
  const glb = await new GLTFExporter().parseAsync(out, { binary: true });
  let s = ''; const u = new Uint8Array(glb); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s);
})()`);
mkdirSync(new URL('./inspect/models/', import.meta.url), { recursive: true }); writeFileSync(new URL(`./inspect/models/${name}.glb`, import.meta.url), Buffer.from(b64, 'base64'));
console.log(`${name}.glb: ${(b64.length * 0.75 / 1024).toFixed(0)} KB, ${radius} m around ${lat}, ${lon}, with ${osm ? "OpenStreetMap's" : 'the built-in'} bridges → open http://localhost:8000/tools/inspect/?model=${name}`);
browser.close(); server.close(); process.exit(0);
