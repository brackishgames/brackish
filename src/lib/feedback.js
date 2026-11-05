// Feedback from inside the game: the player's note, and what the game knew at that moment, as a GitHub issue laid out
// like the issue form in .github/ISSUE_TEMPLATE/feedback.yml (a "What happened?" section and a "Game details" block).
export const REPO = 'brackishgames/brackish';
// no @ should ever ping someone, and nothing pasted should break out of the details block
export const defang = s => String(s ?? '').replace(/@/g, '@\u200b').replace(/```/g, "'''");
// inside the details block GitHub links no mentions, so there a line only has to stay inside its block
const fence = s => String(s ?? '').replace(/```/g, "'''");
// the game's state as plain lines: `chapter: IV · THE GULF`, then the last lines on screen, then any errors
export function detailsText(ctx) {
  const lines = Object.entries(ctx).filter(([k]) => k !== 'errors' && k !== 'said').map(([k, v]) => `${k}: ${fence(typeof v === 'object' ? JSON.stringify(v) : v)}`);
  if (ctx.said?.length) lines.push('', 'last lines on screen:', ...ctx.said.map(l => '  ' + fence(l)));
  if (ctx.errors?.length) lines.push('', 'errors this session:', ...ctx.errors.flatMap(e => fence(e).split('\n').map(l => '  ' + l)));
  return lines.join('\n');
}
export function buildReport(message, ctx, kind = 'feedback') {
  const what = defang(message).trim().slice(0, 2000), details = detailsText(ctx).slice(0, 50000);
  const first = what.split('\n')[0].slice(0, 70) || (kind === 'error' ? 'an error' : 'a note');
  const title = `${kind === 'error' ? 'Crash' : 'Feedback'}: ${first}`;
  const body = `### What happened?\n\n${what || '_(no message)_'}\n\n### Game details\n\n\`\`\`text\n${details}\n\`\`\`\n`;   // what the issue form produces, so both roads look the same
  return { title: title.slice(0, 200), body, what, details, labels: [kind === 'error' ? 'crash' : 'feedback', 'beta'] };
}
// without a server, the report opens as the issue form, filled in: the note in its box, the details in theirs (the form adds
// the labels). browsers cap a URL's length, so the details give way first, then the note
export function issueUrl({ title, what, details }, repo = REPO, max = 7000) {
  const url = (w, d) => `https://github.com/${repo}/issues/new?template=feedback.yml&title=${encodeURIComponent(title)}&what=${encodeURIComponent(w)}&details=${encodeURIComponent(d)}`;
  let w = what, d = details;
  while (url(w, d).length > max && d.length > 0) d = d.slice(0, Math.floor(d.length * 0.8));
  while (url(w, d).length > max && w.length > 0) w = w.slice(0, Math.floor(w.length * 0.8));
  return url(w, d === details ? d : d + '\n(trimmed to fit a link)');
}
