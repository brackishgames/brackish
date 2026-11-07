import * as THREE from 'three';
import { TUNE } from '../core/tune.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { DEM_GLSL, GLSL_COMMON, demUniforms, mat } from '../render/materials.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  SEAFLOOR + LAND  —  geometry clipmap displaced by the DEM on the GPU.
//  Nine rings: 1 m cells near you out to a 16 km horizon for the surface.
// ═══════════════════════════════════════════════════════════════════
export const CLIP_N = 64, CLIP_LEVELS = 9;
// each ring snaps to a grid twice as coarse as the ring inside it, so the inner one can sit a coarse cell off centre in the hole.
// a hole exactly its size would leave a strip with no floor (a black line that follows you); one coarse cell smaller, they always overlap
export const ringHole = level => level === 0 ? -1 : CLIP_N / 4 - 1;
export function ringGeometry(level) {
  const pos = [], idx = [], half = CLIP_N / 2, hole = ringHole(level), map = new Map();
  const vid = (i, j) => { const k = i + ',' + j; if (!map.has(k)) { map.set(k, pos.length / 3); pos.push(i, 0, j); } return map.get(k); };
  for (let j = -half; j < half; j++) for (let i = -half; i < half; i++) {
    if (hole > 0 && i >= -hole && i < hole && j >= -hole && j < hole) continue;
    const a = vid(i, j), b = vid(i + 1, j), c = vid(i, j + 1), d = vid(i + 1, j + 1); idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
export const floorVert = GLSL_COMMON + DEM_GLSL + /* glsl */`
  uniform vec2 uOrigin; uniform float uCell; varying vec3 vW; varying float vD;
  void main() { vec2 xz = uOrigin + position.xz * uCell; vW = vec3(xz.x, demAt(xz), xz.y);
    vec4 mv = modelViewMatrix * vec4(vW, 1.0); vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
export const floorFrag = GLSL_COMMON + /* glsl */`
  uniform float uVex, uBottomFade; varying vec3 vW; varying float vD;
  void main() {
    vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
    float l = 0.45 + 0.55 * max(dot(n, normalize(vec3(0.25, 1.0, 0.15))), 0.0);
    float y = vW.y / uVex, b, near = 1.0 - smoothstep(0.25, 0.8, fwidth(vW.x) + fwidth(vW.z));   // how much finer than a screen dot the detail is: past that it can only alias into rows and bands
    if (y < 0.0) {
      float r1 = sin(vW.x * 2.6 + sin(vW.z * 0.5) * 1.5 + uTime * 0.1), r2 = sin(vW.z * 2.1 - vW.x * 0.7);
      float sand = 1.0 + (0.07 * r1 + 0.05 * r2) * near;
      // patchy bottom: broad dark beds of grass and mud, lighter sand between
      float beds = sin(vW.x * 0.045 + sin(vW.z * 0.031) * 2.0) * sin(vW.z * 0.052 - vW.x * 0.017);
      sand *= 0.78 + 0.35 * smoothstep(-0.3, 0.5, beds);
      // speckle: shell and rubble
      float sp = fract(sin(dot(floor(vW.xz * 1.3), vec2(12.9898, 78.233))) * 43758.5453);
      sand += 0.35 * step(0.955, sp) * near;
      b = l * sand * mix(0.13, 0.40, depthLight(vW.y));
      b *= exp(-uBottomFade * max(0.0, cameraPosition.y - vW.y - 3.0));   // the bay is murky: light that reaches the bottom has to come back up to you. rise a little way off it and the bottom is gone, and you are hanging over nothing
      // caustics: sunlight focused by the surface, strongest in shallow water
      float c1 = sin(vW.x * 0.9 + uTime * 0.8) * sin(vW.z * 0.7 - uTime * 0.6), c2 = sin((vW.x + vW.z) * 0.55 + uTime * 0.9) * sin((vW.x - vW.z) * 0.4 - uTime * 0.5);
      float caus = pow(max(c1 + c2, 0.0) * 0.5, 2.2);
      b += 0.45 * caus * depthLight(vW.y) * exp(y * 0.12);
    } else {
      b = (0.16 + 0.12 * l) * (0.25 + 0.75 * uSun);
      float iso = abs(fract(y * 0.5 + 0.5) - 0.5) / max(fwidth(y * 0.5), 1e-4);
      b += 0.10 * (1.0 - smoothstep(0.0, 1.4, iso));
      b += 0.35 * (1.0 - smoothstep(0.0, 0.6, y));   // shoreline
    }
    gl_FragColor = outB(applyFog(b, vD));
  }`;
export const uBottomFade = { value: TUNE.water.bottomFade };
export const clipLevels = [];
for (let L = 0; L < CLIP_LEVELS; L++) {
  const m = new THREE.Mesh(ringGeometry(L), mat({ side: THREE.DoubleSide, vertexShader: floorVert, fragmentShader: floorFrag,
    uniforms: { ...demUniforms, uBottomFade, uOrigin: { value: new THREE.Vector2() }, uCell: { value: 2 ** L } } }));
  m.frustumCulled = false; scene.add(m); clipLevels.push(m);
}
export const clipOrigin = (p, cell) => { const s = cell * 2; return Math.floor(p / s) * s; };
export function updateClipmap(px, pz) { for (const m of clipLevels) { const c = m.material.uniforms.uCell.value; m.material.uniforms.uOrigin.value.set(clipOrigin(px, c), clipOrigin(pz, c)); } }
