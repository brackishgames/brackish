'use strict';
// ═══════════════════════════════════════════════════════════════════
//  RENDERER + DOT-MATRIX POST
// ═══════════════════════════════════════════════════════════════════
// no WebGL, or the GPU drops the display: say so in plain text instead of leaving a black screen
function noGL(why) { const el = document.getElementById('nogl'); el.classList.add('on'); if (why) document.getElementById('noglwhy').textContent = why; }
const renderer = (() => { try { return new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); } catch (e) { noGL('this browser could not start the 3D display'); throw e; } })();
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); noGL('the graphics card dropped the display. it will come back on its own, or reload the page'); });
renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());   // simpler and surer than rebuilding every texture
renderer.setPixelRatio(Math.min(MOBILE ? 1.5 : 2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.domElement.className = 'gl'; renderer.domElement.setAttribute('aria-hidden', 'true');
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 30000);

let pitchCss = MOBILE ? 3 : 4;
const lowRT = new THREE.WebGLRenderTarget(16, 16, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
// the cell pass: one fragment per dot, at grid resolution. contrast, depth and the OEL drive levels are the same for every
// pixel of a dot, so they are worked out here once instead of at every screen pixel.
const cellRT = new THREE.WebGLRenderTarget(16, 16, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
const cellMat = new THREE.ShaderMaterial({ uniforms: { tScene: { value: lowRT.texture }, uGrid: { value: new THREE.Vector2(16, 16) } }, depthTest: false, depthWrite: false,
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
      b = clamp(b + 0.7 * (b - m), 0.0, 1.0);          // local contrast: bright things stand off flat fields
      b = pow(b, 1.25);                                 // deepen the mids so the field reads as dark water
      b = b < 0.012 ? 0.0 : max(1.0 / 49.0, pow(floor(sqrt(b) * 7.0 + bayer(cell)) / 7.0, 2.0));   // OEL drive: off, or one of seven perceptual levels (dense in the darks), ordered-dithered between them
      gl_FragColor = vec4(b, tx.g, 0.0, 1.0);
    }` });
const cellScene = new THREE.Scene(), cellCam = new THREE.Camera(); { const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cellMat); q.frustumCulled = false; cellScene.add(q); }
const DotShader = {
  uniforms: { tScene: { value: null }, tText: { value: null }, uGrid: { value: new THREE.Vector2() }, uPitch: { value: 8 }, uDim: { value: 0 }, uTunnel: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tScene, tText; uniform vec2 uGrid; uniform float uPitch, uDim, uTunnel;
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
      vec2 vc = gl_FragCoord.xy / (uGrid * uPitch) - 0.5; float vig = (1.0 - 0.6 * smoothstep(0.2, 0.75, length(vc))) * (1.0 - uTunnel * smoothstep(0.18, 0.5, length(vc)));
      vec3 outc = (col * (1.0 - uDim) + unlit) * vig;
      float ptx = texture2D(tText, uv).r;   // the panel layer: every word and symbol is lit dots on the same matrix
      if (ptx > 0.0) { float rt = 0.5 + 0.42 * ptx, mt = 1.0 - smoothstep(rt - 0.3, rt + 0.05, d); outc = mix(outc, vec3(0.80, 0.90, 1.0) * (0.3 + 0.7 * ptx), mt); }
      gl_FragColor = vec4(outc, 1.0);
    }`,
};
const hdrOK = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
const composer = new EffectComposer(renderer, hdrOK ? undefined : new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.UnsignedByteType }));
const dotPass = new ShaderPass(DotShader);
dotPass.uniforms.tScene.value = cellRT.texture;
composer.addPass(dotPass);
if (hdrOK) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.4, 0.55));   // half-res bloom: the look is soft anyway
// adaptive quality: if frames run slow for a few seconds, render at a lower pixel ratio (the dots keep their size); come back up when there is room
const Q = { level: 0, ema: 1 / 60, slowT: 0, fastT: 0, last: performance.now(), dprs: [...new Set([Math.min(MOBILE ? 1.5 : 2, devicePixelRatio), 1.5, 1.25, 1].filter(v => v <= Math.min(MOBILE ? 1.5 : 2, devicePixelRatio)))] };
function stepQuality() {
  const t = performance.now(), dt = Math.min(0.25, (t - Q.last) / 1000); Q.last = t; Q.ema += (dt - Q.ema) * 0.05; if (!started || paused || document.hidden) return;
  if (Q.ema > 1 / 40) { Q.slowT += dt; Q.fastT = 0; } else if (Q.ema < 1 / 57) { Q.fastT += dt; Q.slowT = 0; } else Q.slowT = Q.fastT = 0;
  if (Q.slowT > 3 && Q.level < Q.dprs.length - 1) Q.level++; else if (Q.fastT > 20 && Q.level > 0) Q.level--; else return;
  Q.slowT = Q.fastT = 0; renderer.setPixelRatio(Q.dprs[Q.level]); composer.setPixelRatio(Q.dprs[Q.level]); resize(); if (DEV) console.log('[quality] pixel ratio', Q.dprs[Q.level]);
}
function resize() {
  const dpr = renderer.getPixelRatio(), W = Math.floor(innerWidth * dpr), H = Math.floor(innerHeight * dpr);
  const pitch = Math.max(2, Math.round(pitchCss * dpr)), gw = Math.ceil(W / pitch), gh = Math.ceil(H / pitch);
  lowRT.setSize(gw, gh); cellRT.setSize(gw, gh); cellMat.uniforms.uGrid.value.set(gw, gh); dotPass.uniforms.uGrid.value.set(gw, gh); dotPass.uniforms.uPitch.value = pitch; panelResize(gw, gh);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.userData.baseFov = settings.fov + (camera.aspect < 1 ? 18 : 0); camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ═══════════════════════════════════════════════════════════════════
//  SHARED GLSL  —  brightness-only shading, fog to a target brightness
//  (black under water, haze above), sunlight fading with depth.
// ═══════════════════════════════════════════════════════════════════
const WU = { uTime: { value: 0 }, uFogD: { value: 0.014 }, uFogB: { value: 0 }, uSun: { value: 1 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) } };
const GLSL_COMMON = /* glsl */`
  uniform float uTime, uFogD, uFogB, uSun; uniform vec3 uSunDir;
  float fogF(float d) { float k = d * uFogD; return 1.0 - exp(-k * k); }
  float applyFog(float b, float d) { return mix(b, uFogB, fogF(d)); }
  float depthLight(float y) { return exp(min(y, 0.0) * 0.06) * (0.12 + 0.88 * uSun + 0.12 * smoothstep(0.0, 0.15, -uSunDir.y)); }
  vec3 moonDir() { return normalize(vec3(-uSunDir.x, max(0.3, -uSunDir.y), -uSunDir.z)); }
  float moonUp() { return smoothstep(0.0, 0.15, -uSunDir.y); }
  vec4 outB(float b) { return vec4(b, 0.0, 0.0, 1.0); }
`;
const DEM_GLSL = /* glsl */`
  uniform sampler2D uDemO, uDemI; uniform vec4 uBoxO, uBoxI; uniform float uVex;
  float demAt(vec2 p) {
    vec2 uvI = (p - uBoxI.xy) / (uBoxI.zw - uBoxI.xy);
    if (all(greaterThan(uvI, vec2(0.015))) && all(lessThan(uvI, vec2(0.985)))) return texture2D(uDemI, uvI).r * uVex;
    vec2 uvO = clamp((p - uBoxO.xy) / (uBoxO.zw - uBoxO.xy), 0.0, 1.0);
    return texture2D(uDemO, uvO).r * uVex;
  }`;
