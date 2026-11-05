// Feedback from the game → a GitHub issue. The report is built by the same code the game uses (src/lib/feedback.js),
// so a note looks the same whether it came through here or through the game's fallback link.
import { buildReport } from '../../../src/lib/feedback.js';

const ORIGINS = new Set(['https://brackishgames.github.io', 'http://localhost:8000', 'http://localhost:18437']);
const MAX_BYTES = 32 * 1024, MAX_KEYS = 40;
const json = (body, status, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

// read at most `max` bytes of the body, or null if it is bigger: the body is never trusted to be small
async function readCapped(request, max) {
  if (!request.body) return '';
  const reader = request.body.getReader(), chunks = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); return null; } chunks.push(value); }
  const out = new Uint8Array(size); let o = 0; for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(out);
}
// only short strings and short lists of short strings get through to the issue
function cleanContext(ctx) {
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return {};
  const out = {};
  for (const [k, v] of Object.entries(ctx).slice(0, MAX_KEYS)) {
    const key = String(k).slice(0, 40);
    if (Array.isArray(v)) out[key] = v.slice(0, 10).map(x => String(x).slice(0, 1000));
    else if (['string', 'number', 'boolean'].includes(typeof v)) out[key] = String(v).slice(0, 400);
  }
  return out;
}
async function github(env, path, body) {
  const r = await fetch(`https://api.github.com/repos/${env.REPO}${path}`, { method: 'POST', body: JSON.stringify(body),
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'brackish-feedback', 'content-type': 'application/json' } });
  if (!r.ok) throw new Error(`github ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '', allowed = ORIGINS.has(origin);
    const cors = allowed ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'origin' } : { vary: 'origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (new URL(request.url).pathname !== '/feedback') return json({ error: 'not found' }, 404, cors);
    if (request.method !== 'POST') return json({ error: 'post only' }, 405, cors);
    if (!allowed) return json({ error: 'not from the game' }, 403, cors);
    const { success } = await env.LIMITER.limit({ key: request.headers.get('cf-connecting-ip') || 'unknown' });
    if (!success) return json({ error: 'too many, try again in a minute' }, 429, cors);
    if ((+request.headers.get('content-length') || 0) > MAX_BYTES) return json({ error: 'too big' }, 413, cors);
    const text = await readCapped(request, MAX_BYTES); if (text === null) return json({ error: 'too big' }, 413, cors);
    let data; try { data = JSON.parse(text); } catch { return json({ error: 'not json' }, 400, cors); }
    const kind = data?.kind === 'error' ? 'error' : data?.kind === 'feedback' ? 'feedback' : null, message = typeof data?.message === 'string' ? data.message.slice(0, 2000) : '';
    if (!kind || (kind === 'feedback' && !message.trim())) return json({ error: 'a note needs words' }, 400, cors);
    const report = buildReport(message, cleanContext(data.context), kind);
    try {
      if (kind === 'error' && env.CRASH_ISSUE) { const c = await github(env, `/issues/${env.CRASH_ISSUE}/comments`, { body: `### ${report.title}\n\n${report.body}` }); console.log(JSON.stringify({ event: 'crash', url: c.html_url })); return json({ url: c.html_url }, 201, cors); }
      const issue = await github(env, '/issues', report); console.log(JSON.stringify({ event: kind, number: issue.number }));
      return json({ url: issue.html_url, number: issue.number }, 201, cors);
    } catch (e) { console.error(JSON.stringify({ event: 'github-failed', kind, error: e.message })); return json({ error: 'could not reach GitHub' }, 502, cors); }
  },
};
