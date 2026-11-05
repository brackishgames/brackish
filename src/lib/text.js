// Word wrap for the dot-matrix panel.
export function greedy(words, max) { const out = []; let line = ''; for (const w of words) { if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; } out.push(line); return out; }
// balanced wrap: same number of lines as greedy, but as even as possible, so no line is left holding one word
export function wrap(str, max) {
  const out = [];
  for (const para of String(str).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean); if (!words.length) { out.push(''); continue; }
    const n = greedy(words, max).length; let lo = 1, hi = max;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (greedy(words, mid).length <= n) hi = mid; else lo = mid + 1; }
    out.push(...greedy(words, Math.max(lo, Math.max(...words.map(w => w.length)))));
  }
  return out;
}