const demUniforms = {
  uDemO: { value: null }, uDemI: { value: null }, uVex: { value: 1 },
  uBoxO: { value: new THREE.Vector4(TILES.outer.xmin, TILES.outer.zmin, TILES.outer.xmax, TILES.outer.zmax) },
  uBoxI: { value: new THREE.Vector4(TILES.inner.xmin, TILES.inner.zmin, TILES.inner.xmax, TILES.inner.zmax) },
};
const mat = (opts) => new THREE.ShaderMaterial({ ...opts, uniforms: { ...WU, ...(opts.uniforms || {}) } });

// ═══════════════════════════════════════════════════════════════════
//  SEAFLOOR + LAND  —  geometry clipmap displaced by the DEM on the GPU.
//  Nine rings: 1 m cells near you out to a 16 km horizon for the surface.
// ═══════════════════════════════════════════════════════════════════
const CLIP_N = 64, CLIP_LEVELS = 9;
function ringGeometry(level) {
  const pos = [], idx = [], half = CLIP_N / 2, hole = level === 0 ? -1 : CLIP_N / 4, map = new Map();
  const vid = (i, j) => { const k = i + ',' + j; if (!map.has(k)) { map.set(k, pos.length / 3); pos.push(i, 0, j); } return map.get(k); };
  for (let j = -half; j < half; j++) for (let i = -half; i < half; i++) {
    if (hole > 0 && i >= -hole && i < hole && j >= -hole && j < hole) continue;
    const a = vid(i, j), b = vid(i + 1, j), c = vid(i, j + 1), d = vid(i + 1, j + 1); idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
const floorVert = GLSL_COMMON + DEM_GLSL + /* glsl */`
  uniform vec2 uOrigin; uniform float uCell; varying vec3 vW; varying float vD;
  void main() { vec2 xz = uOrigin + position.xz * uCell; vW = vec3(xz.x, demAt(xz), xz.y);
    vec4 mv = modelViewMatrix * vec4(vW, 1.0); vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
const floorFrag = GLSL_COMMON + /* glsl */`
  uniform float uVex; varying vec3 vW; varying float vD;
  void main() {
    vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
    float l = 0.45 + 0.55 * max(dot(n, normalize(vec3(0.25, 1.0, 0.15))), 0.0);
    float y = vW.y / uVex, b;
    if (y < 0.0) {
      float r1 = sin(vW.x * 2.6 + sin(vW.z * 0.5) * 1.5 + uTime * 0.1), r2 = sin(vW.z * 2.1 - vW.x * 0.7);
      float sand = 1.0 + 0.07 * r1 + 0.05 * r2;
      // patchy bottom: broad dark beds of grass and mud, lighter sand between
      float beds = sin(vW.x * 0.045 + sin(vW.z * 0.031) * 2.0) * sin(vW.z * 0.052 - vW.x * 0.017);
      sand *= 0.78 + 0.35 * smoothstep(-0.3, 0.5, beds);
      // speckle: shell and rubble
      float sp = fract(sin(dot(floor(vW.xz * 1.3), vec2(12.9898, 78.233))) * 43758.5453);
      sand += 0.35 * step(0.955, sp);
      b = l * sand * mix(0.13, 0.40, depthLight(vW.y));
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
const clipLevels = [];
for (let L = 0; L < CLIP_LEVELS; L++) {
  const m = new THREE.Mesh(ringGeometry(L), mat({ side: THREE.DoubleSide, vertexShader: floorVert, fragmentShader: floorFrag,
    uniforms: { ...demUniforms, uOrigin: { value: new THREE.Vector2() }, uCell: { value: 2 ** L } } }));
  m.frustumCulled = false; scene.add(m); clipLevels.push(m);
}
function updateClipmap(px, pz) { for (const m of clipLevels) { const s = m.material.uniforms.uCell.value * 2; m.material.uniforms.uOrigin.value.set(Math.floor(px / s) * s, Math.floor(pz / s) * s); } }

// ═══════════════════════════════════════════════════════════════════
//  SKY, WATER SURFACE (both sides), LIGHT SHAFTS, PARTICLES
// ═══════════════════════════════════════════════════════════════════
const sky = new THREE.Mesh(new THREE.SphereGeometry(25000, 24, 12), mat({ side: THREE.BackSide, depthWrite: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: GLSL_COMMON + `varying vec3 vDir;
    float hash(vec3 p) { return fract(sin(dot(floor(p * 60.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    void main(){ float h = max(vDir.y, 0.0); float b = mix(mix(0.06, 0.46, uSun), mix(0.01, 0.07, uSun), pow(h, 0.35));
      float sd = max(dot(vDir, uSunDir), 0.0); b += (0.6 * pow(sd, 120.0) + 0.25 * pow(sd, 6.0)) * smoothstep(-0.05, 0.1, uSunDir.y);
      b += step(0.9965, hash(vDir)) * 0.7 * (1.0 - uSun) * smoothstep(0.02, 0.2, vDir.y);   // stars
      float md = max(dot(vDir, moonDir()), 0.0); b += (0.9 * pow(md, 400.0) + 0.08 * pow(md, 5.0)) * moonUp();   // the moon and its halo
      b = mix(b, uFogB, step(uFogB, 0.001));   // under water the sky is black
      gl_FragColor = outB(b); }` }));
sky.frustumCulled = false; scene.add(sky);

const surface = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000, 48, 48), mat({ side: THREE.DoubleSide, transparent: true,
  vertexShader: GLSL_COMMON + `varying vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: GLSL_COMMON + `varying vec3 vW;
    void main(){
      float vD = length(cameraPosition - vW);
      float a = sin(vW.x * 0.45 + uTime * 0.9) * sin(vW.z * 0.38 - uTime * 0.7);
      float c = sin(vW.x * 0.11 - vW.z * 0.13 + uTime * 0.35);
      float p = 0.5 + 0.5 * (a * 0.7 + c * 0.3), b, alpha = 1.0;
      if (gl_FrontFacing) {   // seen from the air: dark glassy water you can see into, sparkle toward the horizon
        vec3 v = normalize(cameraPosition - vW); float g = 1.0 - max(v.y, 0.0);
        float s2 = sin(vW.x * 1.7 + uTime * 1.3) * sin(vW.z * 1.4 - uTime * 1.1);
        vec3 rfl = reflect(-v, vec3(0.0, 1.0, 0.0)); float glit = pow(max(dot(rfl, uSunDir), 0.0), 40.0) * smoothstep(-0.05, 0.1, uSunDir.y);
        float moonGlit = pow(max(dot(rfl, moonDir()), 0.0), 60.0) * moonUp();
        float day = 0.12 + 0.88 * uSun;
        b = (0.015 + 0.14 * g * g * g) * day + 0.5 * pow(max(s2, 0.0), 5.0) * (0.05 + 0.95 * glit) * (0.2 + 0.8 * uSun) + 0.06 * pow(p, 4.0) * g * day + 0.45 * pow(max(s2, 0.0), 4.0) * moonGlit;
        alpha = mix(0.08, 0.35 + 0.55 * g * g, smoothstep(3.0, 40.0, vD));
      } else {
        // from below: crests drawn as moving lines, the way the deck drew its sea
        float w = sin(vW.x * 0.11 + vW.z * 0.04 + uTime * 0.22) * 0.6 + sin(vW.z * 0.08 - vW.x * 0.03 - uTime * 0.16) * 0.4;
        float crest = smoothstep(0.86, 0.97, w);   // a few thin crests, far apart, drifting
        b = 0.12 + 0.55 * pow(p, 5.0) + 0.22 * crest * (0.3 + 0.7 * depthLight(-0.5));
      }
      gl_FragColor = vec4(applyFog(b, vD), 0.0, 0.0, alpha);
    }` }));
surface.rotation.x = -Math.PI / 2; surface.frustumCulled = false; scene.add(surface);

const SHAFTS = 36;
const shafts = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), mat({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: GLSL_COMMON + `varying vec2 vUv; varying float vD, vY;
    void main(){ vUv = uv; vec4 w = modelMatrix * instanceMatrix * vec4(position,1.0); vY = w.y; vec4 mv = viewMatrix * w; vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: GLSL_COMMON + `varying vec2 vUv; varying float vD, vY;
    void main(){ float e = sin(vUv.x * 3.14159);
      float b = 0.10 * e * e * vUv.y * vUv.y * depthLight(vY) * (0.7 + 0.3 * sin(uTime * 0.8 + vUv.x * 6.0)) * (1.0 - fogF(vD)) * step(uFogB, 0.001);
      gl_FragColor = outB(b); }` }), SHAFTS);
shafts.frustumCulled = false; scene.add(shafts);
const shaftSeeds = Array.from({ length: SHAFTS }, (_, i) => ({ a: i / SHAFTS * Math.PI * 2 + rand(), r: 15 + rand() * 70, w: 2 + rand() * 4, s: rand() * 6 }));

function pointsCloud(n, size, bright, ring = false) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aLife', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  const p = new THREE.Points(g, mat({ uniforms: { uSize: { value: size }, uB: { value: bright }, uRing: { value: ring ? 1 : 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_COMMON + `uniform float uSize, uRing; attribute float aLife; varying float vD, vY, vL, vPS;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vD = length(mv.xyz); vY = position.y; vL = aLife;
        float grow = uRing > 0.5 ? (1.0 + aLife * 0.6) : 1.0;   // bubbles swell as they rise
        gl_PointSize = uRing > 0.5 ? clamp(uSize * grow * 5.0 / max(vD, 1.0), 1.0, 3.5) : uSize; vPS = gl_PointSize; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: GLSL_COMMON + `uniform float uB, uRing; varying float vD, vY, vL, vPS;
      void main(){ float b = uB * (1.0 - fogF(vD)) * (0.5 + 0.5 * depthLight(vY)) * step(vY, 0.0);
        if (uRing < 0.5) b *= 0.55 + 0.45 * sin(uTime * 2.5 + vD * 7.0);
        if (uRing > 0.5) { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; b *= smoothstep(1.5, 4.5, vD); b *= mix(1.0, 0.25 + 0.75 * smoothstep(0.45, 0.8, r), smoothstep(2.0, 5.0, vPS)); b *= 1.0 - smoothstep(12.0, 14.0, vL); if (vY > -0.3) b *= smoothstep(-0.05, -0.3, vY); }
        gl_FragColor = outB(b); }` }));
  p.frustumCulled = false; scene.add(p); return p;
}
const snow = pointsCloud(MOBILE ? 1000 : 2500, 1, 0.28), snowBox = 110;
{ const a = snow.geometry.attributes.position.array; for (let i = 0; i < a.length; i++) a[i] = (rand() - 0.5) * snowBox; }
const bubbles = pointsCloud(600, 2.2, 0.9, true), bubbleLife = new Float32Array(600).fill(99);
const seeps = Array.from({ length: 6 }, () => ({ p: new THREE.Vector3(), t: rand() * 3, rate: 0.4 + rand() * 0.6 }));
function stepSeeps(dt) {
  for (const sp of seeps) {
    if (sp.p.lengthSq() === 0 || sp.p.distanceTo(P.pos) > 110) { const spot = spotNear(15, 90, 2.5); if (!spot) continue; sp.p.set(spot.x, spot.f + 0.1, spot.z); }
    sp.t -= dt; if (sp.t <= 0) { sp.t = sp.rate * (0.5 + rand()); emitBubble(sp.p.x + (rand() - .5) * 0.3, sp.p.y, sp.p.z + (rand() - .5) * 0.3); }
  }
}
// spray: droplets thrown into the air by a blow, a fin or a wingtip; they arc and fall back
const SPRAY_N = 200, sprayPos = new Float32Array(SPRAY_N * 3), sprayVel = new Float32Array(SPRAY_N * 3), sprayLife = new Float32Array(SPRAY_N).fill(9);
const sprayGeo = new THREE.BufferGeometry(); sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3)); sprayGeo.setAttribute('aLife', new THREE.BufferAttribute(sprayLife, 1));
const spray = new THREE.Points(sprayGeo, mat({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float aLife; varying float vL; void main(){ vL = aLife; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aLife < 1.0 ? 2.0 : 0.0; }`,
  fragmentShader: GLSL_COMMON + `varying float vL; void main(){ gl_FragColor = outB(0.95 * (1.0 - vL * vL)); }` }));
spray.frustumCulled = false; scene.add(spray);
let sprayNext = 0;
function emitSpray(x, y, z, vx, vy, vz) { const i = sprayNext; sprayNext = (sprayNext + 1) % SPRAY_N; sprayPos.set([x, y, z], i * 3); sprayVel.set([vx, vy, vz], i * 3); sprayLife[i] = 0; }
function stepSpray(dt) {
  for (let i = 0; i < SPRAY_N; i++) { if (sprayLife[i] >= 1) continue; sprayLife[i] += dt / 1.1; sprayVel[i * 3 + 1] -= 9.8 * dt;
    for (let k = 0; k < 3; k++) sprayPos[i * 3 + k] += sprayVel[i * 3 + k] * dt; if (sprayPos[i * 3 + 1] < 0) sprayLife[i] = 1; }   // back into the water
  sprayGeo.attributes.position.needsUpdate = true; sprayGeo.attributes.aLife.needsUpdate = true;
}
let bubbleNext = 0;
function emitBubble(x, y, z) { const i = bubbleNext; bubbleNext = (bubbleNext + 1) % 600; const a = bubbles.geometry.attributes.position.array; bubbleLife[i] = 0; a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; }   // a ring: the oldest bubble is reused
