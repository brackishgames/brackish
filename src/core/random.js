import { mulberry32 } from '../lib/rng.js?v=__BUILD__';
import { QS } from './env.js?v=__BUILD__';
// every roll in the game goes through rand(). ?seed=N replays a run exactly; otherwise each visit gets its own
export const SEED = QS.has('seed') ? (+QS.get('seed') >>> 0) : (crypto.getRandomValues(new Uint32Array(1))[0]);
export const rand = mulberry32(SEED);
export const between = ([a, b]) => a + rand() * (b - a);
