import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2 } from '../lib/rng.js?v=__BUILD__';
import { MOBILE } from '../core/env.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { GLSL_COMMON, WU, mat } from '../render/materials.js?v=__BUILD__';
import { floorAt } from './geo.js?v=__BUILD__';
import { structMat } from './structures.js?v=__BUILD__';
// the bottom near you: seagrass in the shallows, rocks where it is steep, sea fans on deeper hard ground. rebuilt as you move
export const grassCenter = new THREE.Vector2(1e9, 1e9);   // where the last rebuild was centred
const _sc = new THREE.Vector3(), _e = new THREE.Euler();   // scratch for the rebuild
// seagrass (instanced blades in the shallows)
export const GRASS_MAX = MOBILE ? 5000 : 14000, GRASS_R = 70, GRASS_FADE = [38, 62];   // metres: how far the patch reaches, and where blades shrink away well inside it, so its edge never lines up into rows of dashes or pops in as you swim
export const tuftGeo = mergeGeometries([0, 1, 2].map(i => { const h = 0.45 + i * 0.1, g = new THREE.PlaneGeometry(0.05, h, 1, 3).translate(0, h / 2, 0), q = g.attributes.position; for (let k = 0; k < q.count; k++) { const t = q.getY(k) / h; q.setX(k, q.getX(k) * (1 - 0.75 * t * t * t) + 0.16 * t * t); } return g.rotateY(i * 2.09).toNonIndexed(); }), false);   // turtle grass: flat straps that narrow and lean
export const grass = new THREE.InstancedMesh(tuftGeo, mat({ side: THREE.DoubleSide,
  vertexShader: GLSL_COMMON + `varying float vD, vY, vU;
    void main(){ vec3 p = position; vec3 o = (instanceMatrix * vec4(0,0,0,1)).xyz; float keep = 1.0 - smoothstep(${GRASS_FADE[0].toFixed(1)}, ${GRASS_FADE[1].toFixed(1)}, length((viewMatrix * vec4(o, 1.0)).xyz)); p.x += sin(uTime * 1.1 + o.x * 0.7 + o.z * 0.4) * uv.y * uv.y * 0.22; p.z += cos(uTime * 0.9 + o.x * 0.3) * uv.y * uv.y * 0.12;
      vec4 w = modelMatrix * instanceMatrix * vec4(p * keep, 1.0); vY = w.y; vU = uv.y; vec4 mv = viewMatrix * w; vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
  uniforms: { uLift: { value: 0 } },
  fragmentShader: GLSL_COMMON + `uniform float uLift; varying float vD, vY, vU; void main(){ float b = (0.06 + uLift + 0.3 * vU * vU) * mix(0.4, 1.0, depthLight(vY)); gl_FragColor = outB(applyFog(b, vD)); }` }), GRASS_MAX);
grass.frustumCulled = false; grass.count = 0; scene.add(grass);
// a rock: a ball pushed about at two scales, so no two sides match, and smooth to the eye
export function rockGeometry() { let g = new THREE.IcosahedronGeometry(1, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4); const q = g.attributes.position; for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), z = q.getZ(i), k = 0.82 + 0.16 * Math.sin(x * 2.3 + y * 1.1) * Math.cos(z * 1.9) + 0.07 * Math.sin(x * 6.1 - z * 4.3 + y * 5.2); q.setXYZ(i, x * k, y * k * 0.78, z * k); } g.computeVertexNormals(); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(q.count * 2).fill(0), 2)); return g; }
export const ROCK_MAX = 1600, FAN_MAX = 1200;
export const rocks = new THREE.InstancedMesh(rockGeometry(), structMat, ROCK_MAX); rocks.frustumCulled = false; rocks.count = 0; scene.add(rocks);
// a sea fan: a holdfast and a stem that forks, and forks again, into a flat lace
export const fanGeo = (() => { const pos = [], uv = [], seg = (a, b, wa, wb, H) => { pos.push(a[0] - wa, a[1], 0, a[0] + wa, a[1], 0, b[0] - wb, b[1], 0, b[0] - wb, b[1], 0, a[0] + wa, a[1], 0, b[0] + wb, b[1], 0); uv.push(0, a[1] / H, 1, a[1] / H, 0, b[1] / H, 0, b[1] / H, 1, a[1] / H, 1, b[1] / H); };
  const grow = (p, ang, len, w, d) => { const q = [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len]; seg(p, q, w, w * 0.72, 1); if (d > 0) for (const t of [-1, 1]) grow(q, ang + t * (0.34 + 0.05 * d) , len * 0.74, w * 0.72, d - 1); }; grow([0, 0], 0, 0.26, 0.024, 6);
  const g = new THREE.BufferGeometry(), n = pos.length / 3; g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; })();
export const fanMat = grass.material.clone(); fanMat.uniforms.uTime = WU.uTime; fanMat.uniforms.uFogD = WU.uFogD; fanMat.uniforms.uFogB = WU.uFogB; fanMat.uniforms.uSun = WU.uSun; fanMat.uniforms.uSunDir = WU.uSunDir; fanMat.uniforms.uRaw = WU.uRaw; fanMat.uniforms.uFill = WU.uFill; fanMat.uniforms.uLift = { value: 0.14 };
export const fans = new THREE.InstancedMesh(fanGeo, fanMat, FAN_MAX); fans.frustumCulled = false; fans.count = 0; scene.add(fans);
export function rebuildGrass(px, pz) {
  const m = new THREE.Matrix4(), R = GRASS_R, step = 1.4; let k = 0; const cx = Math.round(px / step) * step, cz = Math.round(pz / step) * step;
  for (let z = cz - R; z <= cz + R && k < GRASS_MAX; z += step) for (let x = cx - R; x <= cx + R && k < GRASS_MAX; x += step) {
    if (hash2(x * 7, z * 13) > 0.2) continue; const f = floorAt(x, z); if (f > -0.4 || f < -5.5) continue;
    const jx = (hash2(x, z) - 0.5) * step, jz = (hash2(z, x) - 0.5) * step, s = 0.6 + hash2(x + 1, z + 1) * 0.9;
    m.makeRotationY(hash2(x + 3, z) * 6.28); m.scale(_sc.set(1, s, 1)); m.setPosition(x + jx, floorAt(x + jx, z + jz), z + jz); grass.setMatrixAt(k++, m);
  }
  grass.count = k; grass.instanceMatrix.needsUpdate = true; grassCenter.set(px, pz);
  // rocks where the bottom is steep (channel walls, the hole), sea fans on deeper hard bottom
  let kr = 0, kf = 0; const stepR = 2.2;
  for (let z = cz - R; z <= cz + R; z += stepR) for (let x = cx - R; x <= cx + R; x += stepR) {
    const f = floorAt(x, z); if (f > -1.2) continue;
    const slope = Math.abs(floorAt(x + 3, z) - floorAt(x - 3, z)) + Math.abs(floorAt(x, z + 3) - floorAt(x, z - 3));
    const h = hash2(x * 3 + 7, z * 5 + 1);
    if (kr < ROCK_MAX && slope > 0.9 && h < Math.min(0.6, slope * 0.25)) { const sz = 0.3 + hash2(x, z + 9) * (0.6 + slope * 0.4);
      m.makeRotationFromEuler(_e.set(hash2(x + 2, z) * 3, hash2(x, z + 2) * 6, 0)); m.scale(_sc.set(sz * 1.4, sz * 0.8, sz)); m.setPosition(x + (h - .5) * 2, f + sz * 0.35, z + (hash2(z, x) - .5) * 2); rocks.setMatrixAt(kr++, m); }
    else if (kf < FAN_MAX && f < -6 && slope < 0.5 && h > 0.955) { const sz = 0.5 + hash2(x + 5, z) * 1.2;
      m.makeRotationY(hash2(x + 3, z) * 6.28); m.scale(_sc.set(sz, sz, 1)); m.setPosition(x, f, z); fans.setMatrixAt(kf++, m); }
  }
  rocks.count = kr; rocks.instanceMatrix.needsUpdate = true; fans.count = kf; fans.instanceMatrix.needsUpdate = true;
}
