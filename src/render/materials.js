import * as THREE from 'three';
import { rand } from '../core/random.js?v=__BUILD__';
import { TILES } from '../world/geo.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  SHARED GLSL  —  brightness-only shading, fog to a target brightness
//  (the water's own dim glow below, haze above), sunlight fading with depth.
// ═══════════════════════════════════════════════════════════════════
export const WU = { uTime: { value: 0 }, uFogD: { value: 0.014 }, uFogB: { value: 0 }, uSun: { value: 1 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uFill: { value: 0 }, uRaw: { value: 0 }, uChop: { value: 0.1 }, uWavePeriod: { value: 2 }, uWindDir: { value: new THREE.Vector2(1, 0) }, uRain: { value: 0 }, uTide: { value: 0 }, uCloud: { value: 0 } };   // the model page: uFill lifts the dark sides in the dot view, uRaw draws plain images with no dots. both always 0 in the game
export const GLSL_COMMON = /* glsl */`
  uniform float uTime, uFogD, uFogB, uSun, uFill, uRaw, uChop, uWavePeriod, uRain, uTide, uCloud; uniform vec2 uWindDir; uniform vec3 uSunDir;
  float fogF(float d) { float k = d * uFogD; return 1.0 - exp(-k * k); }
  float applyFog(float b, float d) { return mix(b, uFogB, fogF(d)); }
  float depthLight(float y) { return exp(min(y, 0.0) * 0.06) * (0.12 + 0.88 * uSun + 0.12 * smoothstep(0.0, 0.15, -uSunDir.y)); }
  vec3 moonDir() { return normalize(vec3(-uSunDir.x, max(0.3, -uSunDir.y), -uSunDir.z)); }
  float moonUp() { return smoothstep(0.0, 0.15, -uSunDir.y); }
  vec4 outB(float b) { return uRaw > 0.5 ? vec4(vec3(b), 1.0) : vec4(b, 0.0, 0.0, 1.0); }
`;
export const DEM_GLSL = /* glsl */`
  uniform sampler2D uDemO, uDemI; uniform vec4 uBoxO, uBoxI; uniform float uVex;
  float demAt(vec2 p) {
    vec2 uvI = (p - uBoxI.xy) / (uBoxI.zw - uBoxI.xy);
    if (all(greaterThan(uvI, vec2(0.015))) && all(lessThan(uvI, vec2(0.985)))) return texture2D(uDemI, uvI).r * uVex - uTide;
    vec2 uvO = clamp((p - uBoxO.xy) / (uBoxO.zw - uBoxO.xy), 0.0, 1.0);
    return texture2D(uDemO, uvO).r * uVex - uTide;
  }`;
export const demUniforms = {
  uDemO: { value: null }, uDemI: { value: null }, uVex: { value: 1 },
  uBoxO: { value: new THREE.Vector4(TILES.outer.xmin, TILES.outer.zmin, TILES.outer.xmax, TILES.outer.zmax) },
  uBoxI: { value: new THREE.Vector4(TILES.inner.xmin, TILES.inner.zmin, TILES.inner.xmax, TILES.inner.zmax) },
};
export const mat = (opts) => new THREE.ShaderMaterial({ ...opts, uniforms: { ...WU, ...(opts.uniforms || {}) } });


// the animated brightness material every body uses (and the structures, at a lower glow): rim-lit, smooth where the model is smooth.
// Modes: 1 ray flap · 2 fish, side to side · 4 bird wings · 5 jelly · 6 whales and manatees, up and down
// the swimming follows how these animals move: a wave runs nose to tail (uWave: radians along the body, one body length is 6.28), growing toward the tail;
// a stiff-fronted dolphin works almost only behind the dorsal fin; the spine curves into a turn (uBend: +1 hard left), and a ray beats its inside wing less
export const creatureVert = GLSL_COMMON + /* glsl */`
  attribute float aPhase;
  uniform float uMode, uHalf, uLen, uFreq, uAmp, uFlap, uPhase, uBend, uWave, uLite;
  varying vec3 vW, vN; varying float vD, vFin; varying vec2 vUv;
  vec3 swim(vec3 p, float ph) {
    ph += 0.28 * sin(ph * 0.137) + 0.16 * sin(ph * 0.061);   // no living thing keeps perfect time
    if (uMode == 1.0) {   // rays (mobuliform): oscillatory pectoral flapping
      float s = abs(p.x) / uHalf, c = clamp(p.z / uLen + 0.32, 0.0, 1.0);
      float phw = ph + 0.32 * sin(ph);                         // quicker power downstroke, slower recovery
      float lag = s * 1.1 + c * 1.5;                           // wave runs tipward and rearward: leading edge leads
      float bend = s * s * (0.55 + 0.45 * s) * (1.0 + uBend * 0.45 * sign(p.x));   // stiff root, flexible tip; the wing inside a turn works less
      float z = p.z, tail = max(0.0, z - uLen * 0.5);
      p.y += sin(phw - lag) * bend * uAmp * uHalf * uFlap;
      p.y -= sin(phw) * 0.035 * uLen * uFlap * (1.0 - s);     // body heaves against the wings
      p.z += cos(phw - lag) * bend * 0.06 * uHalf * uFlap;     // the tip sweeps a slight arc, not a straight line
      p.x += sin(phw * 0.5 - c * 3.0) * tail * 0.12 - uBend * tail * tail * 0.5; p.y += sin(phw - 2.5) * tail * 0.08; }
    else if (uMode == 2.0) {   // fish and sharks: side to side, the head barely, the tail most
      float s = clamp(p.z / uLen + 0.5, 0.0, 1.0), t = (s - 0.45) * 2.0;
      p.x += sin(ph - s * uWave) * (0.06 + 0.24 * s + 0.7 * s * s) * uAmp * uLen * mix(0.6, 1.0, uFlap) - sin(ph) * (1.0 - s) * (1.0 - s) * 0.05 * uAmp * uLen;
      p.x -= uBend * t * t * 0.16 * uLen;
      float fin = max(0.0, abs(p.x) - 0.1 * uLen) / uLen; p.y += fin * (sin(ph * 0.5 - s * 2.0) * 0.28 - 0.5 * uBend * sign(p.x)) * uLen * 0.5; }   // pectorals give a little, and tilt to steer
    else if (uMode == 6.0) {   // dolphins, manatees: the stroke is up and down, from a stiff front
      float s = clamp(p.z / uLen + 0.5, 0.0, 1.0), t = (s - 0.45) * 2.0;
      p.y += sin(ph - s * uWave) * (0.02 + 0.98 * pow(s, 2.6)) * uAmp * uLen * 1.3 * mix(0.6, 1.0, uFlap) - sin(ph) * (1.0 - s) * 0.04 * uAmp * uLen;
      p.x -= uBend * t * t * 0.1 * uLen;
      float fin = max(0.0, abs(p.x) - 0.12 * uLen) / uLen, fluke = smoothstep(0.92, 1.0, s); p.y += fin * (1.0 - fluke) * (sin(ph * 0.5) * 0.25 - 0.5 * uBend * sign(p.x)) * uLen * 0.5; }
    else if (uMode == 4.0) {   // a big soaring bird: long glides, then a few slow beats, the wingtips trailing the arm and the body answering each stroke
      float s = abs(p.x), gate = smoothstep(-0.2, 0.5, sin(ph * 0.18)), beat = sin(ph - s * 1.1); p.y += (beat * s * (0.35 + 0.65 * s) * uAmp * gate + 0.05 * s * s) ; p.y -= sin(ph) * 0.04 * gate * (1.0 - min(s, 1.0)); p.z += cos(ph - s * 1.1) * s * s * 0.05 * gate; }
    else if (uMode == 5.0) { float q = 1.0 + 0.14 * sin(ph); p.xz *= mix(q, 1.0, step(p.y, -0.01)); p.y *= mix(2.0 - q, 1.0, step(p.y, -0.01)); if (p.y < -0.01) p.x += sin(ph * 0.7 + p.y * 3.0) * 0.04 * -p.y; }
    return p;
  }
  void main() {
    float ph = uPhase + aPhase; vFin = 1.0 - step(0.5, length(normal));
    vec3 p = swim(position, ph), n = vFin > 0.5 ? vec3(0.0, 1.0, 0.0) : normalize(normal);
    if (uMode != 0.0 && vFin < 0.5 && uLite < 0.5) {   // the surface's own direction, after the bend: a body stays smooth while it moves
      vec3 a = normalize(abs(n.y) < 0.9 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0))), b = cross(n, a); float e = 0.02 * uLen;
      vec3 m = normalize(cross(swim(position + a * e, ph) - p, swim(position + b * e, ph) - p)); n = dot(m, n) < 0.0 ? -m : m; }
    #ifdef USE_INSTANCING
      mat4 M = modelMatrix * instanceMatrix;
    #else
      mat4 M = modelMatrix;
    #endif
    vec4 w = M * vec4(p, 1.0); mat3 R = mat3(M); vN = R * (n / vec3(dot(R[0], R[0]), dot(R[1], R[1]), dot(R[2], R[2])));   // stays true on a stretched pile or deck
    vW = w.xyz; vUv = uv; vec4 mv = viewMatrix * w; vD = length(mv.xyz); gl_Position = projectionMatrix * mv;
  }`;
export const creatureFrag = GLSL_COMMON + /* glsl */`
  uniform float uGlow, uMode; varying vec3 vW, vN; varying float vD, vFin; varying vec2 vUv;
  void main() {
    vec3 n = vFin > 0.5 ? normalize(cross(dFdx(vW), dFdy(vW))) : normalize(vN); vec3 v = normalize(cameraPosition - vW); if (dot(n, v) < 0.0) n = -n;
    float top = max(dot(n, normalize(vec3(0.15, 1.0, 0.1))), 0.0);
    float l = 0.1 + 0.38 * pow(top, 1.2) + 0.22 * smoothstep(0.86, 1.0, n.y);    // filled, top-lit bodies with a bright dorsal ridge
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6) * (0.15 + 0.85 * smoothstep(-0.4, 0.6, n.y));   // top-lit outline: undersides fall away
    float light = vW.y > 0.0 ? (0.2 + 0.8 * uSun) : mix(0.5, 1.0, depthLight(vW.y));
    float b = (l * light + rim * 1.05) * (vW.y > 0.0 ? max(uGlow, 0.9) : uGlow);
    if (vFin > 0.5) { float edge = pow(1.0 - abs(dot(n, v)), 1.5); b = (0.05 + 0.08 * top + 0.75 * edge) * uGlow * light; }   // fins: a bright edge, a faint face   // hulls and decks are lit in the air
    if (uMode == 1.0) { float e = smoothstep(0.82, 1.0, vUv.x) + smoothstep(0.80, 0.86, vUv.y) * step(vUv.y, 0.87) + (1.0 - smoothstep(0.0, 0.07, vUv.y)); b = b * (1.0 - 0.35 * vUv.x) + 0.35 * clamp(e, 0.0, 1.0) * uGlow; }
    b = mix(b, 0.1 + 0.55 * max(dot(n, v), 0.0) + 0.35 * pow(1.0 - max(dot(n, v), 0.0), 3.0), uFill);   // the inspection light: lit from the lens, so every side of a model can be read
    gl_FragColor = outB(applyFog(min(b, 1.0), vD));
    if (uRaw > 0.5) {   // the raw view: a studio's key, fill and rim on a plain clay surface, so the shape is all you are judging
      vec3 key = normalize(vec3(0.5, 0.9, 0.6)), fill = normalize(vec3(-0.7, 0.2, 0.4)); float nl = max(dot(n, key), 0.0), fl = max(dot(n, fill), 0.0), sky = 0.5 + 0.5 * n.y, r = pow(1.0 - max(dot(n, v), 0.0), 3.0), s = pow(max(dot(n, normalize(key + v)), 0.0), 40.0);
      gl_FragColor = vec4(vec3(0.62, 0.68, 0.74) * (0.2 + 0.25 * sky + 0.75 * nl + 0.22 * fl) + vec3(0.22) * r + vec3(0.18) * s, 1.0); }
  }`;
export const creatureMats = [];
// Strouhal: real swimmers cruise near St = f·A/U ≈ 0.25–0.35. A is peak-to-peak tip excursion.
// and no faster than the animal's own top rate: a manatee is never in a hurry
export const beatRad = (sp, U, flap, push = 1) => sp.kind === 'ray' ? strouhalRad(sp, U, flap) : Math.min(strouhalRad(sp, U, flap), sp.freq * 3 * push);
export function strouhalRad(sp, U, flap) { const A = Math.max(0.05, 2 * (sp.amp ?? 0.5) * (sp.span ?? sp.len) * 0.5 * Math.max(0.3, flap)); return 2 * Math.PI * THREE.MathUtils.clamp(0.3 * Math.max(U, 0.4) / A, 0.18, 2.4); }
export function creatureMat(o = {}) {
  const m = mat({ side: THREE.DoubleSide, vertexShader: creatureVert, fragmentShader: creatureFrag, uniforms: {
    uMode: { value: o.mode ?? 0 }, uHalf: { value: o.half ?? 1 }, uLen: { value: o.len ?? 1 }, uFreq: { value: o.freq ?? 2 },
    uAmp: { value: o.amp ?? 0.3 }, uFlap: { value: 1 }, uBend: { value: 0 }, uWave: { value: o.wave ?? 5.5 }, uLite: { value: o.lite ? 1 : 0 }, uGlow: { value: o.glow ?? 1 }, uPhase: { value: rand() * 6.28 } } });
  creatureMats.push(m); return m;
}
export function stepStrokes(dt) { for (const m of creatureMats) m.uniforms.uPhase.value += m.uniforms.uFreq.value * dt; }
