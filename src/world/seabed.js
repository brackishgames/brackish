import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2 } from '../lib/rng.js?v=__BUILD__';
import { MOBILE } from '../core/env.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { GLSL_COMMON, WU, mat } from '../render/materials.js?v=__BUILD__';
import { floorAt } from './geo.js?v=__BUILD__';
import { structMat } from './structures.js?v=__BUILD__';
// the bottom near you: seagrass in the shallows, rocks where it is steep, sea fans on deeper hard ground. rebuilt as you move
export const grassCenter = new THREE.Vector2(1e9, 1e9);   // where the last rebuild was centred
// seagrass (instanced blades in the shallows)
export const GRASS_MAX = MOBILE ? 5000 : 14000;
export const tuftGeo = mergeGeometries([0, 1, 2].map(i => new THREE.PlaneGeometry(0.045, 0.45 + i * 0.08).translate(0, 0.25 + i * 0.04, 0).rotateZ(0.18).rotateY(i * 2.09).toNonIndexed()), false);
export const grass = new THREE.InstancedMesh(tuftGeo, mat({ side: THREE.DoubleSide,
  vertexShader: GLSL_COMMON + `varying float vD, vY, vU;
    void main(){ vec3 p = position; vec3 o = (instanceMatrix * vec4(0,0,0,1)).xyz; p.x += sin(uTime * 1.1 + o.x * 0.7 + o.z * 0.4) * uv.y * uv.y * 0.22; p.z += cos(uTime * 0.9 + o.x * 0.3) * uv.y * uv.y * 0.12;
      vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0); vY = w.y; vU = uv.y; vec4 mv = viewMatrix * w; vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
  uniforms: { uLift: { value: 0 } },
  fragmentShader: GLSL_COMMON + `uniform float uLift; varying float vD, vY, vU; void main(){ float b = (0.06 + uLift + 0.3 * vU * vU) * mix(0.4, 1.0, depthLight(vY)); gl_FragColor = outB(applyFog(b, vD)); }` }), GRASS_MAX);
grass.frustumCulled = false; grass.count = 0; scene.add(grass);
export const ROCK_MAX = 1600, FAN_MAX = 1200;
export const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), structMat, ROCK_MAX); rocks.frustumCulled = false; rocks.count = 0; scene.add(rocks);
export const fanGeo = mergeGeometries([new THREE.CircleGeometry(0.55, 12, 0, Math.PI).translate(0, 0.35, 0).toNonIndexed(), new THREE.PlaneGeometry(0.05, 0.4).translate(0, 0.2, 0).toNonIndexed()], false);
export const fanMat = grass.material.clone(); fanMat.uniforms.uTime = WU.uTime; fanMat.uniforms.uFogD = WU.uFogD; fanMat.uniforms.uFogB = WU.uFogB; fanMat.uniforms.uSun = WU.uSun; fanMat.uniforms.uSunDir = WU.uSunDir; fanMat.uniforms.uLift = { value: 0.14 };
export const fans = new THREE.InstancedMesh(fanGeo, fanMat, FAN_MAX); fans.frustumCulled = false; fans.count = 0; scene.add(fans);
export function rebuildGrass(px, pz) {
  const m = new THREE.Matrix4(), R = 70, step = 1.4; let k = 0; const cx = Math.round(px / step) * step, cz = Math.round(pz / step) * step;
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
