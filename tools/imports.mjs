// Write each module's imports from what it actually uses. Scope analysis finds every name a module reads but doesn't
// declare; each one some other module exports gets an import line, and the rest are names the game scripts still
// share as globals (src/main.js). Run after moving code into a module:   node tools/imports.mjs [--check]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { parse } from 'espree'; import { analyze } from 'eslint-scope';
const root = new URL('..', import.meta.url).pathname, check = process.argv.includes('--check');
const DIRS = ['lib', 'core', 'render', 'world', 'actors'];   // the module layers so far, lowest first
const THREE_NAMES = { THREE: `import * as THREE from 'three';`, EffectComposer: `import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';`,
  ShaderPass: `import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';`, UnrealBloomPass: `import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';`,
  mergeGeometries: `import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';` };
const files = DIRS.flatMap(d => { try { return readdirSync(root + 'src/' + d).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`); } catch { return []; } });
const ast = text => parse(text, { ecmaVersion: 'latest', sourceType: 'module', range: true });
const exportsOf = {}, owner = {};
for (const f of files) { exportsOf[f] = ast(readFileSync(root + 'src/' + f, 'utf8')).body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration)
  .flatMap(n => n.declaration.declarations ? n.declaration.declarations.map(d => d.id.name) : [n.declaration.id.name]);
  for (const n of exportsOf[f]) { if (owner[n]) throw new Error(`${n} is exported by both ${owner[n]} and ${f}`); owner[n] = f; } }
let stale = 0;
for (const f of files) {
  if (f.startsWith('lib/')) continue;   // the lib modules are pure and import nothing from the game
  const text = readFileSync(root + 'src/' + f, 'utf8'), body = text.replace(/^(import [^\n]*\n)+/, '');
  const scope = analyze(ast(body), { ecmaVersion: 2022, sourceType: 'module' }), used = new Set();
  for (const ref of scope.globalScope.through) used.add(ref.identifier.name);
  for (const s of scope.scopes) if (s.type === 'module') for (const ref of s.through) used.add(ref.identifier.name);
  const from = {};
  for (const n of [...used].sort()) { const o = owner[n]; if (o && o !== f) (from[o] ??= []).push(n); }
  const dir = f.split('/')[0], rel = o => (o.split('/')[0] === dir ? './' : '../') + (o.split('/')[0] === dir ? o.split('/')[1] : o);
  const lines = [...Object.keys(THREE_NAMES).filter(n => used.has(n) && !owner[n]).map(n => THREE_NAMES[n]),
    ...Object.entries(from).sort(([a], [b]) => files.indexOf(a) - files.indexOf(b)).map(([o, ns]) => `import { ${ns.join(', ')} } from '${rel(o)}?v=__BUILD__';`)];
  const next = (lines.length ? lines.join('\n') + '\n' : '') + body;
  if (next !== text) { stale++; if (check) console.log(`${f}: imports out of date`); else { writeFileSync(root + 'src/' + f, next); console.log(`${f}: ${lines.length} imports`); } }
}
if (check && stale) process.exit(1);
if (!stale) console.log('imports: every module imports exactly what it uses');
