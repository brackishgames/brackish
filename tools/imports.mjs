// Write each module's imports from what it actually uses. Scope analysis finds every name a module reads but doesn't
// declare; each one some other module exports gets an import line, and the rest are names the game scripts still
// share as globals (src/main.js). Run after moving code into a module:   node tools/imports.mjs [--check]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { parse } from 'espree'; import { analyze } from 'eslint-scope';
const root = new URL('..', import.meta.url).pathname, check = process.argv.includes('--check');
const DIRS = ['lib', 'core', 'render', 'world', 'actors', 'systems', 'ui', 'app'];   // the module layers so far, lowest first
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
// load order: a module may use another's export while it is loading (outside any function) only if that module can't import
// it back. inside a loop of imports, which one finishes loading first depends on the way in, and the other would find the
// name not there yet. those uses belong in an init function that boot calls once everything has loaded.
const graph = {}, loadTime = {};
for (const f of files) {
  if (f.startsWith('lib/')) { graph[f] = []; continue; }
  const text = readFileSync(root + 'src/' + f, 'utf8'), tree = ast(text), deps = {}, used = [];
  for (const n of tree.body) if (n.type === 'ImportDeclaration' && n.source.value.startsWith('.')) { const dep = (n.source.value.split('?')[0].replace(/^\.\//, f.split('/')[0] + '/').replace(/^\.\.\//, '')); for (const sp of n.specifiers) deps[sp.local.name] = dep; }
  graph[f] = [...new Set(Object.values(deps))];
  // the module's own functions, so a call to one while loading counts what it uses too
  const own = {}; for (const n of tree.body) { const d = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    if (d?.type === 'FunctionDeclaration') own[d.id.name] = d;
    if (d?.type === 'VariableDeclaration') for (const v of d.declarations) if (v.init && /Function/.test(v.init.type)) own[v.id.name] = v.init; }
  const entered = new Set();
  const walk = (n, inFn) => { if (!n || typeof n.type !== 'string') return;
    if (/Function/.test(n.type)) inFn = true;
    if (!inFn && n.type === 'Identifier' && deps[n.name]) used.push([n.name, deps[n.name], text.slice(0, n.range[0]).split('\n').length]);
    if (!inFn && n.type === 'CallExpression' && n.callee.type === 'Identifier' && own[n.callee.name] && !entered.has(n.callee.name)) { entered.add(n.callee.name); walk(own[n.callee.name].body, false); }
    for (const [k, v] of Object.entries(n)) { if (k === 'parent' || k === 'range' || k === 'loc') continue; if (Array.isArray(v)) v.forEach(c => walk(c, inFn)); else if (v && typeof v.type === 'string') walk(v, inFn); } };
  for (const n of tree.body) if (n.type !== 'ImportDeclaration') walk(n.type === 'ExportNamedDeclaration' ? n.declaration : n, false);
  loadTime[f] = used;
}
const reach = (from, to, seen = new Set()) => from === to || (!seen.has(from) && (seen.add(from), (graph[from] || []).some(d => reach(d, to, seen))));
let risky = 0;
for (const [f, uses] of Object.entries(loadTime)) for (const [name, dep, line] of uses) if (reach(dep, f)) { risky++; console.log(`src/${f}:${line}  uses ${name} from ${dep} while loading, and ${dep} can import ${f} back`); }
if (check && (stale || risky)) process.exit(1);
if (!stale && !risky) console.log('imports: every module imports exactly what it uses, and loads in any order');
