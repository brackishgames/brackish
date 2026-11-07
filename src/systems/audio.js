import * as THREE from 'three';
import { fxRand } from '../core/random.js?v=__BUILD__';
import { settings } from '../core/settings.js?v=__BUILD__';
import { TUNE } from '../core/tune.js?v=__BUILD__';
import { camera } from '../render/display.js?v=__BUILD__';
import { FAN_MAX, GRASS_MAX, ROCK_MAX, fans, grass, rocks } from '../world/seabed.js?v=__BUILD__';
import { BOAT_TYPES, world } from '../world/structures.js?v=__BUILD__';
import { day } from '../world/time.js?v=__BUILD__';
import { boats, gig } from '../actors/boats.js?v=__BUILD__';
import { fever } from '../actors/fever.js?v=__BUILD__';
import { flocks } from '../actors/life.js?v=__BUILD__';
import { P } from '../actors/player.js?v=__BUILD__';
import { dread, wild } from '../actors/wildlife.js?v=__BUILD__';
import { kn } from './input.js?v=__BUILD__';
import { started } from './story.js?v=__BUILD__';
import { tip } from '../ui/hud.js?v=__BUILD__';
import { _cur, camPos, lastFloor, paused } from '../app/frame.js?v=__BUILD__';
export let audio = null, audioOn = true, ENGINES = null, ENGINE_SHIP = null;
// ── SOUND. No music: the bay itself. Everything is synthesized from noise and sines, scheduled on
//    the audio clock, ramped from silence, and scaled by distance. The world is heard through a
//    low-pass that closes with depth and opens at the surface.
export function seamlessNoise(ac, seconds, color = 1.0) {
  const n = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < n; i++) { last = last * color + (fxRand() * 2 - 1) * (1 - color); d[i] = last; }
  const peak = d.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-6); for (let i = 0; i < n; i++) d[i] /= peak;
  const x = Math.floor(ac.sampleRate * 0.25); for (let i = 0; i < x; i++) { const t = i / x; d[i] = d[i] * t + d[n - x + i] * (1 - t); }
  return buf;
}
// snapping shrimp: not a hiss but thousands of separate cracks, heavy-tailed in loudness, reaching well above what the ear expects (Everest et al. 1948)
export function crackleNoise(ac, seconds, perSecond) {
  const n = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let k = 0; k < seconds * perSecond; k++) { const at = Math.floor(fxRand() * (n - 64)), a = (0.25 + 0.75 * fxRand()) * (fxRand() < 0.5 ? 1 : -1); for (let i = 0; i < 48; i++) d[at + i] += a * Math.exp(-i / 11); }   // real ones are sharp and it crinkles: softened to a far-off fizz, the bay's quiet breath
  const peak = d.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-6); for (let i = 0; i < n; i++) d[i] /= peak; return buf;
}
export function startAudio() {
  if (audio) return;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain(); master.gain.value = 0;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = 0.015; comp.release.value = 0.35;
  const water = ac.createBiquadFilter(); water.type = 'lowpass'; water.frequency.value = 1400; water.Q.value = 0.2;
  const tap = ac.createAnalyser(); tap.fftSize = 16384; tap.smoothingTimeConstant = 0;   // what the player hears, for tools/check.mjs
  master.connect(water).connect(comp).connect(ac.destination); comp.connect(tap);
  const amb = ac.createGain(), fx = ac.createGain(); amb.connect(master); fx.connect(master);   /* the sea on one bus, everything that happens on the other */
  audio = { ac, master: fx, fx, main: master, amb, water, white: seamlessNoise(ac, 6, 0.0), brown: seamlessNoise(ac, 8, 0.985), pink: seamlessNoise(ac, 7, 0.9), nextT: {}, tap, testDread: null };
  audio.clear = ac.createGain(); audio.clear.gain.value = 0; audio.clear.connect(comp);   // what the depth's muffling must not touch: water carries high sound far better than air, and it is only our ears that fail
  const bed = (buf, type, freq, q, g) => { const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.9 + fxRand() * 0.2; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const gg = ac.createGain(); gg.gain.value = g; src.connect(f).connect(gg).connect(amb); src.start(); return { f, g: gg, src }; };
  const lfo = (target, hz, depth, type = 'sine') => { const o = ac.createOscillator(); o.type = type; o.frequency.value = hz; const g = ac.createGain(); g.gain.value = depth; o.connect(g).connect(target); o.start(); return o; };
  // the ocean: a broad noise bed that swells like a slow sea, darker with depth
  audio.sea = bed(audio.brown, 'lowpass', 220, 0.3, 0.45); lfo(audio.sea.g.gain, TUNE.sound.swell, 0.12); lfo(audio.sea.f.frequency, TUNE.sound.swell * 0.5, 60);
  audio.sea2 = bed(audio.pink, 'lowpass', 900, 0.3, 0.06); lfo(audio.sea2.g.gain, TUNE.sound.swell * 1.07, 0.03);
  audio.wind = bed(audio.pink, 'lowpass', 650, 0.3, 0); lfo(audio.wind.f.frequency, 0.13, 220); lfo(audio.wind.g.gain, 0.19, 0.05);
  audio.lap = bed(audio.pink, 'bandpass', 500, 0.5, 0); lfo(audio.lap.g.gain, 0.33, 0.1);           // water against the surface near you
  audio.rush = bed(audio.brown, 'lowpass', 400, 0.3, 0);                                            // water over your body
  audio.thrash = bed(audio.brown, 'bandpass', 700, 0.5, 0);                                         // turbulence when you work hard near the surface
  audio.flutter = bed(audio.brown, 'bandpass', 600, 0.7, 0); lfo(audio.flutter.g.gain, 2.4, 0.5, 'triangle');   // the fever's wingbeats
  audio.current = bed(audio.brown, 'highpass', 300, 0.3, 0);                                         // tide pouring through the pass
  // the bay's own crackle, under everything, and through the clear channel
  { const src = ac.createBufferSource(); src.buffer = crackleNoise(ac, 7, 2600); src.loop = true; const hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1500; hp.Q.value = 0.5; audio.shrimp = ac.createGain(); audio.shrimp.gain.value = 0; src.connect(hp).connect(audio.shrimp).connect(audio.clear); src.start(); }
  // fear, silent until there is something to fear. a pressure you feel more than hear: two close tones beating, with an octave so small speakers carry it
  { audio.pressure = ac.createGain(); audio.pressure.gain.value = 0; audio.pressure.connect(fx); for (const [f, g] of [[34, 0.8], [35.2, 0.7], [68, 0.35]]) { const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = f; og.gain.value = g; o.connect(og).connect(audio.pressure); o.start(); }
    // and roughness: a dark noise beating at a rate the brain's alarm responds to, the quality that makes a scream a scream (Arnal et al. 2015)
    const n = ac.createBufferSource(); n.buffer = audio.brown; n.loop = true; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 170; bp.Q.value = 0.8; const am = ac.createGain(); am.gain.value = 0.5; const o = ac.createOscillator(); o.frequency.value = TUNE.sound.roughHz; const depth = ac.createGain(); depth.gain.value = 0.5; o.connect(depth).connect(am.gain); o.start(); audio.rough = ac.createGain(); audio.rough.gain.value = 0; n.connect(bp).connect(am).connect(audio.rough).connect(fx); n.start(); }
  // engines: underwater a boat is its propeller. each hull gets a voice: a tone, the beat of the blades, and cavitation hiss riding on that beat.
  //   ship: a slow five-blade prop, a thrum you feel at seven beats a second, heard for kilometres
  //   cruiser, skiff: fast small props, a whine of a hundred-odd hertz and a lot of hiss, heard for a few hundred metres
  //   gig skiff: no engine at all, or a trolling motor's thin electric whine you only hear close
  const ENGINE = ENGINES = { ship: { tone: 26, wave: 'triangle', blade: 7, hiss: 700, range: 1500, g: 0.55 }, cruiser: { tone: 78, wave: 'sawtooth', blade: 13, hiss: 1800, range: 170, g: 0.3 },
    skiff: { tone: 128, wave: 'sawtooth', blade: 21, hiss: 2800, range: 130, g: 0.26 }, troll: { tone: 820, wave: 'sine', blade: 0, hiss: 0, range: 45, g: 0.05 } };
  const voice = (src, kind) => { const e = ENGINE[kind], out = ac.createGain(); out.gain.value = 0; const pan = ac.createStereoPanner ? ac.createStereoPanner() : null; (pan ? (out.connect(pan), pan) : out).connect(fx);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150; lp.Q.value = 0.9; lp.connect(out);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = o2.type = e.wave; o1.frequency.value = o2.frequency.value = e.tone; o2.detune.value = 11;
    const body = ac.createGain(); body.gain.value = 0.6; o1.connect(body); o2.connect(body); body.connect(lp);
    let hiss = null; if (e.hiss) { const n = ac.createBufferSource(); n.buffer = audio.white; n.loop = true; const hf = ac.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = e.hiss; hf.Q.value = 0.7; hiss = ac.createGain(); hiss.gain.value = 0.18; n.connect(hf).connect(hiss).connect(out); n.start(); }
    if (e.blade) { const b = ac.createOscillator(); b.frequency.value = e.blade * (0.95 + fxRand() * 0.1); const bd = ac.createGain(); bd.gain.value = 0.45; b.connect(bd).connect(body.gain); if (hiss) { const bh = ac.createGain(); bh.gain.value = 0.15; b.connect(bh).connect(hiss.gain); } b.start(); }
    o1.start(); o2.start(); return { src, e, out, pan, lp, o1, o2 }; };
  ENGINE_SHIP = ENGINE.ship;
  audio.engines = [...boats.map(b => voice(b, b.type === BOAT_TYPES.ship ? 'ship' : b.type === BOAT_TYPES.cruiser ? 'cruiser' : 'skiff')), voice(gig, 'troll')];
  audio.heartNext = 0; audio.nextT.omen = ac.currentTime + 35;
  master.gain.setTargetAtTime(masterLevel(), ac.currentTime, 2.5); audio.level = masterLevel();
}
export const now = () => audio.ac.currentTime;
export function oneShot(build, when = 0) { if (!audio || !audioOn) return; const t = now(); if (t - (audio.winT || 0) > 0.25) { audio.winT = t; audio.winN = 0; } if (++audio.winN > 40) return; build(audio.ac, t + when); }   // at most 40 voices started a quarter second: the rest would only be mud
// a noise burst with a filter sweep: the building block of every water sound
export function burst({ buf = 'pink', type = 'bandpass', f0 = 400, f1 = 1600, f2 = 300, q = 0.8, attack = 0.1, length = 1.0, g = 0.4, when = 0, pan = 0 }) {
  oneShot((ac, t) => { const src = ac.createBufferSource(); src.buffer = audio[buf]; src.playbackRate.value = 0.8 + fxRand() * 0.4; const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + attack * 2); f.frequency.exponentialRampToValueAtTime(f2, t + length);
    const gg = ac.createGain(); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(g, t + attack); gg.gain.exponentialRampToValueAtTime(0.0005, t + length);
    let out = gg; if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; gg.connect(p); out = p; }
    src.connect(f).connect(gg); out.connect(audio.master); src.start(t); src.stop(t + length + 0.05); }, when);
}
export const _ear = new THREE.Vector3();
export function sideOf(x, z) {   // -1 left .. 1 right of where you are looking
  camera.getWorldDirection(_ear); const dx = x - camPos.x, dz = z - camPos.z, d = Math.hypot(dx, dz) || 1; return (dx * -_ear.z + dz * _ear.x) / (d * (Math.hypot(_ear.x, _ear.z) || 1));
}
export function panAt(x, z) {   // where a sound sits in the mix: its side, narrowed with distance
  const d = Math.hypot(x - camPos.x, z - camPos.z);
  return THREE.MathUtils.clamp(sideOf(x, z) * (0.2 + 0.8 * THREE.MathUtils.smoothstep(40 - d, 0, 35)), -1, 1);
}
export function stab(x, z) { caption('stab', 'GIG', x, z);   // a gig going in: the plunk of the shaft, the hiss of its wake
  const p = panAt(x, z); burst({ buf: 'white', type: 'bandpass', f0: 1800, f1: 3000, f2: 900, q: 1.2, attack: 0.005, length: 0.18, g: 0.35, pan: p });
  burst({ buf: 'pink', type: 'bandpass', f0: 600, f1: 1400, f2: 300, q: 0.9, attack: 0.02, length: 0.6, g: 0.3, when: 0.03, pan: p });
}
export function blow(sharp) {   // a breath at the surface: the blowhole's crack and the long draw back in
  burst({ buf: 'white', type: 'highpass', f0: 1800, f1: 2400, f2: 1200, q: 0.5, attack: 0.01, length: sharp ? 0.35 : 0.6, g: sharp ? 0.32 : 0.18 });
  burst({ buf: 'pink', type: 'bandpass', f0: 500, f1: 900, f2: 700, q: 0.7, attack: 0.25, length: 0.9, g: 0.12, when: sharp ? 0.35 : 0.55 });
}
export const captions = new Map();
export const captionsOn = () => settings.captions || settings.volume === 0;
export function caption(key, text, x, z, secs = 1.5) { if (captionsOn()) captions.set(key, { text, x, z, until: performance.now() + secs * 1000 }); }
export function whump(x, z, k = 1) { caption('whump', 'WATER MOVES', x, z);   // a big body moving water right beside you: felt as much as heard
  burst({ buf: 'brown', type: 'lowpass', f0: 160, f1: 110, f2: 40, q: 0.7, attack: 0.05, length: 0.9, g: 0.55 * k, pan: panAt(x, z) });
}
export function flush(x, z, k = 1) { caption('flush', 'FISH SCATTER', x, z);   // a school bolting: a hundred tails at once
  burst({ buf: 'pink', type: 'bandpass', f0: 700, f1: 2200, f2: 500, q: 0.6, attack: 0.04, length: 0.7, g: 0.28 * k, pan: panAt(x, z) });
}
export function whoosh(k = 1) { burst({ f0: 400, f1: 1600, f2: 300, attack: 0.12, length: 1.0, g: 0.45 * k }); }
// breaking the surface: a splash whose size follows the speed through the surface, then droplets
export function splash(k) {
  burst({ buf: 'white', f0: 900, f1: 3500, f2: 500, q: 0.6, attack: 0.02, length: 0.35 + 0.4 * k, g: 0.5 * k });
  burst({ buf: 'pink', f0: 200, f1: 700, f2: 150, q: 0.5, attack: 0.05, length: 0.9 + 0.6 * k, g: 0.4 * k, when: 0.02 });
  const n = Math.floor(3 + k * 9); for (let i = 0; i < n; i++) burst({ buf: 'white', type: 'bandpass', f0: 2500 + fxRand() * 3000, f1: 4000, f2: 1500, q: 4, attack: 0.004, length: 0.04 + fxRand() * 0.06, g: 0.12 * k, when: 0.08 + fxRand() * 0.6 * (0.5 + k) });
}
// one bubble, as physics has it (Minnaert 1933): a ringing sine at f = 3.26 / radius, higher under pressure, gone in a few dozen cycles, rising a little as it leaves
export function bloop(k = 0.5, when = 0) {
  oneShot((ac, t) => { const a = 0.0008 * Math.pow(6, fxRand()), f = 3.26 / a * Math.sqrt(1 + Math.max(0, -P.pos.y) / 10), life = Math.min(0.09, 34 / f + 0.01), o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.18, t + life);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * k, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0004, t + life); o.connect(g).connect(audio.clear); o.start(t); o.stop(t + life + 0.01); }, when);
}
// the fish that sing here, all at dusk and through the night, all real, all recorded in this bay's waters. a soft pan, a long way off
function fishCall(notes, pan, g) { oneShot((ac, t) => { const out = ac.createGain(); out.gain.value = g * TUNE.sound.chorus; let last = out; if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; out.connect(p); last = p; } last.connect(audio.fx); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4; lp.connect(out);
  for (const [at, f, len, wave] of notes) { const o = ac.createOscillator(), v = ac.createGain(); o.type = wave; o.frequency.value = f; v.gain.setValueAtTime(0, t + at); v.gain.linearRampToValueAtTime(1, t + at + len * 0.2); v.gain.exponentialRampToValueAtTime(0.001, t + at + len); o.connect(v).connect(lp); o.start(t + at); o.stop(t + at + len + 0.02); } }); }
