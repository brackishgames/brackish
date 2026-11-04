'use strict';
// ═══════════════════════════════════════════════════════════════════
//  PANEL  —  the display draws its own type: a 5×7 dot font, the compass,
//  the map and every word, lit on the same matrix as the bay.
// ═══════════════════════════════════════════════════════════════════
const FONT = {"A": ".###.#...##...#######...##...##...#", "B": "####.#...##...#####.#...##...#####.", "C": ".###.#...##....#....#....#...#.###.", "D": "####.#...##...##...##...##...#####.", "E": "######....#....####.#....#....#####", "F": "######....#....####.#....#....#....", "G": ".###.#...##....#.####...##...#.####", "H": "#...##...##...#######...##...##...#", "I": ".###...#....#....#....#....#...###.", "J": "..###...#....#....#....#.#..#..##..", "K": "#...##..#.#.#..##...#.#..#..#.#...#", "L": "#....#....#....#....#....#....#####", "M": "#...###.###.#.##.#.##...##...##...#", "N": "#...##...###..##.#.##..###...##...#", "O": ".###.#...##...##...##...##...#.###.", "P": "####.#...##...#####.#....#....#....", "Q": ".###.#...##...##...##.#.##..#..##.#", "R": "####.#...##...#####.#.#..#..#.#...#", "S": ".#####....#.....###.....#....#####.", "T": "#####..#....#....#....#....#....#..", "U": "#...##...##...##...##...##...#.###.", "V": "#...##...##...##...##...#.#.#...#..", "W": "#...##...##...##.#.##.#.##.#.#.#.#.", "X": "#...##...#.#.#...#...#.#.#...##...#", "Y": "#...##...#.#.#...#....#....#....#..", "Z": "#####....#...#...#...#...#....#####", "0": ".###.#...##..###.#.###..##...#.###.", "1": "..#...##....#....#....#....#...###.", "2": ".###.#...#....#...#...#...#...#####", "3": "#####...#...#.....#.....##...#.###.", "4": "...#...##..#.#.#..#.#####...#....#.", "5": "######....####.....#....##...#.###.", "6": "..##..#...#....####.#...##...#.###.", "7": "#####....#...#...#...#....#....#...", "8": ".###.#...##...#.###.#...##...#.###.", "9": ".###.#...##...#.####....#...#..##..", " ": "...................................", ".": "..........................##...##..", ",": ".....................##....#...#...", "'": "..#....#...#.......................", "-": "................###................", ":": "......##...##........##...##.......", "/": "....#....#...#...#...#...#....#....", "!": "..#....#....#....#....#.........#..", "?": ".###.#...#....#...#...#.........#..", "(": "...#...#...#....#....#.....#.....#.", ")": ".#.....#.....#....#....#...#...#...", "·": ".................#.................", "×": ".....#...#.#.#...#...#.#.#...#.....", "♥": "##.############.###...#............", "◆": "..#...###.#####.###...#............", "◄": "....#...##..###.####..###...##....#", "►": "#....##...###..####.###..##...#....", "▲": ".......#...###.#####...............", "▼": ".....#####.###...#.................", "←": ".......#...#...#####.#.....#.......", "→": ".......#.....#.#####...#...#.......", "↑": "..#...###.#.#.#..#....#....#....#..", "↓": "..#....#....#....#..#.#.#.###...#..", "⇄": "..#...#...#####.....#####...#...#..", "+": ".......#....#..#####..#....#.......", "=": "..........#####.....#####..........", "\"": ".#.#..#.#..........................", "&": ".##..#..#.#.#...#...#.#.##..#..##.#", ";": "......##...##........##....#...#...", "°": ".##..#..#..##......................", "#": ".#.#..#.#.#####.#.#.#####.#.#..#.#."};
const FONT3 = {"A": ".#.#.#####.##.#", "B": "##.#.###.#.###.", "C": ".###..#..#...##", "D": "##.#.##.##.###.", "E": "####..##.#..###", "F": "####..##.#..#..", "G": ".###..#.##.#.##", "H": "#.##.#####.##.#", "I": "###.#..#..#.###", "J": "..#..#..##.#.#.", "K": "#.##.###.#.##.#", "L": "#..#..#..#..###", "M": "#.########.##.#", "N": "##.#.##.##.##.#", "O": ".#.#.##.##.#.#.", "P": "##.#.###.#..#..", "Q": ".#.#.##.###..##", "R": "##.#.###.#.##.#", "S": ".###...#...###.", "T": "###.#..#..#..#.", "U": "#.##.##.##.####", "V": "#.##.##.##.#.#.", "W": "#.##.########.#", "X": "#.##.#.#.#.##.#", "Y": "#.##.#.#..#..#.", "Z": "###..#.#.#..###", "0": "####.##.##.####", "1": ".#.##..#..#.###", "2": "##...#.#.#..###", "3": "##...#.#...###.", "4": "#.##.####..#..#", "5": "####..##...###.", "6": ".###..####.####", "7": "###..#.#..#..#.", "8": "####.#####.####", "9": "####.####..###.", " ": "...............", ".": ".............#.", "·": ".......#.......", "-": "......###......", "♥": "#.#######.#....", "▼": "...###.#.......", "◆": ".#.###.#.......", "◄": "..#.#####.##..#", "►": "#..##.#####.#..", "▲": "....#.###......", "+": "....#.###.#....", ":": "....#.....#....", "'": ".#..#..........", "/": "..#..#.#.#..#..", "?": "##...#.#.....#.", "(": ".#.#..#..#...#.", ")": ".#...#..#..#.#.", "×": "...#.#.#.#.#...", "⇄": "...###...###...", "!": ".#..#..#.....#.", ",": "..........#.#..", "&": ".#.#.#.#.#.#.##", "←": "....#.###.#....", "→": "....#.###.#....", "↑": ".#.###.#..#..#.", "↓": ".#..#..#.###.#."};
const panel = { w: 0, h: 0, data: null, tex: null, map: null, mapS: 0 };
function panelResize(w, h) {
  if (panel.w === w && panel.h === h) return;
  if (panel.tex) panel.tex.dispose();
  panel.w = w; panel.h = h; panel.data = new Uint8Array(w * h);
  panel.tex = new THREE.DataTexture(panel.data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  panel.tex.minFilter = panel.tex.magFilter = THREE.NearestFilter; panel.tex.unpackAlignment = 1; panel.tex.needsUpdate = true;
  dotPass.uniforms.tText.value = panel.tex; panel.map = null;
}
let pGain = 1;   // the HUD draws through this so it can fade when the water is quiet
function pDot(x, y, v) { x |= 0; y |= 0; v *= pGain; if (x < 0 || y < 0 || x >= panel.w || y >= panel.h || v <= 0) return; const i = (panel.h - 1 - y) * panel.w + x; if (v > panel.data[i]) panel.data[i] = Math.min(255, v); }
function pText(str, x, y, v = 230, align = 'left', scale = 1, small = false) {   // small = the 3×5 readout font
  const F = small ? FONT3 : FONT, gw = small ? 3 : 5, gh = small ? 5 : 7, adv = gw + 1;
  const chars = [...String(str).toUpperCase()], w = chars.length * adv * scale - scale;
  let sx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  for (const ch of chars) { const g = F[ch] || F['?'];
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) if (g[r * gw + c] === '#') for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) pDot(sx + c * scale + dx, y + r * scale + dy, v);
    sx += adv * scale; }
  return w;
}
function greedy(words, max) { const out = []; let line = ''; for (const w of words) { if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; } out.push(line); return out; }
// balanced wrap: same number of lines as greedy, but as even as possible, so no line is left holding one word
function wrap(str, max) {
  const out = [];
  for (const para of String(str).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean); if (!words.length) { out.push(''); continue; }
    const n = greedy(words, max).length; let lo = 1, hi = max;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (greedy(words, mid).length <= n) hi = mid; else lo = mid + 1; }
    out.push(...greedy(words, Math.max(lo, Math.max(...words.map(w => w.length)))));
  }
  return out;
}
function pRing(cx, cy, r, v) { const n = Math.max(12, Math.round(r * 6)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pDot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, v); } }
// fades are driven here from the same state the DOM carries (classes and inline opacity), not read back from CSS
const fades = new Map(); let fadeT = performance.now(), fadeDt = 0;
function fadeTarget(el) {
  if (el.classList.contains('panel')) return el.classList.contains('gone') ? 0 : 1;
  if (el.closest('#title')) return $('title').classList.contains('attract') ? 0 : 1;
  if (el === bl) return document.body.classList.contains('settled') ? 0 : 1;
  return el.style.opacity !== '' ? +el.style.opacity : 0;   // story, card, warning and fade start hidden
}
function opa(el) { if (!el) return 0; const tg = fadeTarget(el); if (el.id === 'load' && tg === 0) return 0; /* the loading card cuts, so it never ghosts under the title */ let a = fades.has(el) ? fades.get(el) : tg; a += (tg - a) * Math.min(1, fadeDt * 5); if (Math.abs(tg - a) < 0.01) a = tg; fades.set(el, a); return a; }
const toCell = px => px * renderer.getPixelRatio() / dotPass.uniforms.uPitch.value;
function drawPanel() {
  if (!panel.data) return; panel.data.fill(0); { const now = performance.now(); fadeDt = Math.min(0.1, Math.max(1 / 120, (now - fadeT) / 1000)); fadeT = now; }   // always progress, even if the clock stalls
  const W = panel.w, H = panel.h, ST = Math.round(H * 0.045), SL = 3 + Math.round(W * 0.012), SB = Math.round(H * 0.02), cx = W >> 1, t = WU.uTime.value, cols = Math.max(12, Math.floor((W - 8) / 6));
  const oLoad = opa($('load')), oTitle = opa($('title')), oHelp = opa(help), oMap = mapOpen ? 1 : 0, oFade = opa($('fade'));
  const oFull = menu ? 1 : 0;
  dotPass.uniforms.uDim.value = Math.max(oFade, oLoad, oHelp * 0.85, oMap * 0.9, oFull * 0.85);
  if (oLoad > 0.01) {   // loading
    const bw = Math.min(40, W - 20), pct = (parseFloat($('bar').style.width) || 0) / 100, by = H >> 1;   // loading: one line of dots, nothing else
    for (let i = 0; i < bw; i++) pDot(cx - bw / 2 + i, by, (i < bw * pct ? 200 : 26) * oLoad);
    if (/ERROR|UNREACHABLE/.test(loadmsg.textContent)) wrap(loadmsg.textContent, cols).forEach((l, i) => pText(l, cx, by + 6 + i * 10, 200 * oLoad, 'center'));
    panel.tex.needsUpdate = true; return;
  }
  if (oTitle > 0.01) {   // title text, under the bubble logo
    const ps = [$('titlehint'), $('restart')].filter(el => el && el.style.display !== 'none');   // the title is the logo and one prompt
    let y = Math.round(H * 0.6);
    for (const el of ps) { const o = oTitle * opa(el), small = el.tagName === 'SMALL';
      for (const l of wrap(el.textContent, cols)) { pText(l, cx, y, (small ? 120 : 215) * o, 'center'); y += 10; } y += 5; }
  }
  { const urgent = huntHeat > 0 || (P.air ?? 1) < 0.999 || P.hp < 3 || P.lit || opa(warn) > 0.01 || (P.sta ?? 1) < 0.999 || t - (story.beganAt || 0) < 20;
    if (urgent) hudWakeT = t; const quiet = t - hudWakeT; hudGain += ((quiet > 10 ? 0.22 : 1) - hudGain) * Math.min(1, fadeDt * (quiet > 10 ? 0.4 : 4)); }   // quiet water, quiet screen
  if (document.body.classList.contains('playing') && !mapOpen && !menu && oHelp < 0.05) {   // HUD, inset clear of notches and rounded corners
    pGain = hudGain;
    pText(tl.textContent, SL, ST + 2, 230, 'left', 1, true); pText(tr.textContent, W - SL, ST + 2, 180, 'right', 1, true);
    { const age = (performance.now() - lastSaved) / 1000; if (age < 2) pText('SAVED', W - SL, ST + 9, 150 * Math.min(1, 2 - age), 'right', 1, true); }
    const sta = P.sta ?? 1; if (sta < 0.999 || sprinting()) for (let i = 0; i < 8; i++) { const on = i < Math.round(sta * 8); for (let x = 0; x < 3; x++) pDot(SL + i * 4 + x, ST + 9, on ? 220 : 60); }
    { const ready = (P.actReady || 0) <= t; pText('E ' + abilityName(), SL, ST + 12, ready ? 170 : 70, 'left', 1, true); }
    if ((P.air ?? 1) < 0.999) { const low = P.air < 0.25; pText('AIR', SL, ST + 19, low ? 150 + 105 * (0.5 + 0.5 * Math.sin(t * 8)) : 170, 'left', 1, true); for (let i = 0; i < 8; i++) { const on = i < Math.ceil(P.air * 8); for (let x = 0; x < 3; x++) pDot(SL + 14 + i * 4 + x, ST + 21, on ? 220 : 60); } }   // lungs
    if (huntHeat > 0) { const n = Math.ceil(huntHeat * 3); pText('HUNTED ' + '◆'.repeat(n) + '·'.repeat(3 - n), SL, ST + ((P.air ?? 1) < 0.999 ? 26 : 19), 150 + 105 * (0.5 + 0.5 * Math.sin(t * 6)), 'left', 1, true); }   // stars: break contact to drain them
    _v.copy(P.pos).project(camera); const px = (_v.x * 0.5 + 0.5) * W, py = (0.5 - _v.y * 0.5) * H;
    for (let i = pulses.length - 1; i >= 0; i--) { const age = t - pulses[i].t0, life = pulses[i].kind === 'echo' ? 1.8 : 1.4; if (age > life) { pulses.splice(i, 1); continue; }
      const rings = pulses[i].kind === 'echo' ? 3 : 1; for (let k = 0; k < rings; k++) { const a = age - k * 0.18; if (a > 0) pRing(px, py, a / life * W * 0.55, 210 * (1 - a / life)); } }
    const hdg = headingDeg(), half = Math.max(24, Math.floor(W * 0.17)), ppd = half / 60;   // compass
    for (const [deg, name] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W'], [45, '·'], [135, '·'], [225, '·'], [315, '·']]) { const rel = ((deg - hdg + 540) % 360) - 180; if (Math.abs(rel) <= 60) pText(name, cx + Math.round(rel * ppd), ST + 9, name === '·' ? 110 : 190, 'center', 1, true); }
    for (let y = ST + 7; y <= ST + 15; y += 8) { pDot(cx, y, 255); pDot(cx, y + 1, 255); }   // the lubber line above and below the cardinals
    const goal = compassMarks.find(l => l.goal);
    if (goal) { const raw = ((goal.bearing - hdg + 540) % 360) - 180, off = Math.abs(raw) > 52, gx = cx + Math.round(THREE.MathUtils.clamp(raw, -52, 52) * ppd);
      const label = goal.dist > 999 ? (goal.dist / 1000).toFixed(1) + 'KM' : Math.round(goal.dist / 10) * 10 + 'M';
      pText(off ? (raw > 0 ? '►' : '◄') : '◆', gx, ST + 1, 255, 'center', 1, true); pText(label, gx + (raw > 0 ? -4 : 4), ST + 1, 190, raw > 0 ? 'right' : 'left', 1, true); }
    const ow = opa(warn); if (ow > 0.01 && warn.textContent) pText(warn.textContent, cx, ST + 20, 255 * ow * (0.65 + 0.35 * Math.sin(t * 8)), 'center');
    { const MS = Math.max(22, Math.min(46, Math.floor(H * 0.2))), mx = W - MS - SL, my = H - MS - SB, span = 3000;
      if (!panel.mini || panel.miniS !== MS || t - (panel.miniT || 0) > 0.5) { panel.mini = Bay.chart(P.pos.x, P.pos.z, span, MS, panel.mini && panel.miniS === MS ? panel.mini : undefined); panel.miniS = MS; panel.miniT = t; panel.miniC = [P.pos.x, P.pos.z]; }
      const [mcx, mcz] = panel.miniC;
      for (let j = 0; j < MS; j++) for (let i = 0; i < MS; i++) pDot(mx + i, my + j, panel.mini[j * MS + i] * 0.85);
      for (let i = -1; i <= MS; i++) { pDot(mx + i, my - 1, 60); pDot(mx + i, my + MS, 60); pDot(mx - 1, my + i, 60); pDot(mx + MS, my + i, 60); }
      const g = story.goal; if (g) { const [gx, gy] = Bay.toChart(g[0], g[1], mcx, mcz, span, MS); pText('◆', THREE.MathUtils.clamp(gx, 2, MS - 2) + mx, THREE.MathUtils.clamp(gy, 2, MS - 4) + my - 2, 255, 'center', 1, true); }
      const [px2, py2] = Bay.toChart(P.pos.x, P.pos.z, mcx, mcz, span, MS), hx = -Math.sin(P.yaw), hz = -Math.cos(P.yaw);
      if (Math.sin(t * 6) > -0.4) { pDot(mx + px2, my + py2, 255); pDot(mx + px2 + 1, my + py2, 255); pDot(mx + px2, my + py2 + 1, 255); pDot(mx + px2 + 1, my + py2 + 1, 255); }
      for (let k = 2; k <= 4; k++) pDot(mx + px2 + 0.5 + hx * k, my + py2 + 0.5 + hz * k, 200);
      const L = Bay.live; if (L.ok) { const kt = (_cur.length() * 1.944).toFixed(1), tide = L.level != null ? (L.level >= 0 ? '+' : '') + L.level.toFixed(1) + 'M' + (L.rising == null ? '' : L.rising ? '▲' : '▼') : '';
        pText('NOAA LIVE', mx + MS, my - 20, 150, 'right', 1, true); pText([tide, L.temp != null ? L.temp.toFixed(0) + '°C' : ''].filter(Boolean).join(' '), mx + MS, my - 14, 190, 'right', 1, true); pText(kt + 'KT', mx + MS, my - 8, 160, 'right', 1, true); } }
    const ob = opa(bl); if (ob > 0.01 && W > 120) pText(bl.textContent, SL, H - 7 - SB, 120 * ob, 'left', 1, true);
    if (document.body.classList.contains('touch')) {
      for (const id of ['tBurst', 'tAct', 'tMap', 'tCreature']) { const el = $(id), r = el.getBoundingClientRect(), bx = toCell(r.left + r.width / 2), by = toCell(r.top + r.height / 2), on = el.classList.contains('on');
        pRing(bx, by, toCell(r.width / 2), on ? 220 : 90); pText({ tBurst: '►►', tAct: '◆', tMap: 'M', tCreature: '⇄' }[id], bx, by - 3, on ? 255 : 200, 'center'); }
      pGain = 1;
      if (touch.id !== null) { const sx = toCell(touch.ox), sy = toCell(touch.oy); pRing(sx, sy, toCell(STICK_R), 70); const kx = sx + toCell(touch.kx || 0), ky = sy + toCell(touch.ky || 0); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) pDot(kx + dx, ky + dy, 200); }
    }
  }
  pGain = 1;
  const os = opa(storyEl) * (1 - opa($('chapter'))) * (1 - oHelp) * (mapOpen || menu ? 0 : 1); if (os > 0.01) {   // story line (hidden while a chapter card is up)
    const ts = settings.bigText && W > 200 ? 2 : 1, b = storyEl.querySelector('b'), label = b ? b.textContent : '', lines = wrap(storyEl.textContent.slice(label.length), Math.floor(Math.min(cols, 64) / ts));
    let y = H - 14 - SB - lines.length * 10 * ts; if (label) pText(label, cx, y - 11, 140 * os, 'center'); for (const l of lines) { pText(l, cx, y, 230 * os, 'center', ts); y += 10 * ts; } }
  const card = $('chapter'), oc = 0; if (oc > 0.01) {   // titles are shown once, with the story at the bottom   // chapter card
    const txt = card.textContent, sc = [...txt].length * 12 <= W - 10 ? 2 : 1; wrap(txt, Math.floor((W - 8) / (6 * sc))).forEach((l, i) => pText(l, cx, Math.round(H * 0.36) + i * 9 * sc, 240 * oc, 'center', sc)); }
  if (oHelp > 0.01) {   // help
    const ks = [...help.querySelectorAll('.keys > *')], keyW = Math.max(...ks.filter((_, i) => i % 2 === 0).map(k => k.textContent.length)) * 6 + 6;
    const keyX = Math.max(4, cx - 80), descX = keyX + keyW, maxD = Math.max(8, Math.floor((W - descX - 3) / 6));
    let rows = 0; for (let i = 1; i < ks.length; i += 2) rows += wrap(ks[i].textContent, maxD).length;
    const big = W > 140 && H > 150, listH = (big ? 24 : 14) + rows * 10 + (ks.length / 2) * 2;   // measure first: centre it when there is room, shrink when there is not
    let y = Math.max(4, Math.round((H - listH - 70) / 2)); pText('HOW TO SWIM', cx, y, 240 * oHelp, 'center', big ? 2 : 1); y += big ? 24 : 14;
    for (let i = 0; i + 1 < ks.length; i += 2) { pText(ks[i].textContent, keyX, y, 230 * oHelp); for (const l of wrap(ks[i + 1].textContent, maxD)) { pText(l, descX, y, 180 * oHelp); y += 10; } y += 2; }
    y += 6; for (const note of help.querySelector('.lore').textContent.split('\n')) { const ls = wrap(note.trim(), cols); if (y + ls.length * 10 > H - 18) break;   // only what fits
      for (const l of ls) { pText(l, cx, y, 150 * oHelp, 'center'); y += 10; } }
    pText(MOBILE ? 'TAP TO CLOSE' : 'H TO CLOSE', cx, y + 6, 110 * oHelp, 'center');
  }
  if (menu && !oHelp && !oMap) {   // paused
    const sc = W > 160 ? 2 : 1, items = menuItems(); let y = Math.round(H * 0.26);
    pText(menu.kind === 'settings' ? 'SETTINGS' : 'PAUSED', cx, y, 240, 'center', sc); y += 7 * sc + 14; menu.rows = [];
    items.forEach((it, i) => { const on = i === menu.sel; pText((on ? '► ' : '  ') + it.label() + (on ? ' ◄' : '  '), cx, y, on ? 255 : 150, 'center'); menu.rows.push([y - 2, y + 8]); y += 12; });
    pText(pad.active ? 'A CHOOSE   ◄ ► CHANGE   B BACK' : 'ENTER OR CLICK TO CHOOSE   ◄ ► CHANGE   ESC BACK', cx, y + 8, 110, 'center');
    panel.tex.needsUpdate = true; return;
  }
  if (oMap) {   // fast travel: the bay as dots
    pText('FAST TRAVEL', cx, 3, 230, 'center');
    const land = W > H * 1.3, S = Math.max(20, land ? Math.min(H - 20, (W >> 1) - 8) : Math.min(W - 12, Math.floor(H * 0.55))), mx = land ? W - S - 6 : (W - S) >> 1, my = 14;
    const tt = TILES.outer, span = tt.xmax - tt.xmin, ccx = (tt.xmin + tt.xmax) / 2, ccz = (tt.zmin + tt.zmax) / 2;
    if (!panel.map || panel.mapS !== S) { panel.map = Bay.chart(ccx, ccz, span, S); panel.mapS = S; }
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) pDot(mx + i, my + j, panel.map[j * S + i]);
    checkpoints.forEach((c, i) => { const [px, py] = mapXY(c.x, c.z, S), v = i === mapSel ? (Math.sin(t * 8) > 0 ? 255 : 120) : 220; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) pDot(mx + px + dx, my + py + dy, v); });
    { const [px, py] = mapXY(P.pos.x, P.pos.z, S); if (Math.sin(t * 5) > -0.3) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) pDot(mx + px + dx, my + py + dy, 255); }
    const lx = land ? 6 : mx, ly = land ? 16 : my + S + 6, maxN = Math.max(1, Math.floor((H - ly - 4) / 10)), first = Math.max(0, Math.min(mapSel - (maxN >> 1), checkpoints.length - maxN)), lc = Math.max(8, Math.floor((land ? mx - 10 : W - lx - 4) / 6) - 2);
    checkpoints.slice(first, first + maxN).forEach((c, k) => { const i = first + k; pText((i === mapSel ? '► ' : '  ') + c.name.slice(0, lc), lx, ly + k * 10, i === mapSel ? 255 : 150); });
  }
  panel.tex.needsUpdate = true;
}
