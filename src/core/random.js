import { mulberry32 } from '../lib/rng.js?v=__BUILD__';
import { QS } from './env.js?v=__BUILD__';
// every roll in the game goes through rand(). ?seed=N replays a run exactly; otherwise each visit gets its own
export const SEED = QS.has('seed') ? (+QS.get('seed') >>> 0) : (crypto.getRandomValues(new Uint32Array(1))[0]);
const roll = mulberry32(SEED);
// ?test: where the world's dice were rolled during a screen frame but outside a world step. a screen frame comes as often as the
// machine manages, so such a roll would make a seed replay differently elsewhere (calls a test makes between steps are fine)
export const randLeaks = new Map();
export const randGate = { inStep: false, inFrame: false, watching: false };
export const rand = () => { if (randGate.watching && randGate.inFrame && !randGate.inStep) { const where = new Error().stack.split('\n')[2]?.trim() || '?'; randLeaks.set(where, (randLeaks.get(where) || 0) + 1); } return roll(); };
// presentation only (the sound's variations, the camera's shake): these run once a screen frame, and a screen frame comes
// as often as the machine can manage, so they must never draw on the world's stream or a seed would replay differently
export const fxRand = Math.random;
export const between = ([a, b]) => a + rand() * (b - a);
