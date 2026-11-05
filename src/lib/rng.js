// Seeded randomness. Every roll in the game goes through rand(), so a seed replays a run exactly.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// a fixed hash of two integers into [0, 1): the same cell always gets the same grass, food and rocks
export const hash2 = (x, z) => { let n = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
