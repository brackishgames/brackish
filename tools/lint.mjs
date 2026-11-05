// Lint the game. Its scripts share one scope, so they're joined in load order and linted as one: that's the only way
// "no-undef" can tell a real typo from a name another file defines. Errors are mapped back to each file and line.
// The lib modules and tools are linted on their own, as modules.   node tools/lint.mjs
import { ESLint } from 'eslint'; import globals from 'globals'; import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const main = readFileSync(root + 'src/main.js', 'utf8');
const ORDER = JSON.parse(main.match(/const GAME = (\[[^\]]+\])/s)[1].replace(/'/g, '"'));
// every name the modules export is handed to the game scripts as a global (src/main.js): read them with ESLint's own parser
const { parse } = await import('espree');
const exported = file => parse(readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }).body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration)
  .flatMap(n => n.declaration.declarations ? n.declaration.declarations.map(d => d.id.name) : [n.declaration.id.name]);
const libExports = ['lib', 'core'].flatMap(d => readdirSync(root + 'src/' + d).map(f => root + `src/${d}/` + f)).flatMap(exported);
const handed = Object.fromEntries(['THREE', 'EffectComposer', 'ShaderPass', 'UnrealBloomPass', 'mergeGeometries', 'BUILD', ...libExports].map(n => [n, 'readonly']));

const rules = { 'no-undef': 'error', 'no-global-assign': 'error',   // a script assigning a module's export would make a stray copy, not change it
   'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-func-assign': 'error', 'no-const-assign': 'error', 'no-redeclare': 'error',
  'no-self-assign': 'error', 'no-unsafe-finally': 'error', 'no-unused-private-class-members': 'error', 'no-constant-condition': ['error', { checkLoops: false }], 'no-empty': ['error', { allowEmptyCatch: true }],
  'no-dupe-else-if': 'error', 'no-duplicate-case': 'error', 'no-self-compare': 'error', 'use-isnan': 'error', 'valid-typeof': 'error', 'no-loss-of-precision': 'error', 'no-unused-vars': 'off' };
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [
  { files: ['**/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser, ...handed } }, rules },
  { files: ['**/*.mjs', 'src/lib/*.js', 'src/core/*.js', 'src/main.js', 'tests/**', 'tools/**'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.browser } }, rules },
] });
// the game: one text, a map from its lines back to files
let text = '', map = [];
for (const f of ORDER) { const src = readFileSync(root + 'src/' + f, 'utf8').replace(/^'use strict';\n/, '') + '\n'; const n = src.split('\n').length - 1; for (let i = 0; i < n; i++) map.push([f, i + 2]); text += src; }
const [game] = await eslint.lintText("'use strict';\n" + text, { filePath: root + 'game.js' });
const issues = game.messages.map(m => { const [f, line] = map[m.line - 2] || ['?', m.line]; return `src/${f}:${line}:${m.column}  ${m.message}  (${m.ruleId})`; });
// modules and tools, as themselves
for (const r of await eslint.lintFiles(['src/lib/*.js', 'src/core/*.js', 'src/main.js', 'tools/*.mjs', 'tests/**/*.mjs', 'sw.js'])) for (const m of r.messages) issues.push(`${r.filePath.replace(root, '')}:${m.line}:${m.column}  ${m.message}  (${m.ruleId})`);
if (issues.length) { console.log(issues.join('\n')); console.log(`\n${issues.length} problem${issues.length > 1 ? 's' : ''}`); process.exit(1); }
console.log(`lint: ${ORDER.length} game scripts, the modules and the tools are clean`);
