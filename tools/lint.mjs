// Lint the game and its tools. Every game file is an ES module, linted on its own with only the browser's globals, so a
// name it uses without importing is an error (and tools/imports.mjs --check makes sure the imports are exactly right).
//   node tools/lint.mjs
import { ESLint } from 'eslint'; import globals from 'globals';
const rules = { 'no-undef': 'error', 'no-global-assign': 'error', 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-func-assign': 'error',
  'no-const-assign': 'error', 'no-import-assign': 'error', 'no-redeclare': 'error', 'no-self-assign': 'error', 'no-unsafe-finally': 'error', 'no-unused-private-class-members': 'error',
  'no-constant-condition': ['error', { checkLoops: false }], 'no-empty': ['error', { allowEmptyCatch: true }], 'no-dupe-else-if': 'error', 'no-duplicate-case': 'error',
  'no-self-compare': 'error', 'use-isnan': 'error', 'valid-typeof': 'error', 'no-loss-of-precision': 'error', 'no-unused-vars': 'off' };
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [
  { files: ['src/**/*.js', 'sw.js', 'tools/inspect/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser }, rules },
  { files: ['tools/**/*.mjs', 'tools/feedback-worker/**/*.js', 'tests/**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.browser } }, rules },
] });
const results = await eslint.lintFiles(['src/**/*.js', 'sw.js', 'tools/**/*.mjs', 'tools/feedback-worker/src/*.js', 'tools/inspect/*.js', 'tests/**/*.mjs']);
const root = new URL('..', import.meta.url).pathname, issues = results.flatMap(r => r.messages.map(m => `${r.filePath.replace(root, '')}:${m.line}:${m.column}  ${m.message}  (${m.ruleId})`));
if (issues.length) { console.log(issues.join('\n')); console.log(`\n${issues.length} problem${issues.length > 1 ? 's' : ''}`); process.exit(1); }
console.log(`lint: ${results.length} files clean`);
