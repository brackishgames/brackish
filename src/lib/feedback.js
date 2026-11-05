// Feedback from inside the game: the player's note plus what the game knew at that moment, as a GitHub issue.
export const REPO = 'brackishgames/brackish';
// no @ should ever ping someone, and nothing pasted should break out of the code block
export const defang = s => String(s ?? '').replace(/@/g, '@​').replace(/```/g, "'''");
export function buildReport(message, ctx, kind = 'feedback') {
  const msg = defang(message).trim().slice(0, 2000);
  const first = msg.split('\n')[0].slice(0, 70) || (kind === 'error' ? 'an error' : 'feedback');
  const title = `${kind === 'error' ? 'Crash' : 'Beta feedback'} (${defang(ctx.version || '?')}): ${first}`;
  const rows = Object.entries(ctx).filter(([k]) => k !== 'errors' && k !== 'said').map(([k, v]) => `| ${k} | ${defang(typeof v === 'object' ? JSON.stringify(v) : v)} |`);
  const body = [msg || '_(no message)_', '', '<details><summary>What the game knew</summary>', '', '| | |', '|---|---|', ...rows, '',
    ctx.said?.length ? '**Last lines on screen**\n```\n' + ctx.said.map(defang).join('\n') + '\n```' : '',
    ctx.errors?.length ? '**Errors this session**\n```\n' + ctx.errors.map(defang).join('\n\n') + '\n```' : '', '</details>'].filter(s => s !== '').join('\n');
  return { title: title.slice(0, 200), body: body.slice(0, 60000), labels: [kind === 'error' ? 'crash' : 'feedback', 'beta'] };
}
// without a server, the report opens as a filled-in new-issue page. browsers cap URLs, so the body is trimmed to fit
export function issueUrl({ title, body, labels }, repo = REPO, max = 7000) {
  const base = `https://github.com/${repo}/issues/new?labels=${encodeURIComponent(labels.join(','))}&title=${encodeURIComponent(title)}&body=`;
  let b = body; while (b.length > 0 && (base + encodeURIComponent(b)).length > max) b = b.slice(0, Math.floor(b.length * 0.85));
  return base + encodeURIComponent(b === body ? b : b + '\n\n_(trimmed to fit a link)_');
}
