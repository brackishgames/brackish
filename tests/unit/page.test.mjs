import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const html = read('index.html');
test('the page policy allows exactly the inline import map, and nothing from a CDN', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  const map = html.match(/<script type="importmap">(.*?)<\/script>/s)[1], hash = createHash('sha256').update(map).digest('base64');
  assert.ok(csp.includes(`'sha256-${hash}'`), 'script-src carries the import map\'s hash: update it in index.html when the map changes');
  assert.ok(!/cdn\.|jsdelivr|unpkg/.test(html), 'no CDN'); assert.equal((html.match(/<script(?![^>]*type="importmap")(?![^>]*src=)/g) || []).length, 0, 'no other inline scripts');
  for (const spec of Object.values(JSON.parse(map).imports)) assert.ok(existsSync(new URL(spec.replace(/^\.\//, ''), root)), `${spec} is in the repo`);
});
test('every game script main.js loads exists, and the shipped depths are there', () => {
  const list = JSON.parse(read('src/main.js').match(/const GAME = (\[[^\]]+\])/s)[1].replace(/'/g, '"'));
  for (const f of list) assert.ok(existsSync(new URL('src/' + f, root)), f);
  for (const n of ['outer', 'inner']) assert.ok(existsSync(new URL(`data/dem-${n}.bdem`, root)), n);
});
test('release-please and the deploy agree on the version stamp', () => {
  assert.match(html, /<meta name="version" content="[\d.]+(-beta\.\d+)?"> <!-- x-release-please-version -->/);
  assert.match(read('.github/workflows/deploy.yml'), /__BUILD__.*index\.html sw\.js src\/\*\/\*\.js/);
});
