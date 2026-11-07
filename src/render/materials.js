import * as THREE from 'three';
import { rand } from '../core/random.js?v=__BUILD__';
import { TILES } from '../world/geo.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  SHARED GLSL  —  brightness-only shading, fog to a target brightness
//  (the water's own dim glow below, haze above), sunlight fading with depth.
// ═══════════════════════════════════════════════════════════════════
export const WU = { uTime: { value: 0 }, uFogD: { value: 0.014 }, uFogB: { value: 0 }, uSun: { value: 1 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) } };
export const GLSL_COMMON = /* glsl */`
  uniform float uTime, uFogD, uFogB, uSun; uniform vec3 uSunDir;
  float fogF(float d) { float k = d * uFogD; return 1.0 - exp(-k * k); }
  float applyFog(float b, float d) { return mix(b, uFogB, fogF(d)); }
  float depthLight(float y) { return exp(min(y, 0.0) * 0.06) * (0.12 + 0.88 * uSun + 0.12 * smoothstep(0.0, 0.15, -uSunDir.y)); }
  vec3 moonDir() { return normalize(vec3(-uSunDir.x, max(0.3, -uSunDir.y), -uSunDir.z)); }
  float moonUp() { return smoothstep(0.0, 0.15, -uSunDir.y); }
  vec4 outB(float b) { return vec4(b, 0.0, 0.0, 1.0); }
`;
export const DEM_GLSL = /* glsl */`
  uniform sampler2D uDemO, uDemI; uniform vec4 uBoxO, uBoxI; uniform float uVex;
  float demAt(vec2 p) {
    vec2 uvI = (p - uBoxI.xy) / (uBoxI.zw - uBoxI.xy);
    if (all(greaterThan(uvI, vec2(0.015))) && all(lessThan(uvI, vec2(0.985)))) return texture2D(uDemI, uvI).r * uVex;
    vec2 uvO = clamp((p - uBoxO.xy) / (uBoxO.zw - uBoxO.xy), 0.0, 1.0);
    return texture2D(uDemO, uvO).r * uVex;
  }`;
export const demUniforms = {
  uDemO: { value: null }, uDemI: { value: null }, uVex: { value: 1 },
  uBoxO: { value: new THREE.Vector4(TILES.outer.xmin, TILES.outer.zmin, TILES.outer.xmax, TILES.outer.zmax) },
  uBoxI: { value: new THREE.Vector4(TILES.inner.xmin, TILES.inner.zmin, TILES.inner.xmax, TILES.inner.zmax) },
};
export const mat = (opts) => new THREE.ShaderMaterial({ ...opts, uniforms: { ...WU, ...(opts.uniforms || {}) } });


// the animated brightness material every body uses (and the structures, at a lower glow): rim-lit silhouettes,
// flat normals from derivatives. Modes: 1 ray flap · 2 fish tail · 4 bird wings · 5 jelly · 6 vertical fluke
export const creatureVert = GLSL_COMMON + /* glsl */`
  attribute float aPhase;
  uniform float uMode, uHalf, uLen, uFreq, uAmp, uFlap, uPhase;
  varying vec3 vW; varying float vD, vFin; varying vec2 vUv;
  void main() {
    vec3 p = position; float ph = uPhase + aPhase; vFin = 1.0 - step(0.5, length(normal));
    if (uMode == 1.0) {   // rays (mobuliform): oscillatory pectoral flapping
      float s = abs(p.x) / uHalf, c = clamp(p.z / uLen + 0.32, 0.0, 1.0);
      float phw = ph + 0.32 * sin(ph);                         // quicker power downstroke, slower recovery
      float lag = s * 1.1 + c * 1.5;                           // wave runs tipward and rearward: leading edge leads
      float bend = s * s * (0.55 + 0.45 * s);                  // stiff root, flexible tip
      p.y += sin(phw - lag) * bend * uAmp * uHalf * uFlap;
      p.y -= sin(phw) * 0.035 * uLen * uFlap * (1.0 - s);     // body heaves against the wings
      p.z += cos(phw - lag) * bend * 0.06 * uHalf * uFlap;     // the tip sweeps a slight arc, not a straight line
      float tail = max(0.0, p.z - uLen * 0.5); p.x += sin(phw * 0.5 - c * 3.0) * tail * 0.12; p.y += sin(phw - 2.5) * tail * 0.08; }
    else if (uMode == 2.0) {   // fish: lateral undulation, small at the head, large at the tail, with a touch of head counter-swing
      float s = clamp(p.z / uLen + 0.5, 0.0, 1.0); float w = sin(ph - s * 4.2);
      p.x += w * (0.08 + 0.92 * s * s) * uAmp * uLen - sin(ph) * (1.0 - s) * 0.12 * uAmp * uLen; }
    else if (uMode == 6.0) {   // dolphins, manatees: the stroke is vertical
      float s = clamp(p.z / uLen + 0.5, 0.0, 1.0); float w = sin(ph - s * 3.6);
      p.y += w * (0.05 + 0.95 * s * s) * uAmp * uLen * 1.3 - sin(ph) * (1.0 - s) * 0.08 * uAmp * uLen; }
    else if (uMode == 4.0) { p.y += sin(ph) * abs(p.x) * uAmp; }
    else if (uMode == 5.0) { float q = 1.0 + 0.14 * sin(ph); p.xz *= mix(q, 1.0, step(p.y, -0.01)); p.y *= mix(2.0 - q, 1.0, step(p.y, -0.01)); if (p.y < -0.01) p.x += sin(ph * 0.7 + p.y * 3.0) * 0.04 * -p.y; }
    #ifdef USE_INSTANCING
      vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
    #else
      vec4 w = modelMatrix * vec4(p, 1.0);
    #endif
    vW = w.xyz; vUv = uv; vec4 mv = viewMatrix * w; vD = length(mv.xyz); gl_Position = projectionMatrix * mv;
  }`;
