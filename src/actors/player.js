import * as THREE from 'three';
import { rand } from '../core/random.js?v=__BUILD__';
import { settings } from '../core/settings.js?v=__BUILD__';
import { fwdOf } from '../core/space.js?v=__BUILD__';
import { TUNE } from '../core/tune.js?v=__BUILD__';
import { scene } from '../render/display.js?v=__BUILD__';
import { emitBubble } from '../render/effects.js?v=__BUILD__';
import { WU } from '../render/materials.js?v=__BUILD__';
import { START } from '../world/geo.js?v=__BUILD__';
import { creatureMesh, speciesById } from './creatures.js?v=__BUILD__';
import { echoThing } from './wildlife.js?v=__BUILD__';
import { biteSound, burst, click, splash, thud, whoosh } from '../systems/audio.js?v=__BUILD__';
import { rumble } from '../systems/input.js?v=__BUILD__';
import { flash, lastCheckpoint, say, travelTo } from '../ui/hud.js?v=__BUILD__';
import { later, simTime } from '../app/frame.js?v=__BUILD__';
// The body you are: where it is, how it moves (13-frame steps it), what it can do, and what happens when it's hurt.
export const unlocked = new Set();
export const P = { pos: new THREE.Vector3(START[0], -4, START[1]), yaw: Math.PI, pitch: 0, roll: 0, vel: new THREE.Vector3(), speed: 1.3, yawRate: 0, sp: speciesById.cownose, mesh: null, hp: 3, stun: 0, air: 0 };
export const playerMeshes = {};
export function becomeSpecies(sp) {
  P.air = 1;
  if (P.mesh) P.mesh.visible = false;
  if (!playerMeshes[sp.id]) { playerMeshes[sp.id] = creatureMesh(sp, 1.3); scene.add(playerMeshes[sp.id]); }
  P.mesh = playerMeshes[sp.id]; P.mesh.visible = true; P.sp = sp; P.speed = sp.cruise; unlocked.add(sp.id);
}


// (a real ray's sprint covers 18 m in five seconds, which you never feel in a 40 km bay; a game burst covers about 40. a shark still out-sprints your cruise, but not your burst)
export const HP_MAX = 5;   /* three hearts is healthy; fat reserves carry you to five */
export const AIR = new Set(['dolphin', 'manatee']);   // the bodies that come up to breathe
export const HOLD = { dolphin: 75, manatee: 120 };   // seconds of air, in proportion to the real animals
export const ABILITY = { cownose: 'sense', dolphin: 'echo', bull: 'lunge', hammer: 'lunge',
  manatee: 'breathe', mullet: 'leap' };
export const ABILITY_CD = { sense: 3, echo: 2, lunge: 1.2, breathe: 2, leap: 1.5 };
export const pulses = [];
export function act() {
  const kind = ABILITY[P.sp.id] || 'sense', now = simTime;   // world time: a pause doesn't run the cooldown down if ((P.actReady || 0) > now) return; P.actReady = now + ABILITY_CD[kind];
  if (kind === 'sense' || kind === 'echo') {   // rays feel electric fields; dolphins hear their own clicks come back
    pulses.push({ t0: WU.uTime.value, kind });   // the rings are drawn on screen time P.reveal = 1; P.revealRange = kind === 'echo' ? 90 : 50;
    if (kind === 'echo') { click(3); click(3, 0.22); later(TUNE.timing.echoReach, echoThing, 'world'); } else burst({ buf: 'brown', type: 'lowpass', f0: 120, f1: 380, f2: 70, attack: 0.06, length: 1.4, g: 0.35 });
  } else if (kind === 'lunge') { P.vel.addScaledVector(fwdOf(P.yaw, P.pitch), P.sp.max * 1.3); P.strikeT = 0.45; whoosh(0.7); }
  else if (kind === 'breathe') { if (P.pos.y > -1.2) { P.sta = 1; P.spent = false; splash(0.3); say('a breath', 1.2); } else { say('too deep to breathe', 1.2); P.actReady = now + 0.3; } }
  else if (kind === 'leap') { if (P.pos.y > -1.6) { P.vel.y = 6; P.leapT = 0.6; P.vel.addScaledVector(fwdOf(P.yaw), 2); } else { say('get near the surface', 1.2); P.actReady = now + 0.3; } }
}
export const abilityName = () => (ABILITY[P.sp.id] || 'sense').toUpperCase();

// hurt: a heart gone, a moment stunned, the screen's edge flashing; at none, back to the last checkpoint
export function hurt(k, msg) {
  if (P.stun > 0) return; rumble(0.4 + k * 0.5, 0.6, 320); thud(k); biteSound(k); for (let i = 0; i < 24; i++) emitBubble(P.pos.x + (rand() - 0.5) * 1.5, P.pos.y + (rand() - 0.5), P.pos.z + (rand() - 0.5) * 1.5); P.hp = Math.max(0, P.hp - 1); P.stun = 2.5; P.pitch = -0.6; P.shake = Math.max(P.shake || 0, k);
  if (settings.flash) { flash.style.opacity = 0.75; later(TUNE.timing.hitFlash, () => { flash.style.opacity = 0; }); }
  say(P.hp > 0 ? msg : 'THE BAY WENT QUIET\n\nreturning to the last checkpoint', 3.5);
  if (P.hp === 0) later(TUNE.timing.respawn, () => { travelTo(lastCheckpoint); P.hp = 3; }, 'world');
}