export const toadfish = (pan, g) => fishCall([[0, 170 + fxRand() * 60, 0.34, 'sawtooth'], [0.42, 180 + fxRand() * 60, 0.16, 'sawtooth']], pan, g);   // the Gulf toadfish's boatwhistle
export const blackDrum = (pan, g) => { const f = 90 + fxRand() * 20, n = 3 + Math.floor(fxRand() * 4); fishCall(Array.from({ length: n }, (_, i) => [i * (0.2 + fxRand() * 0.05), f, 0.12, 'sine']), pan, g * 1.6); };   // a black drum's slow thump, felt through a hull at night
export const seatrout = (pan, g) => fishCall(Array.from({ length: 9 }, (_, i) => [i * 0.045, 420 + fxRand() * 90, 0.03, 'square']), pan, g * 0.5);   // a spotted seatrout's croak, a quick rattling train
export function click(dist, when = 0) {   // dolphin click train, sometimes a whistle
  if (!audio || !audioOn) return; const v = 0.14 * Math.max(0, 1 - dist / 25); if (v <= 0) return;
  const n = 4 + Math.floor(fxRand() * 7), gap = 0.03 + fxRand() * 0.05;
  for (let i = 0; i < n; i++) oneShot((ac, t) => { const o = ac.createOscillator(); o.frequency.setValueAtTime(5200 + fxRand() * 2500, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.012);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0004, t + 0.014); o.connect(g).connect(audio.master); o.start(t); o.stop(t + 0.02); }, when + i * gap);
  if (fxRand() < 0.25) oneShot((ac, t) => { const o = ac.createOscillator(); const f0 = 3500 + fxRand() * 3000; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (1.4 + fxRand()), t + 0.18); o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.4);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.35, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0004, t + 0.42); o.connect(g).connect(audio.master); o.start(t); o.stop(t + 0.45); }, when + n * gap + 0.1);
}
export function squeak(dist) {   // manatee: short, high, a little mournful
  const v = 0.2 * Math.max(0, 1 - dist / 22); if (v <= 0) return;
  oneShot((ac, t) => { const o = ac.createOscillator(); const f0 = 2600 + fxRand() * 1800; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.25, t + 0.08); o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.25);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0004, t + 0.28); o.connect(g).connect(audio.master); o.start(t); o.stop(t + 0.3); });
}
export function gull(dist) {   // above water only
  const v = 0.18 * Math.max(0, 1 - dist / 220); if (v <= 0) return;
  oneShot((ac, t) => { const o = ac.createOscillator(); o.type = 'triangle'; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 0.5;
    o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1400, t + 0.12); o.frequency.linearRampToValueAtTime(1000, t + 0.4);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.05); g.gain.setValueAtTime(v, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0004, t + 0.45); o.connect(f).connect(g).connect(audio.master); o.start(t); o.stop(t + 0.5); });
}
export function clank(dist, when = 0) {   // buoy chain
  const v = 0.25 * Math.max(0, 1 - dist / 18); if (v <= 0) return;
  for (const [f, g, d] of [[640, 1, 0], [1710, 0.5, 0.004], [2900, 0.25, 0.008]]) oneShot((ac, t) => { const o = ac.createOscillator(); o.frequency.value = f * (0.95 + fxRand() * 0.1); const gg = ac.createGain(); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(v * g, t + 0.003); gg.gain.exponentialRampToValueAtTime(0.0004, t + 0.6); o.connect(gg).connect(audio.master); o.start(t); o.stop(t + 0.65); }, when + d);
}
export function crackle(v) {   // snapping shrimp: a soft filtered tick
  burst({ buf: 'white', type: 'bandpass', f0: 2200, f1: 2600, f2: 2000, q: 1.5, attack: 0.002, length: 0.02, g: v });
}
export function thud(k = 1) {
  oneShot((ac, t) => { const o = ac.createOscillator(); o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(26, t + 0.4); const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8 * k, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.6); o.connect(g).connect(audio.master); o.start(t); o.stop(t + 0.65); });
  burst({ f0: 300, f1: 1200, f2: 200, attack: 0.03, length: 0.7, g: 0.4 * k });
}
// chimes, chosen by ear: a struck bell is a sine whose brightness fades faster than its body
export function fmBell({ f = 196, ratio = 1.41, index = 2.2, decay = 4, g = 0.3, pan = 0, lp = 2200, when = 0 }) {
  oneShot((ac, t) => { const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), vg = ac.createGain(), fl = ac.createBiquadFilter();
    car.frequency.value = f; mod.frequency.value = f * ratio; mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + decay * 0.5);
    mod.connect(mg).connect(car.frequency); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 0.4;
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(g, t + 0.008); vg.gain.exponentialRampToValueAtTime(0.0005, t + decay);
    let out = vg; if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; vg.connect(p); out = p; }
    car.connect(fl).connect(vg); out.connect(audio.master); car.start(t); mod.start(t); car.stop(t + decay + 0.1); mod.stop(t + decay + 0.1); }, when);
}
export function chimeStart() {   // a new chapter, a new body: one low bell, and the bottom gives it back twice, darker and further each time
  fmBell({ f: 131, ratio: 1.37, index: 1.6, decay: 6, g: 0.34, lp: 1400 });
  fmBell({ f: 131, ratio: 1.37, index: 1.2, decay: 4.5, g: 0.1, pan: -0.5, lp: 600, when: 0.9 });
  fmBell({ f: 131, ratio: 1.37, index: 1, decay: 4, g: 0.04, pan: 0.5, lp: 350, when: 1.9 });
  burst({ buf: 'brown', type: 'lowpass', f0: 440, f1: 330, f2: 90, q: 0.3, attack: 0.4, length: 4.5, g: 0.05 });
}
export function chimeCheckpoint() {   // a place found: two pings a fifth apart, rising, and the bubbles going up
  fmBell({ f: 294, ratio: 1.41, index: 1.5, decay: 2.2, g: 0.22 });
  fmBell({ f: 440, ratio: 1.41, index: 1.3, decay: 2.6, g: 0.2, when: 0.18 });
  for (let i = 0; i < 7; i++) oneShot((ac, t) => { const o = ac.createOscillator(), gg = ac.createGain(), f = 500 + i * 90 + fxRand() * 120;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.06); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(0.06 * (1 - i / 7 * 0.6), t + 0.006); gg.gain.exponentialRampToValueAtTime(0.0004, t + 0.07);
    o.connect(gg).connect(audio.master); o.start(t); o.stop(t + 0.08); }, 0.25 + i * (0.07 + fxRand() * 0.06));
}
export function bell() {   // the ending cards: one soft tone
  for (const [f, d, g] of [[220, 0, 0.14], [330, 0.02, 0.07]]) oneShot((ac, t) => { const o = ac.createOscillator(); o.frequency.value = f; const gg = ac.createGain(); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(g, t + 0.03); gg.gain.exponentialRampToValueAtTime(0.0004, t + 3); o.connect(gg).connect(audio.master); o.start(t); o.stop(t + 3.1); }, d);
}
export function groan(k = 1) {   // something very large, very far away
  oneShot((ac, t) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(48 + fxRand() * 10, t); o.frequency.linearRampToValueAtTime(30 + fxRand() * 6, t + 4.5);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 3; const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * k, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 5);
    o.connect(f).connect(g).connect(audio.master); o.start(t); o.stop(t + 5.1); });
}
export function creak(k = 1, pan = 0, when = 0) {   // steel under load: a wreck, a piling
  burst({ buf: 'brown', type: 'bandpass', f0: 320, f1: 260, f2: 180, q: 9, attack: 0.4, length: 2.2, g: 0.22 * k, pan, when });
  burst({ buf: 'brown', type: 'bandpass', f0: 520, f1: 470, f2: 400, q: 12, attack: 0.3, length: 1.6, g: 0.12 * k, when: when + 0.5, pan });
}
export const masterLevel = () => audioOn ? 0.5 * settings.volume / 10 * (paused ? 0.35 : 1) : 0;
export function stepVolume() { if (!audio) return; const v = masterLevel(), mix = settings.amb * 100 + settings.fx;
  if (Math.abs(v - (audio.level ?? -1)) > 1e-3) { audio.level = v; audio.main.gain.setTargetAtTime(v, now(), 0.25); }
  const fear = audio.testDread ?? dread; audio.hush = (audio.hush || 0) + (fear - (audio.hush || 0)) * (fear > (audio.hush || 0) ? 0.03 : 0.006);   // falls silent over a few seconds, comes back slowly
  const amb = settings.amb / 10 * (1 - TUNE.hush * audio.hush);   // before a shark the sea itself goes quiet; your own heartbeat is on the other bus
  if (mix !== audio.mix || Math.abs(amb - (audio.ambLvl ?? -1)) > 0.004) { audio.mix = mix; audio.ambLvl = amb; audio.amb.gain.setTargetAtTime(amb, now(), 0.4); audio.fx.gain.setTargetAtTime(settings.fx / 10, now(), 0.1); } }
