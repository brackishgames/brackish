// Copy three.js (only the files the game imports, following their own imports) into vendor/three, so the game
// loads nothing from a CDN and the page can forbid outside scripts.   node tools/vendor-three.mjs [version]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, posix } from 'node:path';
const V = process.argv[2] || '0.187.0', CDN = `https://cdn.jsdelivr.net/npm/three@${V}/`, OUT = new URL('../vendor/three/', import.meta.url);
const ENTRY = ['build/three.module.js', 'examples/jsm/postprocessing/EffectComposer.js', 'examples/jsm/postprocessing/ShaderPass.js',
  'examples/jsm/postprocessing/UnrealBloomPass.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'LICENSE'];
const seen = new Set(), queue = [...ENTRY];
while (queue.length) {
  const p = queue.shift(); if (seen.has(p)) continue; seen.add(p);
  const r = await fetch(CDN + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); const text = await r.text();
  const file = new URL(p, OUT); mkdirSync(dirname(file.pathname), { recursive: true }); writeFileSync(file, text);
  if (p.endsWith('.js')) for (const [, spec] of text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g)) if (spec.startsWith('.')) queue.push(posix.normalize(posix.join(posix.dirname(p), spec)));
}
console.log(`three ${V}: ${seen.size} files →`, [...seen].join(', '));
