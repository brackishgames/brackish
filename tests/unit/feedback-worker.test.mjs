import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../tools/feedback-worker/src/index.js';
// a stand-in for the platform: a rate limiter that says yes (or no), and a GitHub that records what it was sent
const env = (over = {}) => ({ REPO: 'brackishgames/brackish', CRASH_ISSUE: '', GITHUB_TOKEN: 't0ken', LIMITER: { limit: async () => ({ success: true }) }, ...over });
const post = (body, origin = 'https://brackishgames.github.io', extra = {}) => new Request('https://w.example/feedback', { method: 'POST', headers: { origin, 'content-type': 'application/json', ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });
function fakeGitHub() { const sent = []; globalThis.fetch = async (url, init) => { sent.push({ url, init, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ number: 7, html_url: 'https://github.com/brackishgames/brackish/issues/7' }), { status: 201 }); }; return sent; }

test('a note from the game becomes an issue, with no pings and the token only in the header', async () => {
  const sent = fakeGitHub();
  const r = await worker.fetch(post({ kind: 'feedback', message: 'hi @everyone, the shark', context: { version: '0.1.0-beta.1', chapter: 'III', said: ['a line'] } }), env());
  assert.equal(r.status, 201); assert.equal(r.headers.get('access-control-allow-origin'), 'https://brackishgames.github.io'); assert.equal((await r.json()).number, 7);
  assert.equal(sent.length, 1); assert.equal(sent[0].url, 'https://api.github.com/repos/brackishgames/brackish/issues');
  assert.equal(sent[0].init.headers.authorization, 'Bearer t0ken'); assert.ok(!JSON.stringify(sent[0].body).includes('t0ken'));
  assert.ok(sent[0].body.title.includes('@​everyone')); assert.deepEqual(sent[0].body.labels, ['feedback', 'beta']); assert.ok(sent[0].body.body.includes('| chapter | III |'));
});
test('refuses other sites, other methods, big bodies, junk, empty notes, and floods', async () => {
  const sent = fakeGitHub();
  assert.equal((await worker.fetch(post({ kind: 'feedback', message: 'x' }, 'https://evil.example'), env())).status, 403);
  assert.equal((await worker.fetch(new Request('https://w.example/feedback', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), env())).status, 403);
  assert.equal((await worker.fetch(new Request('https://w.example/feedback', { method: 'OPTIONS', headers: { origin: 'http://localhost:8000' } }), env())).status, 204);
  assert.equal((await worker.fetch(new Request('https://w.example/feedback', { headers: { origin: 'http://localhost:8000' } }), env())).status, 405);
  assert.equal((await worker.fetch(new Request('https://w.example/elsewhere', { method: 'POST' }), env())).status, 404);
  assert.equal((await worker.fetch(post('x'.repeat(40000)), env())).status, 413);
  assert.equal((await worker.fetch(post('{not json'), env())).status, 400);
  assert.equal((await worker.fetch(post({ kind: 'feedback', message: '   ' }), env())).status, 400);
  assert.equal((await worker.fetch(post({ kind: 'spam', message: 'x' }), env())).status, 400);
  assert.equal((await worker.fetch(post({ kind: 'feedback', message: 'x' }), env({ LIMITER: { limit: async () => ({ success: false }) } }))).status, 429);
  assert.equal(sent.length, 0, 'none of that reached GitHub');
});
test('crash reports can gather as comments on one issue', async () => {
  const sent = fakeGitHub();
  const r = await worker.fetch(post({ kind: 'error', message: 'TypeError: x is undefined', context: { version: 'v' } }), env({ CRASH_ISSUE: '12' }));
  assert.equal(r.status, 201); assert.equal(sent[0].url, 'https://api.github.com/repos/brackishgames/brackish/issues/12/comments'); assert.match(sent[0].body.body, /^### Crash/);
});
