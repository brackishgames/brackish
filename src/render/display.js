import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { DEV, MOBILE } from '../core/env.js?v=__BUILD__';
import { settings } from '../core/settings.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  RENDERER + DOT-MATRIX POST
// ═══════════════════════════════════════════════════════════════════
// no WebGL, or the GPU drops the display: say so in plain text instead of leaving a black screen
export function noGL(why) { const el = document.getElementById('nogl'); el.classList.add('on'); if (why) document.getElementById('noglwhy').textContent = why; }
export const renderer = (() => { try { return new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); } catch (e) { noGL('this browser could not start the 3D display'); throw e; } })();
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); noGL('the graphics card dropped the display. it will come back on its own, or reload the page'); });
renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());   // simpler and surer than rebuilding every texture
renderer.setPixelRatio(Math.min(MOBILE ? 1.5 : 2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.domElement.className = 'gl'; renderer.domElement.setAttribute('aria-hidden', 'true');
document.body.appendChild(renderer.domElement);
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 30000);

export let pitchCss = MOBILE ? 3 : 4;
export const lowRT = new THREE.WebGLRenderTarget(16, 16, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
// the cell pass: one fragment per dot, at grid resolution. contrast, depth and the OEL drive levels are the same for every
// pixel of a dot, so they are worked out here once instead of at every screen pixel.
export const cellRT = new THREE.WebGLRenderTarget(16, 16, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
export const cellMat = new THREE.ShaderMaterial({ uniforms: { tScene: { value: lowRT.texture }, uGrid: { value: new THREE.Vector2(16, 16) } }, depthTest: false, depthWrite: false,
  vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tScene; uniform vec2 uGrid;
    float bayer(vec2 c) { vec2 a = mod(c, 4.0), l = mod(a, 2.0), h = floor(a / 2.0);   // 4x4 ordered dither threshold in (0, 1)
      return ((l.x * 2.0 + l.y * 3.0 - l.x * l.y * 4.0) * 4.0 + h.x * 2.0 + h.y * 3.0 - h.x * h.y * 4.0 + 0.5) / 16.0; }
    void main() {
      vec2 cell = floor(gl_FragCoord.xy), uv = (cell + 0.5) / uGrid, px = 1.0 / uGrid;
      vec4 tx = texture2D(tScene, uv); float b = tx.r;
      float m = (texture2D(tScene, uv + vec2(px.x, 0.0)).r + texture2D(tScene, uv - vec2(px.x, 0.0)).r + texture2D(tScene, uv + vec2(0.0, px.y)).r + texture2D(tScene, uv - vec2(0.0, px.y)).r
               + texture2D(tScene, uv + 2.0 * vec2(px.x, 0.0)).r + texture2D(tScene, uv - 2.0 * vec2(px.x, 0.0)).r + texture2D(tScene, uv + 2.0 * vec2(0.0, px.y)).r + texture2D(tScene, uv - 2.0 * vec2(0.0, px.y)).r) / 8.0;
      b = clamp(b + 0.7 * max(b - m, 0.0), 0.0, 1.0);   // local contrast: bright things stand off flat fields. it only ever lifts: pushing a dot down for being next to something bright drew a black line along every edge
      b = pow(b, 1.25);                                 // deepen the mids so the field reads as dark water
      b = b < 0.012 ? 0.0 : max(1.0 / 49.0, pow(floor(sqrt(b) * 7.0 + bayer(cell)) / 7.0, 2.0));   // OEL drive: off, or one of seven perceptual levels (dense in the darks), ordered-dithered between them
      gl_FragColor = vec4(b, tx.g, 0.0, 1.0);
    }` });
export const cellScene = new THREE.Scene(), cellCam = new THREE.Camera(); { const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cellMat); q.frustumCulled = false; cellScene.add(q); }
export const DotShader = {
  uniforms: { tScene: { value: null }, tText: { value: null }, uGrid: { value: new THREE.Vector2() }, uPitch: { value: 8 }, uDim: { value: 0 }, uTunnel: { value: 0 }, uClose: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tScene, tText; uniform vec2 uGrid; uniform float uPitch, uDim, uTunnel, uClose;
    vec3 palette(float b) {
      b = clamp(b, 0.0, 1.0);
      vec3 c0 = vec3(0.01, 0.07, 0.12), c1 = vec3(0.03, 0.47, 0.72), c2 = vec3(0.30, 0.88, 0.94), c3 = vec3(0.96, 1.0, 1.0);   // leaning to the OEL's cyan
      return b < 0.4 ? mix(c0, c1, b / 0.4) : b < 0.75 ? mix(c1, c2, (b - 0.4) / 0.35) : mix(c2, c3, (b - 0.75) / 0.25);
    }
    void main() {
      vec2 cell = floor(gl_FragCoord.xy / uPitch), uv = (cell + 0.5) / uGrid, px = 1.0 / uGrid;
      vec4 tx = texture2D(tScene, uv); float b = tx.r, am = tx.g;   // each cell's drive level, worked out once per cell by the cell pass
      vec2 f = fract(gl_FragCoord.xy / uPitch) - 0.5;
      float d = length(f) * 2.0, r = 0.5 + 0.45 * b;
      float mask = 1.0 - smoothstep(r - 0.3, r + 0.05, d);
      vec3 unlit = vec3(0.003, 0.008, 0.012) * (1.0 - smoothstep(0.7, 0.95, d));
      vec3 col = palette(b) * mask;
      if (am > 0.03) { float ra = 0.5 + 0.45 * am, ma = 1.0 - smoothstep(ra - 0.3, ra + 0.05, d); col = mix(col, vec3(0.72, 0.84, 1.0) * (0.42 + 0.38 * am), ma); }
      vec2 vc = gl_FragCoord.xy / (uGrid * uPitch) - 0.5; float vig = (1.0 - 0.6 * smoothstep(0.2, 0.75, length(vc))) * (1.0 - uTunnel * smoothstep(0.18, 0.5, length(vc))) * (1.0 - uClose * smoothstep(0.22, 0.62, length(vc)));   // uClose: hunted, or out of air
      vec3 outc = (col * (1.0 - uDim) + unlit) * vig;
      float ptx = texture2D(tText, uv).r;   // the panel layer: every word and symbol is lit dots on the same matrix
      if (ptx > 0.0) { float rt = 0.5 + 0.42 * ptx, mt = 1.0 - smoothstep(rt - 0.3, rt + 0.05, d); outc = mix(outc, vec3(0.80, 0.90, 1.0) * (0.3 + 0.7 * ptx), mt); }
      gl_FragColor = vec4(outc, 1.0);
    }`,
};
export const hdrOK = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
export const composer = new EffectComposer(renderer, hdrOK ? undefined : new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.UnsignedByteType }));
export const dotPass = new ShaderPass(DotShader);
dotPass.uniforms.tScene.value = cellRT.texture;
composer.addPass(dotPass);
if (hdrOK) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.4, 0.55));   // half-res bloom: the look is soft anyway
// adaptive quality: if frames run slow for a few seconds, render at a lower pixel ratio (the dots keep their size); come back up when there is room
export const Q = { level: 0, ema: 1 / 60, slowT: 0, fastT: 0, last: performance.now(), dprs: [...new Set([Math.min(MOBILE ? 1.5 : 2, devicePixelRatio), 1.5, 1.25, 1].filter(v => v <= Math.min(MOBILE ? 1.5 : 2, devicePixelRatio)))] };
export function stepQuality(active) {   // active: the game is being played (not on the title, not paused)
  const t = performance.now(), dt = Math.min(0.25, (t - Q.last) / 1000); Q.last = t; Q.ema += (dt - Q.ema) * 0.05; if (!active || document.hidden) return;
  if (Q.ema > 1 / 40) { Q.slowT += dt; Q.fastT = 0; } else if (Q.ema < 1 / 57) { Q.fastT += dt; Q.slowT = 0; } else Q.slowT = Q.fastT = 0;
  if (Q.slowT > 3 && Q.level < Q.dprs.length - 1) Q.level++; else if (Q.fastT > 20 && Q.level > 0) Q.level--; else return;
  Q.slowT = Q.fastT = 0; renderer.setPixelRatio(Q.dprs[Q.level]); composer.setPixelRatio(Q.dprs[Q.level]); resize(); if (DEV) console.log('[quality] pixel ratio', Q.dprs[Q.level]);
}
export const resizeHooks = [], whenResized = fn => resizeHooks.push(fn);   // told the new dot grid when it changes
export function resize() {
  const dpr = renderer.getPixelRatio(), W = Math.floor(innerWidth * dpr), H = Math.floor(innerHeight * dpr);
  const pitch = Math.max(2, Math.round(pitchCss * dpr)), gw = Math.ceil(W / pitch), gh = Math.ceil(H / pitch);
  lowRT.setSize(gw, gh); cellRT.setSize(gw, gh); cellMat.uniforms.uGrid.value.set(gw, gh); dotPass.uniforms.uGrid.value.set(gw, gh); dotPass.uniforms.uPitch.value = pitch; for (const fn of resizeHooks) fn(gw, gh);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.userData.baseFov = settings.fov + (camera.aspect < 1 ? 18 : 0); camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
