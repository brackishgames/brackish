import * as THREE from 'three';
import { rand } from '../core/random.js?v=__BUILD__';
import { camera, dotPass, scene } from '../render/display.js?v=__BUILD__';
import { GLSL_COMMON, mat } from '../render/materials.js?v=__BUILD__';
import { P } from '../actors/player.js?v=__BUILD__';
import { started } from '../systems/story.js?v=__BUILD__';
import { camPos } from '../app/frame.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  BUBBLE LOGO  —  the title hangs in the water as bubbles and scatters
//  when you start swimming. Amber travels in the G channel.
// ═══════════════════════════════════════════════════════════════════
export const LOGO_FONT = {
  B: ['1111.', '1...1', '1...1', '1111.', '1...1', '1...1', '1111.'], R: ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'],
  A: ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'], C: ['.1111', '1....', '1....', '1....', '1....', '1....', '.1111'],
  K: ['1...1', '1..1.', '1.1..', '11...', '1.1..', '1..1.', '1...1'], I: ['11111', '..1..', '..1..', '..1..', '..1..', '..1..', '11111'],
  S: ['.1111', '1....', '1....', '.111.', '....1', '....1', '1111.'], H: ['1...1', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
};
export const LOGO_RAY = ['........11.11........', '.....11111111111.....', '..1111111111111111...', '.1111111111111111111.', '111111111111111111111', '.1111111111111111111.', '...111111111111111...', '......111111111......', '.........111.........', '..........1..........', '..........1..........', '..........1..........'];
export const logo = (() => {
  const pts = [];   // [col, row, brightness, amber]
  const word = 'BRACKISH', cols = word.length * 6 - 1, rw = LOGO_RAY[0].length, rh = LOGO_RAY.length, W = Math.max(cols, rw);
  LOGO_RAY.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '1') { const d = Math.abs(i - (rw >> 1)) / (rw / 2); pts.push([(W - rw) / 2 + i, j, d < 0.15 ? 1.0 : d < 0.55 ? 0.85 : 0.65, 0]); } }));
  [...word].forEach((ch, n) => LOGO_FONT[ch].forEach((row, j) => [...row].forEach((c, i) => { if (c === '1') pts.push([(W - cols) / 2 + n * 6 + i, rh + 2 + j, 0, 1]); })));
  const H = rh + 2 + 7, N = pts.length, tgt = new Float32Array(N * 3), col = new Float32Array(N * 2), seed = new Float32Array(N);
  pts.forEach(([c, r, b, a], i) => { tgt[i * 3] = c - W / 2; tgt[i * 3 + 1] = H / 2 - r; tgt[i * 3 + 2] = 0; col[i * 2] = b; col[i * 2 + 1] = a; seed[i] = rand() * 100; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aTarget', new THREE.BufferAttribute(tgt, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 2)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = mat({ transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uOrigin: { value: new THREE.Vector3() }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uSpacing: { value: 0.08 }, uGo: { value: -1 }, uSize: { value: 3 }, uGrid: dotPass.uniforms.uGrid },
    vertexShader: GLSL_COMMON + `attribute vec3 aTarget; attribute vec2 aCol; attribute float aSeed; uniform vec3 uOrigin, uRight, uUp; uniform float uSpacing, uGo, uSize; uniform vec2 uGrid;
      varying vec2 vCol; varying float vFade;
      float h(float x) { return fract(sin(x * 12.9898) * 43758.5453); }
      void main() {
        vec3 p = uOrigin + uRight * aTarget.x * uSpacing + uUp * aTarget.y * uSpacing;
        p += uUp * sin(uTime * 1.7 + aSeed) * uSpacing * 0.04 + uRight * sin(uTime * 1.1 + aSeed * 2.0) * uSpacing * 0.03;
        // every bubble has a life: it rises into its slot, holds, slips away, and another rises to replace it
        float period = 16.0 + h(aSeed + 3.0) * 14.0, ph = fract((uTime + h(aSeed + 4.0) * period * 3.0) / period);
        float rise = 1.0 - smoothstep(0.0, 0.05, ph), leave = smoothstep(0.95, 1.0, ph);
        p.y -= rise * rise * 2.5; p.y += leave * leave * 1.4; p.x += leave * sin(uTime * 3.0 + aSeed) * 0.25;
        float life = (1.0 - rise * 0.8) * (1.0 - leave);
        float go = max(uGo, 0.0), d = go + h(aSeed) * 0.6;   // on start they all let go: rise, wander, fade
        if (uGo >= 0.0) { p.y += d * d * 0.9; p += (vec3(h(aSeed + 1.0), 0.0, h(aSeed + 2.0)) - 0.5) * d * 1.6; p.x += sin(uTime * 4.0 + aSeed) * d * 0.15; }
        float drip = step(h(aSeed + 7.0), 0.07) * step(aCol.y, 0.5), dt2 = fract(uTime * 0.035 + h(aSeed + 8.0));   // a few bubbles bleed slowly downward
        if (uGo < 0.0) { p -= uUp * drip * dt2 * uSpacing * 9.0; life *= 1.0 - drip * smoothstep(0.4, 1.0, dt2); }
        float drop = step(0.996, fract(sin(floor(uTime * 6.0) * 12.9 + aSeed * 3.1) * 4375.5));   // rare dropouts, like a failing segment
        vFade = (uGo < 0.0 ? life * (1.0 - 0.85 * drop) : 1.0 - smoothstep(1.2, 3.4, d)); vCol = aCol;
        vec4 cp = projectionMatrix * viewMatrix * vec4(p, 1.0);
        if (uGo < 0.0 && cp.w > 0.0) { vec2 ndc = cp.xy / cp.w; vec2 px = floor((ndc * 0.5 + 0.5) * uGrid) + 0.5; cp.xy = (px / uGrid * 2.0 - 1.0) * cp.w; }   // snap to the dot matrix
        gl_PointSize = uSize; gl_Position = cp; }`,
    fragmentShader: GLSL_COMMON + `varying vec2 vCol; varying float vFade;
      void main() { if (length(gl_PointCoord - 0.5) > 0.5) discard; float f = vFade * (0.8 + 0.2 * sin(uTime * 0.9)); gl_FragColor = vec4(vCol.x * f, vCol.y * f, 0.0, 1.0); }` });
  const mesh = new THREE.Points(g, m); mesh.frustumCulled = false; mesh.renderOrder = 10; scene.add(mesh);
  return { mesh, m, release: () => { if (m.uniforms.uGo.value < 0) m.uniforms.uGo.value = 0; } };
})();
export function stepLogo(dt) {
  const u = logo.m.uniforms; if (u.uGo.value >= 0) { u.uGo.value += dt; if (u.uGo.value > 5) { logo.mesh.visible = false; return; } }
  const dist = 7.5, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  if (u.uGo.value < 0 && !started) { u.uOrigin.value.copy(camPos).addScaledVector(fwd, dist).addScaledVector(up, 1.1); u.uRight.value.copy(right); u.uUp.value.copy(up);
    const gh = dotPass.uniforms.uGrid.value.y || 300; u.uSpacing.value = 3.0 * (2 * dist * Math.tan(camera.fov * Math.PI / 360)) / gh; }
  u.uSize.value = 3.4;
  if (u.uGo.value < 0 && started) { logo.held = (logo.held || 0) + dt; if (P.pos.distanceTo(u.uOrigin.value) < 3.0 || logo.held > 14) logo.release(); }
}
