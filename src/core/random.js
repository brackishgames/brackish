import { mulberry32 } from '../lib/rng.js?v=__BUILD__';
import { QS } from './env.js?v=__BUILD__';
// every roll in the game goes through rand(). ?seed=N replays a run exactly; otherwise each visit gets its own
export const SEED = QS.has('seed') ? (+QS.get('seed') >>> 0) : (crypto.getRandomValues(new Uint32Array(1))[0]);
export const rand = mulberry32(SEED);
// presentation only (the sound's variations, the camera's shake): these run once a screen frame, and a screen frame comes
// as often as the machine can manage, so they must never draw on the world's stream or a seed would replay differently
export const fxRand = Math.random;
export const between = ([a, b]) => a + rand() * (b - a);
