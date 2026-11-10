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
export const setDotPitch = px => { pitchCss = px; resize(); };   // the model page shows four views at once, so it needs finer dots than the game
export const lowRT = new THREE.WebGLRenderTarget(16, 16, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, samples: 4 });   // a thing smaller than a dot lights it partly, rather than all or not at all: fins stay joined, far fish stay dim
// what lies beyond the surface, drawn first with the surface left out, so the surface can then show it bent by its waves: refraction, done on the screen. from the air that is
// the water and what is in it; from below, inside the bright window overhead, what stands in the air. the matrix has few dots, so drawing the bay twice costs little
export const behindRT = new THREE.WebGLRenderTarget(16, 16, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
// the lens and the sea. every dot of the lens is in the water or in the air, and with the lens at the surface some are each. SEA says which, dot by dot, from where that spot of
// the lens is and how high the waves stand there: what is drawn through a wet dot is seen through water, through a dry one through air, so the waterline crosses the screen as the
// lens crosses the surface, with nothing to hide and no cut. src/app/frame.js sets it once a frame (setLens)
export const SEA = { uTime: { value: 0 }, uChop: { value: 0.1 }, uWavePeriod: { value: 2 }, uWindDir: { value: new THREE.Vector2(1, 0) }, uSide: { value: -1 }, uGlint: { value: 0.4 }, uWet: { value: 0 }, uWetAge: { value: 99 }, tBehind: { value: behindRT.texture }, uRes: { value: new THREE.Vector2(16, 16) }, uThru: { value: 0 }, uPass: { value: 0 },
  uLensO: { value: new THREE.Vector3() }, uLensX: { value: new THREE.Vector3() }, uLensY: { value: new THREE.Vector3() } };   // uSide: -1 the whole lens is under, 1 all of it is out, 0 the surface is across it. uWet: 1 as the lens leaves the water, running down to 0 as it dries; uWetAge: seconds since it left. uThru: the surface may look through itself at tBehind; uPass: 1 while tBehind is being drawn
export const GLSL_SEA = /* glsl */`
  uniform float uTime, uChop, uWavePeriod, uSide, uGlint, uWet, uWetAge, uThru, uPass; uniform sampler2D tBehind; uniform vec2 uWindDir, uRes; uniform vec3 uLensO, uLensX, uLensY;
  float seaWave(vec2 p, vec2 dir, float period, float amp) { float w = 6.2832 / period, k = w * w / 9.81; return amp * sin(k * dot(dir, p) - w * uTime); }
  float seaH(vec2 p) { vec2 d = uWindDir, s = vec2(-d.y, d.x); return uChop * (seaWave(p, d, uWavePeriod, 0.3) + seaWave(p, normalize(d + s * 0.4), uWavePeriod * 0.72, 0.16) + seaWave(p, normalize(d - s * 0.55), uWavePeriod * 1.3, 0.12)); }   // the same three wave trains the surface is built from (render/effects.js)
  #ifdef FRAG
  float lensH() { vec3 q = uLensO + uLensX * gl_FragCoord.x + uLensY * gl_FragCoord.y; return q.y - seaH(q.xz); }   // how far above the water (m) the spot of the lens this dot looks through is
  float lensDot() { return 0.6 * (abs(uLensX.y) + abs(uLensY.y)) + 1e-5; }   // about one dot of the lens, in those metres
  float dry() { if (abs(uSide) > 0.5) return step(0.0, uSide); float w = lensDot(); return smoothstep(-w, w, lensH()); }
  #else
  float dry() { return step(0.0, uSide); }
  #endif
`;
// the cell pass: one fragment per dot, at grid resolution. contrast, depth and the OEL drive levels are the same for every
// pixel of a dot, so they are worked out here once instead of at every screen pixel.
export const cellRT = new THREE.WebGLRenderTarget(16, 16, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
export const cellMat = new THREE.ShaderMaterial({ uniforms: { ...SEA, tScene: { value: lowRT.texture }, uGrid: { value: new THREE.Vector2(16, 16) } }, depthTest: false, depthWrite: false,
  vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: '#define FRAG\n' + GLSL_SEA + /* glsl */`
    uniform sampler2D tScene; uniform vec2 uGrid;
    float hash1(float x) { return fract(sin(x * 12.9898) * 43758.5453); }
    float bayer(vec2 c) { vec2 a = mod(c, 4.0), l = mod(a, 2.0), h = floor(a / 2.0);   // 4x4 ordered dither threshold in (0, 1)
      return ((l.x * 2.0 + l.y * 3.0 - l.x * l.y * 4.0) * 4.0 + h.x * 2.0 + h.y * 3.0 - h.x * h.y * 4.0 + 0.5) / 16.0; }
    void main() {
      vec2 cell = floor(gl_FragCoord.xy), uv = (cell + 0.5) / uGrid, px = 1.0 / uGrid; float line = 0.0;
      if (abs(uSide) < 0.5) { float h = lensH(), w = lensDot();   // the waterline on the lens: a bright meniscus where the water climbs the glass, and just under it the picture swims
        line = 1.0 - smoothstep(0.8 * w, 2.6 * w, abs(h)); if (h < 0.0) uv.x += px.x * 1.6 * sin(cell.y * 0.8 + uTime * 5.0) * exp(h / (14.0 * w)); }
      if (uWet > 0.0 && dry() > 0.5) {   // out of the water the lens is still wet, quietly: one faint line of water follows the waterline down the glass, and then a few beads run down after it,
        float lit = 0.55 * sqrt(uWet);          // each with a thin trail. nothing in the picture moves for it: it is light on the glass, never a bend in the view, so it can not make anyone dizzy
        { float y = uGrid.y * (0.8 - 0.75 * uWetAge) + 2.0 * sin(cell.x * 0.11 + uTime * 2.0) + 3.5 * sin(cell.x * 0.037 - uTime * 0.8); line = max(line, 0.45 * (1.0 - smoothstep(0.5, 1.6, abs(cell.y - y)))); }
        float band = floor(cell.x / 3.0), r = hash1(band), r2 = hash1(band + 17.0);
        if (r < 0.2) { float fall = fract(uTime * (0.07 + 0.1 * r2) + r * 9.0), head = uGrid.y * (1.15 - 1.3 * fall), up = cell.y - head, len = uGrid.y * (0.06 + 0.12 * r2);
          if (up > -1.5 && up < len) { float mid = 1.0 - abs(mod(cell.x, 3.0) - 1.0), t = clamp(up / len, 0.0, 1.0);
            line = max(line, lit * mid * max(1.0 - smoothstep(0.5, 2.0, abs(up - 0.5)), 0.25 * (1.0 - t) * (1.0 - t))); } } }
      vec4 tx = texture2D(tScene, uv); float b = tx.r;
      float m = (texture2D(tScene, uv + vec2(px.x, 0.0)).r + texture2D(tScene, uv - vec2(px.x, 0.0)).r + texture2D(tScene, uv + vec2(0.0, px.y)).r + texture2D(tScene, uv - vec2(0.0, px.y)).r
               + texture2D(tScene, uv + 2.0 * vec2(px.x, 0.0)).r + texture2D(tScene, uv - 2.0 * vec2(px.x, 0.0)).r + texture2D(tScene, uv + 2.0 * vec2(0.0, px.y)).r + texture2D(tScene, uv - 2.0 * vec2(0.0, px.y)).r) / 8.0;
      b = clamp(b + 0.7 * max(b - m, 0.0), 0.0, 1.0);   // local contrast: bright things stand off flat fields. it only ever lifts: pushing a dot down for being next to something bright drew a black line along every edge
      b = max(b, uGlint * line);
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
      if (ptx > 0.0) { float rt = 0.5 + 0.42 * ptx, mt = 1.0 - smoothstep(rt - 0.3, rt + 0.05, d); outc = max(outc, vec3(0.80, 0.90, 1.0) * (0.3 + 0.7 * ptx) * mt); }   // light only ever adds: a dim word over bright water must never punch a hole in it
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
  lowRT.setSize(gw, gh); behindRT.setSize(gw, gh); SEA.uRes.value.set(gw, gh); cellRT.setSize(gw, gh); cellMat.uniforms.uGrid.value.set(gw, gh); dotPass.uniforms.uGrid.value.set(gw, gh); dotPass.uniforms.uPitch.value = pitch; for (const fn of resizeHooks) fn(gw, gh);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.userData.baseFov = settings.fov + (camera.aspect < 1 ? 18 : 0); camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