export const creatureFrag = GLSL_COMMON + /* glsl */`
  uniform float uGlow, uMode; varying vec3 vW; varying float vD, vFin; varying vec2 vUv;
  void main() {
    vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); vec3 v = normalize(cameraPosition - vW); if (dot(n, v) < 0.0) n = -n;
    float top = max(dot(n, normalize(vec3(0.15, 1.0, 0.1))), 0.0);
    float l = 0.1 + 0.38 * pow(top, 1.2) + 0.22 * smoothstep(0.86, 1.0, n.y);    // filled, top-lit bodies with a bright dorsal ridge
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6) * (0.15 + 0.85 * smoothstep(-0.4, 0.6, n.y));   // top-lit outline: undersides fall away
    float light = vW.y > 0.0 ? (0.2 + 0.8 * uSun) : mix(0.5, 1.0, depthLight(vW.y));
    float b = (l * light + rim * 1.05) * (vW.y > 0.0 ? max(uGlow, 0.9) : uGlow);
    if (vFin > 0.5) { float edge = pow(1.0 - abs(dot(n, v)), 1.5); b = (0.05 + 0.08 * top + 0.75 * edge) * uGlow * light; }   // fins: a bright edge, a faint face   // hulls and decks are lit in the air
    if (uMode == 1.0) { float e = smoothstep(0.82, 1.0, vUv.x) + smoothstep(0.80, 0.86, vUv.y) * step(vUv.y, 0.87) + (1.0 - smoothstep(0.0, 0.07, vUv.y)); b = b * (1.0 - 0.35 * vUv.x) + 0.35 * clamp(e, 0.0, 1.0) * uGlow; }
    gl_FragColor = outB(applyFog(min(b, 1.0), vD));
  }`;
export const creatureMats = [];
// Strouhal: real swimmers cruise near St = f·A/U ≈ 0.25–0.35. A is peak-to-peak tip excursion.
export function strouhalRad(sp, U, flap) { const A = Math.max(0.05, 2 * (sp.amp ?? 0.5) * (sp.span ?? sp.len) * 0.5 * Math.max(0.3, flap)); return 2 * Math.PI * THREE.MathUtils.clamp(0.3 * Math.max(U, 0.4) / A, 0.18, 2.4); }
export function creatureMat(o = {}) {
  const m = mat({ side: THREE.DoubleSide, vertexShader: creatureVert, fragmentShader: creatureFrag, uniforms: {
    uMode: { value: o.mode ?? 0 }, uHalf: { value: o.half ?? 1 }, uLen: { value: o.len ?? 1 }, uFreq: { value: o.freq ?? 2 },
    uAmp: { value: o.amp ?? 0.3 }, uFlap: { value: 1 }, uGlow: { value: o.glow ?? 1 }, uPhase: { value: rand() * 6.28 } } });
  creatureMats.push(m); return m;
}
export function stepStrokes(dt) { for (const m of creatureMats) m.uniforms.uPhase.value += m.uniforms.uFreq.value * dt; }
