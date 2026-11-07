import * as THREE from 'three';
import { MOBILE } from '../core/env.js?v=__BUILD__';
import { rand } from '../core/random.js?v=__BUILD__';
import { scene } from './display.js?v=__BUILD__';
import { GLSL_COMMON, mat } from './materials.js?v=__BUILD__';
import { spotNear } from '../world/geo.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  SKY, WATER SURFACE (both sides), LIGHT SHAFTS, PARTICLES
// ═══════════════════════════════════════════════════════════════════
export const sky = new THREE.Mesh(new THREE.SphereGeometry(25000, 24, 12), mat({ side: THREE.BackSide, depthWrite: false,
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

export const surface = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000, 48, 48), mat({ side: THREE.DoubleSide, transparent: true,
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
        float near = 1.0 - smoothstep(0.6, 2.5, fwidth(vW.x) + fwidth(vW.z));   // far off at a low angle the pattern is finer than a dot, and can only alias into rows of dashes
        b = 0.12 + (0.55 * pow(p, 5.0) + 0.22 * crest * (0.3 + 0.7 * depthLight(-0.5))) * near;
      }
      gl_FragColor = vec4(uRaw > 0.5 ? vec3(applyFog(b, vD)) : vec3(applyFog(b, vD), 0.0, 0.0), alpha);
    }` }));
surface.rotation.x = -Math.PI / 2; surface.frustumCulled = false; scene.add(surface);

export const SHAFTS = 36;
export const shafts = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), mat({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: GLSL_COMMON + `varying vec2 vUv; varying float vD, vY;
    void main(){ vUv = uv; vec4 w = modelMatrix * instanceMatrix * vec4(position,1.0); vY = w.y; vec4 mv = viewMatrix * w; vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: GLSL_COMMON + `varying vec2 vUv; varying float vD, vY;
    void main(){ float e = sin(vUv.x * 3.14159);
      float b = 0.10 * e * e * vUv.y * vUv.y * depthLight(vY) * (0.7 + 0.3 * sin(uTime * 0.8 + vUv.x * 6.0)) * (1.0 - fogF(vD)) * step(uFogB, 0.001);
      gl_FragColor = outB(b); }` }), SHAFTS);
shafts.frustumCulled = false; scene.add(shafts);
export const shaftSeeds = Array.from({ length: SHAFTS }, (_, i) => ({ a: i / SHAFTS * Math.PI * 2 + rand(), r: 15 + rand() * 70, w: 2 + rand() * 4, s: rand() * 6 }));

export function pointsCloud(n, size, bright, ring = false) {
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
export const snow = pointsCloud(MOBILE ? 1000 : 2500, 1, 0.28), snowBox = 110;
{ const a = snow.geometry.attributes.position.array; for (let i = 0; i < a.length; i++) a[i] = (rand() - 0.5) * snowBox; }
export const bubbles = pointsCloud(600, 2.2, 0.9, true), bubbleLife = new Float32Array(600).fill(99);
export const seeps = Array.from({ length: 6 }, () => ({ p: new THREE.Vector3(), t: rand() * 3, rate: 0.4 + rand() * 0.6 }));
export function stepSeeps(dt, near) {   // bubbles leaking from the bottom, kept near `near`
  for (const sp of seeps) {
    if (sp.p.lengthSq() === 0 || sp.p.distanceTo(near) > 110) { const spot = spotNear(near, 15, 90, 2.5); if (!spot) continue; sp.p.set(spot.x, spot.f + 0.1, spot.z); }
    sp.t -= dt; if (sp.t <= 0) { sp.t = sp.rate * (0.5 + rand()); emitBubble(sp.p.x + (rand() - .5) * 0.3, sp.p.y, sp.p.z + (rand() - .5) * 0.3); }
  }
}
// spray: droplets thrown into the air by a blow, a fin or a wingtip; they arc and fall back
export const SPRAY_N = 200, sprayPos = new Float32Array(SPRAY_N * 3), sprayVel = new Float32Array(SPRAY_N * 3), sprayLife = new Float32Array(SPRAY_N).fill(9);
export const sprayGeo = new THREE.BufferGeometry(); sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3)); sprayGeo.setAttribute('aLife', new THREE.BufferAttribute(sprayLife, 1));
export const spray = new THREE.Points(sprayGeo, mat({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float aLife; varying float vL; void main(){ vL = aLife; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aLife < 1.0 ? 2.0 : 0.0; }`,
  fragmentShader: GLSL_COMMON + `varying float vL; void main(){ gl_FragColor = outB(0.95 * (1.0 - vL * vL)); }` }));
spray.frustumCulled = false; scene.add(spray);
export let sprayNext = 0;
export function emitSpray(x, y, z, vx, vy, vz) { const i = sprayNext; sprayNext = (sprayNext + 1) % SPRAY_N; sprayPos.set([x, y, z], i * 3); sprayVel.set([vx, vy, vz], i * 3); sprayLife[i] = 0; }
export function stepSpray(dt) {
  for (let i = 0; i < SPRAY_N; i++) { if (sprayLife[i] >= 1) continue; sprayLife[i] += dt / 1.1; sprayVel[i * 3 + 1] -= 9.8 * dt;
    for (let k = 0; k < 3; k++) sprayPos[i * 3 + k] += sprayVel[i * 3 + k] * dt; if (sprayPos[i * 3 + 1] < 0) sprayLife[i] = 1; }   // back into the water
  sprayGeo.attributes.position.needsUpdate = true; sprayGeo.attributes.aLife.needsUpdate = true;
}
export let bubbleNext = 0;
export function emitBubble(x, y, z) { const i = bubbleNext; bubbleNext = (bubbleNext + 1) % 600; const a = bubbles.geometry.attributes.position.array; bubbleLife[i] = 0; a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; }   // a ring: the oldest bubble is reused