export const every = (key, secs, fn) => { const t = now(); if (!audio.nextT[key] || t > audio.nextT[key]) { audio.nextT[key] = t + secs; fn(); } };
export function stepAudio(above) {
  if (!audio) return; const t = now(), depth = Math.max(0, -P.pos.y), k = 0.25, nearSurf = THREE.MathUtils.clamp(1 - depth / 2.5, 0, 1);
  // the world through water
  audio.water.frequency.setTargetAtTime(above ? 14000 : Math.max(320, 900 - depth * 30), t, above ? 0.05 : 0.12);   // under: everything is heavy and far; out: the world is sharp
  audio.water.Q.setTargetAtTime(above ? 0.2 : 0.5, t, 0.1);
  if (audio.wasAbove !== undefined && audio.wasAbove !== above) burst({ buf: 'pink', type: 'bandpass', f0: above ? 500 : 1800, f1: above ? 2600 : 600, f2: above ? 1200 : 250, q: 1.4, attack: 0.01, length: 0.35, g: 0.35 });   // the pop of breaking through
  audio.wasAbove = above;
  audio.sea.g.gain.setTargetAtTime(above ? 0.25 : 0.35 + Math.min(0.25, depth * 0.012), t, 0.6); audio.sea.f.frequency.setTargetAtTime(above ? 600 : Math.max(70, 220 - depth * 6), t, 0.8);
  audio.sea2.g.gain.setTargetAtTime(above ? 0.16 : 0.05, t, 0.6);
  audio.wind.g.gain.setTargetAtTime(above ? 0.2 : 0, t, 0.5);
  audio.lap.g.gain.setTargetAtTime(nearSurf * 0.22 * (above ? 1.3 : 1), t, 0.4);
  if (above) every('wave', 3 + fxRand() * 5, () => burst({ buf: 'pink', type: 'lowpass', f0: 300, f1: 1200, f2: 250, attack: 0.5, length: 2.2, g: 0.18 }));
  // your body in the water: rush with speed, thrash on the flap stroke when you work hard near the top
  const spd = THREE.MathUtils.clamp((P.speed || 0) / P.sp.max, 0, 1), stroke = 0.5 + 0.5 * Math.sin(P.mesh.material.uniforms.uPhase.value * 2.0);
  audio.rush.g.gain.setTargetAtTime(spd * spd * 0.22, t, k); audio.rush.f.frequency.setTargetAtTime(250 + spd * 500, t, k);
  const effort = spd * (0.4 + 0.6 * Math.min(1, Math.abs(P.yawRate || 0) * 1.5)) * nearSurf;
  audio.thrash.g.gain.setTargetAtTime(effort * effort * 0.18 * (0.5 + 0.5 * stroke), t, 0.12);
  if (P.speed > P.sp.cruise * 1.3 && fxRand() < 0.012) bloop(0.2 + spd * 0.3);   // about one a second at speed
  // tidal current in the pass
  { const c = P.current || 0; audio.current.g.gain.setTargetAtTime(Math.min(0.34, 0.06 * c + 0.3 * c * c) * (above ? 0 : 1), t, 1); audio.current.f.frequency.setTargetAtTime(300 + 700 * Math.min(1, c), t, 1);   // the pass roars on a big tide
    if (c > 0.6 && !above) every('tide', 4, () => caption('tide', 'THE TIDE PULLS', P.pos.x + _cur.x * 40, P.pos.z + _cur.z * 40, 2)); }
  // bottom life: snapping shrimp crackle, denser over grass and rock, quieter deep and far off the bottom
  const bottomLife = Math.min(1, (grass.count / GRASS_MAX) * 2 + (rocks.count / ROCK_MAX) * 1.5 + (fans.count / FAN_MAX)), nearBottom = THREE.MathUtils.clamp(1 - (P.pos.y - lastFloor) / 8, 0, 1);
  { const hush = audio.hush || 0, T = TUNE.sound, deep = THREE.MathUtils.smoothstep(depth, 12, 30), v = masterLevel();
    audio.clear.gain.setTargetAtTime(above ? 0 : v * (1 - TUNE.hush * hush * 0.85), t, 0.4); audio.shrimp.gain.setTargetAtTime(T.shrimp * (0.25 + 0.75 * bottomLife) * (0.35 + 0.65 * nearBottom), t, 1);
    audio.pressure.gain.setTargetAtTime(above ? 0 : T.pressureDeep * deep + T.pressure * hush * hush, t, 0.6); audio.rough.gain.setTargetAtTime(above ? 0 : T.rough * hush * hush * hush, t, 0.4);
    // dusk and the night belong to the fish: a chorus you could fall asleep to, until it stops
    const h = day.hour, dusk = THREE.MathUtils.smoothstep(h, 17.5, 20) + (1 - THREE.MathUtils.smoothstep(h, 4.5, 6.5)), g = 0.1 * Math.min(1, dusk) * (1 - hush) * (0.4 + 0.6 * nearBottom);
    if (!above && g > 0.01) { every('toadfish', 4 + fxRand() * 9, () => toadfish((fxRand() - 0.5) * 0.7, g)); every('drum', 7 + fxRand() * 14, () => blackDrum((fxRand() - 0.5) * 0.7, g)); every('trout', 5 + fxRand() * 10, () => seatrout((fxRand() - 0.5) * 0.7, g)); } }
  // engines: every boat counts; distance muffles, prop wash shakes
  // engines: water carries them far and muffled; close in they open up, and the nearest come from their side
  P.wash = Math.max(0, (P.wash || 0) - 0.02); audio.tick = (audio.tick || 0) + 1;
  if (audio.tick % 4 === 0) for (const v of audio.engines) {   // fifteen times a second is plenty for an engine
    const on = v.src === gig ? gig.on : true, d = v.src.pos.distanceTo(P.pos), n = on ? THREE.MathUtils.clamp(1 - d / v.e.range, 0, 1) : 0;
    if (n > 0.3) caption('eng' + audio.engines.indexOf(v), v.src === gig ? 'MOTOR' : v.e === ENGINE_SHIP ? 'SHIP' : 'ENGINE', v.src.pos.x, v.src.pos.z, 0.6);
    if (d < 120 && P.pos.y > -4 && v.src !== gig && started) tip('dive', () => `${kn('dive')} dives. a hull only reaches the top few metres.`);
    v.out.gain.setTargetAtTime(n * n * n * v.e.g * (above ? 0.6 : 1) * (1 + 0.8 * (P.wash || 0) * n), t, k);   // in air the hull hides the prop
    v.lp.frequency.setTargetAtTime(120 + 2600 * n * n * n, t, 0.3);
    if (v.pan) v.pan.pan.setTargetAtTime(panAt(v.src.pos.x, v.src.pos.z), t, 0.2); }
  if ((P.wash || 0) > 0.3 && fxRand() < 0.08) crackle(0.06 * P.wash);   // cavitation in the wash
  // the fever
  const fd = fever.c.distanceTo(P.pos), fn = THREE.MathUtils.clamp(1 - fd / 90, 0, 1); audio.flutter.g.gain.setTargetAtTime(fn * fn * 0.3, t, 0.4);
  // animals near you
  for (const w of wild) { if (!w.sp) continue; const d = w.pos.distanceTo(P.pos);
    if (w.sp.id === 'manatee' && d < 22) every('manatee' + w.id, 2 + fxRand() * 6, () => squeak(d)); }
  if (above) for (const fl of flocks) { const d = fl.c.distanceTo(P.pos); if (d < 220 && fl.kind === 'wheel') every('gull' + fl.ph, 1.5 + fxRand() * 5, () => gull(d)); }
  for (const bu of world.buoys) { const d = Math.hypot(bu.x - P.pos.x, bu.z - P.pos.z); if (d < 18) every('buoy' + bu.ph, 2 + fxRand() * 4, () => clank(d)); }
  if (!above) for (const wr of world.wrecks) { const d = Math.hypot(wr.x - P.pos.x, wr.z - P.pos.z); if (d > 140) continue;   // a wreck is never quite still
    every('wreck:' + wr.name, 7 + fxRand() * 11, () => { const k = 1 - d / 140; caption('wreck', 'STEEL CREAKS', wr.x, wr.z, 2); creak(0.4 + 0.9 * k, panAt(wr.x, wr.z)); if (d < 60 && fxRand() < 0.3) creak(0.5 * k, panAt(wr.x, wr.z), 1.8); }); }
  { const bt = world.wrecks.find(w => w.name === 'USCGC Blackthorn'); if (bt && !above && Math.hypot(bt.x - P.pos.x, bt.z - P.pos.z) < 160)   // a buoy tender's chain, with no buoy anywhere near
    every('phantom', 12 + fxRand() * 18, () => { caption('phantom', 'A CHAIN', bt.x, bt.z, 2); clank(4 + fxRand() * 6); if (fxRand() < 0.5) clank(9, 0.7); }); }
  if (!above && depth > 4) every('omen', 30 + fxRand() * 45, () => { caption('omen', 'SOMETHING GROANS', camPos.x, camPos.z, 2.5); (lastFloor < -12 || fxRand() < 0.4) ? groan() : creak(); });
  // hunted: a heartbeat
  const hunterW = wild.find(w => w.hunting); if (hunterW && t > audio.heartNext) { audio.heartNext = t + (hunterW.lunge && hunterW.lunge.phase !== 'stalk' ? 0.42 : 0.75); for (const [dl, g] of [[0, 0.5], [0.16, 0.32]]) oneShot((ac, tt) => { const o = ac.createOscillator(); o.frequency.setValueAtTime(58, tt); o.frequency.exponentialRampToValueAtTime(36, tt + 0.12); const gg = ac.createGain(); gg.gain.setValueAtTime(0, tt); gg.gain.linearRampToValueAtTime(g, tt + 0.015); gg.gain.exponentialRampToValueAtTime(0.0005, tt + 0.22); o.connect(gg).connect(audio.master); o.start(tt); o.stop(tt + 0.25); }, dl); }
}
