'use strict';
// ═══════════════════════════════════════════════════════════════════
//  FEEDBACK  —  F (or the pause menu): type a note, and it goes to the
//  team as a GitHub issue with what the game knew at that moment: where
//  you were, as what, the last lines on screen, any errors. With the
//  Worker in tools/feedback-worker deployed (FEEDBACK_URL) it posts
//  straight from the game; until then it opens a filled-in new issue.
//  Crash reports go the same way, only if you turn them on in settings.
// ═══════════════════════════════════════════════════════════════════
// feedback goes here when the Worker in tools/feedback-worker is deployed; until then it opens a filled-in GitHub issue
const FEEDBACK_URL = '';
const versionString = document.querySelector('meta[name=version]')?.content || 'dev';
let crashSent = 0; const crashSeen = new Set();
function logError(text) {
  text = String(text).slice(0, 600); errorLog.push({ text, t: Date.now() }); if (errorLog.length > 20) errorLog.shift();
  if (!settings.crashReports || !FEEDBACK_URL || TEST || crashSent >= 3 || crashSeen.has(text)) return;   // opt-in, at most three a visit, each only once
  crashSeen.add(text); crashSent++; postReport('error', text).catch(() => {});
}
addEventListener('error', e => logError(`${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}:${e.colno}${e.error?.stack ? '\n' + e.error.stack : ''}`));
addEventListener('unhandledrejection', e => logError(`unhandled: ${e.reason?.stack || e.reason}`));

function feedbackContext() {
  const [lat, lon] = toLL(P.pos.x, P.pos.z), q = typeof Q !== 'undefined' ? Q : null;
  return { version: versionString, build: BUILD, seed: SEED, chapter: CHAPTERS[story.ch]?.title, body: P.sp?.name, place: nearestPoi || '-',
    where: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, depth: `${Math.max(0, -P.pos.y).toFixed(1)} m of ${Math.max(0, -floorAt(P.pos.x, P.pos.z)).toFixed(1)} m`,
    hearts: P.hp, 'time of day': `${Math.floor(dayClock)}:${String(Math.floor(dayClock % 1 * 60)).padStart(2, '0')}`, fps: q ? (1 / q.ema).toFixed(0) : '-', 'pixel ratio': q ? q.dprs[q.level] : '-',
    device: MOBILE ? (tiltOn() ? 'touch, tilt' : 'touch') : 'desktop', controller: pad.active ? (pad.sony ? 'playstation' : 'xbox or other') : 'none',
    screen: `${innerWidth}×${innerHeight} @${devicePixelRatio}`, browser: navigator.userAgent, said: sayLog.slice(-5), errors: errorLog.slice(-5).map(e => e.text) };
}
async function postReport(kind, message) {
  const r = await fetch(FEEDBACK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, message, context: feedbackContext() }) });
  if (!r.ok) throw new Error('feedback ' + r.status); return r.json();
}

// ── the note card: a real (invisible) text box takes the typing, so phones get their keyboard; the dots show what you wrote
const fb = { draft: '', sending: false, status: '', fallback: null };
const fbEl = () => $('fbtext');
function openFeedback() {
  if (!menu) openMenu('feedback'); else { menu.kind = 'feedback'; menu.sel = 0; }
  fb.status = ''; fb.fallback = null; const el = fbEl(); el.value = fb.draft; el.focus({ preventScroll: true });
}
function closeFeedback() { const el = fbEl(); fb.draft = el.value; el.blur(); menu.kind = 'main'; menu.sel = 0; }
function feedbackItems() {
  return [{ label: () => fb.sending ? 'SENDING…' : fb.fallback ? 'OPEN ON GITHUB' : 'SEND', act: sendFeedback }, { label: () => 'CANCEL', act: closeFeedback }];
}
function feedbackKey(e) {
  if (e.code === 'Escape') { e.preventDefault(); closeFeedback(); }
  else if (e.code === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFeedback(); }   // shift+enter is a new line
}
function feedbackLines(cols) {   // what the card shows: your words with a cursor, or a prompt, then how it went
  const text = fbEl().value, cursor = Math.floor(performance.now() / 500) % 2 ? '_' : ' ';
  const lines = text ? wrap(text + cursor, cols) : wrap('what happened? it goes to the people making this, with where you were and what you were.', cols);
  return [...lines.slice(-6), ...(fb.status ? ['', ...wrap(fb.status, cols)] : [])];
}
function feedbackSent(msg, url = null) { fb.draft = ''; fbEl().value = ''; fbEl().blur(); fb.fallback = null; closeMenu(); say(msg, 3.5); emit('feedback-sent', { url }); }
async function sendFeedback() {
  if (fb.sending) return;
  if (fb.fallback) { const url = fb.fallback; window.open(url, '_blank', 'noopener'); feedbackSent('THANK YOU\nfinish sending it in the GitHub tab', url); return; }
  const text = fbEl().value.trim(); if (!text) { fb.status = 'write something first'; fbEl().focus({ preventScroll: true }); return; }
  const report = buildReport(text, feedbackContext());
  if (!FEEDBACK_URL) { const url = issueUrl(report); window.open(url, '_blank', 'noopener'); feedbackSent('THANK YOU\nfinish sending it in the GitHub tab', url); return; }   // opened inside the key press, so no popup blocker
  fb.sending = true; fb.status = '';
  try { const r = await postReport('feedback', text); fb.sending = false; feedbackSent('THANK YOU\nit is with the keepers of the bay', r?.url ?? null); }
  catch (e) { fb.sending = false; fb.fallback = issueUrl(report); fb.status = 'could not reach the server. choose OPEN ON GITHUB to send it there instead.'; logError('feedback: ' + e.message); }
}
