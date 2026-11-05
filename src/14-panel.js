'use strict';
// ═══════════════════════════════════════════════════════════════════
//  PANEL  —  the display draws its own type: a 5×7 dot font, the compass,
//  the map and every word, lit on the same matrix as the bay.
// ═══════════════════════════════════════════════════════════════════
const FONT = {"✕": "#...#.#.#...#...#.#.#...#..........", "□": "######...##...##...######..........", "△": "..#...#.#..#.#.#...######..........", "○": ".###.#...##...##...#.###...........", "A": ".###.#...##...#######...##...##...#", "B": "####.#...##...#####.#...##...#####.", "C": ".###.#...##....#....#....#...#.###.", "D": "####.#...##...##...##...##...#####.", "E": "######....#....####.#....#....#####", "F": "######....#....####.#....#....#....", "G": ".###.#...##....#.####...##...#.####", "H": "#...##...##...#######...##...##...#", "I": ".###...#....#....#....#....#...###.", "J": "..###...#....#....#....#.#..#..##..", "K": "#...##..#.#.#..##...#.#..#..#.#...#", "L": "#....#....#....#....#....#....#####", "M": "#...###.###.#.##.#.##...##...##...#", "N": "#...##...###..##.#.##..###...##...#", "O": ".###.#...##...##...##...##...#.###.", "P": "####.#...##...#####.#....#....#....", "Q": ".###.#...##...##...##.#.##..#..##.#", "R": "####.#...##...#####.#.#..#..#.#...#", "S": ".#####....#.....###.....#....#####.", "T": "#####..#....#....#....#....#....#..", "U": "#...##...##...##...##...##...#.###.", "V": "#...##...##...##...##...#.#.#...#..", "W": "#...##...##...##.#.##.#.##.#.#.#.#.", "X": "#...##...#.#.#...#...#.#.#...##...#", "Y": "#...##...#.#.#...#....#....#....#..", "Z": "#####....#...#...#...#...#....#####", "0": ".###.#...##..###.#.###..##...#.###.", "1": "..#...##....#....#....#....#...###.", "2": ".###.#...#....#...#...#...#...#####", "3": "#####...#...#.....#.....##...#.###.", "4": "...#...##..#.#.#..#.#####...#....#.", "5": "######....####.....#....##...#.###.", "6": "..##..#...#....####.#...##...#.###.", "7": "#####....#...#...#...#....#....#...", "8": ".###.#...##...#.###.#...##...#.###.", "9": ".###.#...##...#.####....#...#..##..", " ": "...................................", ".": "..........................##...##..", ",": ".....................##....#...#...", "'": "..#....#...#.......................", "-": "................###................", ":": "......##...##........##...##.......", "/": "....#....#...#...#...#...#....#....", "!": "..#....#....#....#....#.........#..", "?": ".###.#...#....#...#...#.........#..", "(": "...#...#...#....#....#.....#.....#.", ")": ".#.....#.....#....#....#...#...#...", "·": ".................#.................", "×": ".....#...#.#.#...#...#.#.#...#.....", "♥": "##.############.###...#............", "◆": "..#...###.#####.###...#............", "◄": "....#...##..###.####..###...##....#", "►": "#....##...###..####.###..##...#....", "▲": ".......#...###.#####...............", "▼": ".....#####.###...#.................", "←": ".......#...#...#####.#.....#.......", "→": ".......#.....#.#####...#...#.......", "↑": "..#...###.#.#.#..#....#....#....#..", "↓": "..#....#....#....#..#.#.#.###...#..", "⇄": "..#...#...#####.....#####...#...#..", "+": ".......#....#..#####..#....#.......", "=": "..........#####.....#####..........", "\"": ".#.#..#.#..........................", "&": ".##..#..#.#.#...#...#.#.##..#..##.#", ";": "......##...##........##....#...#...", "°": ".##..#..#..##......................", "#": ".#.#..#.#.#####.#.#.#####.#.#..#.#.", "_": "..............................#####", "|": "..#....#....#....#....#....#....#..", "@": ".###.#...##.###.#.##.###....#.###.."};
const FONT3 = {"✕": "#.#.#.#.#......", "□": "####.####......", "△": ".#.#.####......", "○": ".#.#.#.#.......", "A": ".#.#.#####.##.#", "B": "##.#.###.#.###.", "C": ".###..#..#...##", "D": "##.#.##.##.###.", "E": "####..##.#..###", "F": "####..##.#..#..", "G": ".###..#.##.#.##", "H": "#.##.#####.##.#", "I": "###.#..#..#.###", "J": "..#..#..##.#.#.", "K": "#.##.###.#.##.#", "L": "#..#..#..#..###", "M": "#.########.##.#", "N": "##.#.##.##.##.#", "O": ".#.#.##.##.#.#.", "P": "##.#.###.#..#..", "Q": ".#.#.##.###..##", "R": "##.#.###.#.##.#", "S": ".###...#...###.", "T": "###.#..#..#..#.", "U": "#.##.##.##.####", "V": "#.##.##.##.#.#.", "W": "#.##.########.#", "X": "#.##.#.#.#.##.#", "Y": "#.##.#.#..#..#.", "Z": "###..#.#.#..###", "0": "####.##.##.####", "1": ".#.##..#..#.###", "2": "##...#.#.#..###", "3": "##...#.#...###.", "4": "#.##.####..#..#", "5": "####..##...###.", "6": ".###..####.####", "7": "###..#.#..#..#.", "8": "####.#####.####", "9": "####.####..###.", " ": "...............", ".": ".............#.", "·": ".......#.......", "-": "......###......", "♥": "#.#######.#....", "▼": "...###.#.......", "◆": ".#.###.#.......", "◄": "..#.#####.##..#", "►": "#..##.#####.#..", "▲": "....#.###......", "+": "....#.###.#....", ":": "....#.....#....", "'": ".#..#..........", "/": "..#..#.#.#..#..", "?": "##...#.#.....#.", "(": ".#.#..#..#...#.", ")": ".#...#..#..#.#.", "×": "...#.#.#.#.#...", "⇄": "...###...###...", "!": ".#..#..#.....#.", ",": "..........#.#..", "&": ".#.#.#.#.#.#.##", "←": "....#.###.#....", "→": "....#.###.#....", "↑": ".#.###.#..#..#.", "↓": ".#..#..#.###.#."};
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
let pFail = 0, pFailK = 0;   // and this, so it can lose segments in deep water, like a stereo going under
function pDot(x, y, v) { x |= 0; y |= 0; v *= pGain; if (pFail > 0 && hash2(x * 73 + (y >> 2) * 9, pFailK) < pFail) return; if (x < 0 || y < 0 || x >= panel.w || y >= panel.h || v <= 0) return; const i = (panel.h - 1 - y) * panel.w + x; if (v > panel.data[i]) panel.data[i] = Math.min(255, v); }
function pText(str, x, y, v = 230, align = 'left', scale = 1, small = false) {   // small = the 3×5 readout font
  const F = small ? FONT3 : FONT, gw = small ? 3 : 5, gh = small ? 5 : 7, adv = gw + 1;
  const chars = [...String(str).toUpperCase()], w = chars.length * adv * scale - scale;
  let sx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  for (const ch of chars) { const g = F[ch] || F['?'];
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) if (g[r * gw + c] === '#') for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) pDot(sx + c * scale + dx, y + r * scale + dy, v);
    sx += adv * scale; }
  return w;
}
function pRing(cx, cy, r, v) { const n = Math.max(12, Math.round(r * 6)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pDot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, v); } }
// fades are driven here from the same state the DOM carries (classes and inline opacity), not read back from CSS
const fades = new Map(); let fadeT = performance.now(), fadeDt = 0;
const fadeWaiters = [];   // [element, target, callback]: run once that element's fade has arrived
function whenFaded(el, target, fn) { fadeWaiters.push([el, target, fn]); }
function fadeTarget(el) {
  if (el.classList.contains('panel')) return el.classList.contains('gone') ? 0 : 1;
  if (el.closest('#title')) return $('title').classList.contains('attract') ? 0 : 1;
  if (el === bl) return document.body.classList.contains('settled') ? 0 : 1;
  return el.style.opacity !== '' ? +el.style.opacity : 0;   // story, card, warning and fade start hidden
}
function opa(el) { if (!el) return 0; const tg = fadeTarget(el); let a = fades.has(el) ? fades.get(el) : tg; a += (tg - a) * Math.min(1, fadeDt * 5); if (Math.abs(tg - a) < 0.01) a = tg; fades.set(el, a);
  if (a === tg && fadeWaiters.length) { const done = fadeWaiters.filter(w => w[0] === el && w[1] === tg); if (done.length) { for (const w of done) fadeWaiters.splice(fadeWaiters.indexOf(w), 1); for (const w of done) w[2](); } }
  return a; }
const toCell = px => px * renderer.getPixelRatio() / dotPass.uniforms.uPitch.value;
// ── the panel: every word and mark on screen, drawn as dots. drawPanel decides which screen is up; each part draws itself
//    from `v`, this frame's layout: size, the margins clear of notches, the centre, the time, how many characters fit
function panelLayout() {
  const W = panel.w, H = panel.h;
  return { W, H, ST: Math.round(H * 0.045), SL: 3 + Math.round(W * 0.012), SB: Math.round(H * 0.02), cx: W >> 1, t: WU.uTime.value, cols: Math.max(12, Math.floor((W - 8) / 6)) };
}
function drawPanel() {
  if (!panel.data) return; panel.data.fill(0); { const now = performance.now(); fadeDt = Math.min(0.1, Math.max(1 / 120, (now - fadeT) / 1000)); fadeT = now; }   // always progress, even if the clock stalls
  const v = panelLayout(), oLoad = opa($('load')), oTitle = opa($('title')), oHelp = opa(help), oMap = mapOpen ? 1 : 0, oFade = opa($('fade'));
  dotPass.uniforms.uDim.value = Math.max(oFade, oLoad, oHelp * 0.85, oMap * 0.9, menu ? 0.85 : 0);
  const done = () => { panel.tex.needsUpdate = true; };
  if (oLoad > 0.01) { drawLoading(v, oLoad); return done(); }
  if (portrait()) { drawTurnPhone(v); return done(); }
  if (photo) { drawPhotoHints(v); return done(); }
  if (oTitle > 0.01) drawTitle(v, oTitle);
  wakeHud(v);
  if (document.body.classList.contains('playing') && !mapOpen && !menu && oHelp < 0.05) drawHud(v);   // HUD, inset clear of notches and rounded corners
  pGain = 1; pFail = 0;
  drawStoryLine(v, oHelp);
  if (oHelp > 0.01) drawHelp(v, oHelp);
  if (menu && !oHelp && !oMap) { drawPauseCard(v); return done(); }
  if (oMap) drawFastTravel(v);
  drawDebug(v.W, v.H); done();
}
function drawLoading(v, oLoad) {   // one line of dots filling, and an error if there is one
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const bw = Math.min(40, W - 20), pct = (parseFloat($('bar').style.width) || 0) / 100, by = H >> 1;   // loading: one line of dots, nothing else
  for (let i = 0; i < bw; i++) pDot(cx - bw / 2 + i, by, (i < bw * pct ? 200 : 26) * oLoad);
  if (/ERROR|UNREACHABLE/.test(loadmsg.textContent)) wrap(loadmsg.textContent, cols).forEach((l, i) => pText(l, cx, by + 6 + i * 10, 200 * oLoad, 'center'));
}
function drawTurnPhone(v) {   // held upright: a phone outline turning on its side, and one line. the bay waits.
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  dotPass.uniforms.uDim.value = 0.9;
  const side = Math.floor(t * 0.8) % 2, pw = side ? 26 : 14, ph = side ? 14 : 26, py = (H >> 1) - 24;
  for (let x = 0; x <= pw; x++) { pDot(cx - pw / 2 + x, py - ph / 2, 200); pDot(cx - pw / 2 + x, py + ph / 2, 200); }
  for (let y = 0; y <= ph; y++) { pDot(cx - pw / 2, py - ph / 2 + y, 200); pDot(cx + pw / 2, py - ph / 2 + y, 200); }
  wrap('turn your phone sideways', cols).forEach((l, i) => pText(l, cx, py + 22 + i * 10, 220, 'center'));
}
function drawPhotoHints(v) {   // photo mode: the bay and nothing else, a hint that fades, and SAVED
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  dotPass.uniforms.uDim.value = 0; const hint = Math.max(0, Math.min(1, 4 - photo.t)), saved = Math.max(0, 1.5 - (photo.t - photo.savedT));
  if (hint > 0) pText(photo.spot.toUpperCase(), cx, H - 22, 190 * hint, 'center');
  if (hint > 0) pText(pad.active ? 'STICKS ORBIT · A SAVE · B EXIT' : 'MOUSE ORBIT · WHEEL ZOOM · ENTER SAVE · O EXIT', cx, H - 12, 150 * hint, 'center');
  if (saved > 0) pText('SAVED TO DOWNLOADS', cx, 6, 200 * Math.min(1, saved), 'center');
}
function drawTitle(v, oTitle) {   // the title: under the bubble logo, the prompt, the version
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const ps = [$('titlehint'), $('restart'), $('ver')].filter(el => el && el.style.display !== 'none');   // the title is the logo and one prompt
  let y = Math.round(H * 0.6);
  for (const el of ps) { const o = oTitle * opa(el), small = el.tagName === 'SMALL';
    for (const l of wrap(el.textContent, cols)) { pText(l, cx, y, (small ? 120 : 215) * o, 'center'); y += 10; } y += 5; }
}
function wakeHud(v) {   // quiet water, quiet screen: the HUD dims when nothing needs you and wakes when something does
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  { const urgent = P.bursting || huntHeat > 0 || (P.air ?? 1) < 0.999 || P.hp < 3 || P.lit || opa(warn) > 0.01 || (P.sta ?? 1) < 0.999 || t - (story.beganAt || 0) < 20;
  if (urgent) hudWakeT = t; const quiet = t - hudWakeT; hudGain += ((quiet > 10 ? 0.4 : 1) - hudGain) * Math.min(1, fadeDt * (quiet > 10 ? 0.4 : 4)); }   // quiet water, quiet screen
}
function drawHud(v) {
  const { W, H, t } = v;
  const introK = THREE.MathUtils.smoothstep(t - startedAt, ...TUNE.timing.hudIn);   // the HUD eases in over the first seconds of a swim
  pGain = hudGain * introK;
  setHudFailure(v);
  drawReadouts(v); drawMeters(v); drawDepthGauge(v); drawVitals(v); drawAimMark(v);
  _v.copy(P.pos).project(camera); const px = (_v.x * 0.5 + 0.5) * W, py = (0.5 - _v.y * 0.5) * H, onScreen = _v.z < 1;   // where you are on screen
  drawPulses(v, px, py); drawTurnMarks(v, px, py, onScreen); drawCurrentDashes(v); drawBurstStreaks(v);
  drawCompassTape(v); drawPhotoPrompt(v, introK); drawWarning(v); drawMinimap(v); drawCaptions(v, introK); drawKeyHint(v); drawTouchControls(v);
}
function setHudFailure(v) {   // deep water: the readouts lose dots, and now and then the whole display stutters
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  { const deep = THREE.MathUtils.smoothstep(-P.pos.y, TUNE.fail.from, TUNE.fail.to); pFailK = settings.flicker ? Math.floor(t * 2.5) : 0;   // deep water: the readouts lose dots, and now and then the whole display stutters
    pFail = deep * (0.1 + 0.2 * Math.max(0, Math.sin(t * 0.53) * Math.sin(t * 1.7))); if (settings.flicker && deep > 0.3 && hash2(pFailK, 41) < 0.04 * deep) pFail = 0.6; } lastHudFail = pFail;
}
function drawReadouts(v) {   // the two lines at the top, and SAVED
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  pText(tl.textContent, SL, ST + 2, 230, 'left', 1, true); pText(tr.textContent, W - SL, ST + 2, 180, 'right', 1, true);
  { const age = (performance.now() - lastSaved) / 1000; if (age < 2) pText('SAVED', W - SL, ST + 9, 150 * Math.min(1, 2 - age), 'right', 1, true); }
}
function drawMeters(v) {   // the burst dots and the ability
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const sta = P.sta ?? 1; if (sta < 0.999 || sprinting()) for (let i = 0; i < 8; i++) { const on = i < Math.round(sta * 8); for (let x = 0; x < 3; x++) pDot(SL + i * 4 + x, ST + 9, on ? 220 : 60); }
  { const ready = (P.actReady || 0) <= simTime; pText('E ' + abilityName(), SL, ST + 12, ready ? 170 : 70, 'left', 1, true); }
}
function drawDepthGauge(v) {   // surface at the top, the bottom of the bay below, you between; rise and dive chevrons beside you
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  { const gx = SL, g0 = Math.round(H * 0.34), gh = Math.max(16, Math.round(H * 0.3)), floor = Math.max(1, -floorAt(P.pos.x, P.pos.z)), at = THREE.MathUtils.clamp(-P.pos.y / floor, 0, 1);   /* depth gauge: surface at the top, the bottom of the bay below, you between */
    for (let y = 0; y <= gh; y += 2) pDot(gx, g0 + y, 50); for (let x = -1; x <= 2; x++) { pDot(gx + x, g0 - 1, 150); pDot(gx + x, g0 + gh + 1, 110); }
    const py = g0 + Math.round(at * gh); for (let x = -1; x <= 2; x++) { pDot(gx + x, py, 255); pDot(gx + x, py + 1, 255); }
    const climbIn = P.climbIn || 0, fl = (t * 2.2) % 1;   // rise and dive: chevrons flowing up or down the gauge, beside you
    if (Math.abs(climbIn) > 0.1) for (let k = 0; k < 2; k++) { const up = climbIn > 0, d = 4 + (k + fl) * 5; pText(up ? '▲' : '▼', gx + 8, up ? py - 6 - d : py - 2 + d, 240 * Math.min(1, Math.abs(climbIn) * 1.5) * (1 - 0.7 * (k + fl) / 2), 'center'); } }
}
function drawVitals(v) {   // air, when you need it, and how hard you are hunted
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  if ((P.air ?? 1) < 0.999) { const low = P.air < 0.25; pText('AIR', SL, ST + 19, low ? 150 + 105 * (0.5 + 0.5 * Math.sin(t * 8)) : 170, 'left', 1, true); for (let i = 0; i < 8; i++) { const on = i < Math.ceil(P.air * 8); for (let x = 0; x < 3; x++) pDot(SL + 14 + i * 4 + x, ST + 21, on ? 220 : 60); } }   // lungs
  if (huntHeat > 0) { const n = Math.ceil(huntHeat * 3); pText('HUNTED ' + '◆'.repeat(n) + '·'.repeat(3 - n), SL, ST + ((P.air ?? 1) < 0.999 ? 26 : 19), 150 + 105 * (0.5 + 0.5 * Math.sin(t * 6)), 'left', 1, true); }   // stars: break contact to drain them
}
function drawAimMark(v) {   // where the mouse is steering you: faint, never faded
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  if (mouseSteering() && aim.yaw != null) { _v.copy(fwdOf(aim.yaw, aim.pitch)).multiplyScalar(14).add(P.pos).project(camera);
    if (_v.z < 1) { const ax = (_v.x * 0.5 + 0.5) * W, ay = (0.5 - _v.y * 0.5) * H; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) pDot(ax + dx, ay + dy, 110 / pGain); } }   // where you're steering: faint, never faded
}
function drawPulses(v, px, py) {   // the sense and echo rings, out from you
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  for (let i = pulses.length - 1; i >= 0; i--) { const age = t - pulses[i].t0, life = pulses[i].kind === 'echo' ? 1.8 : 1.4; if (age > life) { pulses.splice(i, 1); continue; }
    const rings = pulses[i].kind === 'echo' ? 3 : 1; for (let k = 0; k < rings; k++) { const a = age - k * 0.18; if (a > 0) pRing(px, py, a / life * W * 0.55, 210 * (1 - a / life)); } }
}
function drawTurnMarks(v, px, py, onScreen) {   // turning: chevrons beside you, drifting the way you turn
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  // each control has its own shape. turning: chevrons beside you, drifting the way you turn
  const flow = (t * 2.2) % 1, turnIn = P.turnIn || 0;
  if (Math.abs(turnIn) > 0.1 && onScreen) { const dir = turnIn > 0 ? -1 : 1, v = 230 * Math.min(1, Math.abs(turnIn) * 1.5);   // + is left
    for (let k = 0; k < 2; k++) { const d = 12 + (k + flow) * 8; pText(dir < 0 ? '◄' : '►', px + dir * d, py - 3, v * (1 - 0.7 * (k + flow) / 2), 'center'); } }
}
function drawCurrentDashes(v) {   // the current: faint dashes drifting one way, like silt in a flow
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  // the current: faint dashes all drifting the same way, slow, like silt in a flow. nothing like the burst's rush out from the middle
  { const c = P.current || 0; if (c > 0.2 && !P.camUp) { _v.copy(P.pos).project(camera); const sx0 = _v.x, sy0 = _v.y; _v.copy(P.pos).addScaledVector(_cur, 4 / Math.max(0.01, _cur.length())).project(camera);
    let dx = (_v.x - sx0) * W, dy = -(_v.y - sy0) * H; const dl = Math.hypot(dx, dy); if (dl > 0.5) { dx /= dl; dy /= dl;
      const v = 120 * THREE.MathUtils.smoothstep(c, 0.2, 1.0), drift = t * (6 + c * 10);
      for (let i = 0; i < 34; i++) { const bx = hash2(i, 11) * W, by = hash2(i, 23) * H, run = (drift + hash2(i, 5) * W) % W, x0 = bx + dx * run, y0 = by + dy * run;
        const wx = ((x0 % W) + W) % W, wy = ((y0 % H) + H) % H; for (let k = 0; k < 3; k++) pDot(wx + dx * k * 1.5, wy + dy * k * 1.5, v * (k + 1) / 3); } } } }
}
function drawBurstStreaks(v) {   // burst: streaks rushing out from the middle of the view
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  // burst: streaks rushing out from the middle of the view, the way speed looks
  if (settings.speedFx && (P.burstMix || 0) > 0.02) for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2 + hash2(i, 7) * 0.15, u = (t * 1.8 + hash2(i, 3)) % 1, r = 0.38 + u * 0.62, ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < 7; k++) { const rr = r + k * 0.022; pDot(cx + ca * rr * W * 0.5, (H >> 1) + sa * rr * H * 0.5, 240 * P.burstMix * (0.35 + 0.65 * u) * (k + 2) / 8); } }
}
function drawCompassTape(v) {   // the compass tape, its lubber line, and the goal on it
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const hdg = headingDeg(), half = Math.max(24, Math.floor(W * 0.17)), ppd = half / 60;   // compass
  for (const [deg, name] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W'], [45, '·'], [135, '·'], [225, '·'], [315, '·']]) { const rel = ((deg - hdg + 540) % 360) - 180; if (Math.abs(rel) <= 60) pText(name, cx + Math.round(rel * ppd), ST + 9, name === '·' ? 110 : 190, 'center', 1, true); }
  for (let y = ST + 7; y <= ST + 15; y += 8) { pDot(cx, y, 255); pDot(cx, y + 1, 255); }   // the lubber line above and below the cardinals
  const goal = compassMarks.find(l => l.goal);
  if (goal) { const raw = ((goal.bearing - hdg + 540) % 360) - 180, off = Math.abs(raw) > 52, gx = cx + Math.round(THREE.MathUtils.clamp(raw, -52, 52) * ppd);
    const label = goal.dist > 999 ? (goal.dist / 1000).toFixed(1) + 'KM' : Math.round(goal.dist / 10) * 10 + 'M';
    pText(off ? (raw > 0 ? '►' : '◄') : '◆', gx, ST + 1, 255, 'center', 1, true); pText(label, gx + (raw > 0 ? -4 : 4), ST + 1, 190, raw > 0 ? 'right' : 'left', 1, true); }
}
function drawPhotoPrompt(v, introK) {   // a moment worth keeping
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  { const spot = photoSpot(); if (spot) { pGain = 1; pText(`◆ ${pad.active ? 'R3' : 'O'} PHOTO`, W - SL, ST + 9 + ((performance.now() - lastSaved) / 1000 < 2 ? 7 : 0), 130 + 40 * Math.sin(t * 2), 'right', 1, true); pGain = hudGain * introK; } }   /* a moment worth keeping */
}
function drawWarning(v) {   // DIVE, or what is hunting you
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const ow = opa(warn), failW = pFail; pFail = 0; if (ow > 0.01 && warn.textContent) pText(warn.textContent, cx, ST + 20, 255 * ow * (0.65 + 0.35 * Math.sin(t * 8)), 'center'); pFail = failW;
}
function drawMinimap(v) {   // the chart in the corner, and the live NOAA readings over it
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  { const MS = Math.max(22, Math.min(46, Math.floor(H * 0.2))), mx = W - MS - SL, my = H - MS - SB, span = 3000;
    if (!panel.mini || panel.miniS !== MS || t - (panel.miniT || 0) > 0.5) { panel.mini = Bay.chart(P.pos.x, P.pos.z, span, MS, panel.mini && panel.miniS === MS ? panel.mini : undefined); panel.miniS = MS; panel.miniT = t; panel.miniC = [P.pos.x, P.pos.z]; }
    const [mcx, mcz] = panel.miniC;
    for (let j = 0; j < MS; j++) for (let i = 0; i < MS; i++) pDot(mx + i, my + j, panel.mini[j * MS + i] * 0.85);
    for (let i = -1; i <= MS; i++) { pDot(mx + i, my - 1, 60); pDot(mx + i, my + MS, 60); pDot(mx - 1, my + i, 60); pDot(mx + MS, my + i, 60); }
    const g = story.goal; if (g) { const [gx, gy] = Bay.toChart(g[0], g[1], mcx, mcz, span, MS); pText('◆', THREE.MathUtils.clamp(gx, 2, MS - 2) + mx, THREE.MathUtils.clamp(gy, 2, MS - 4) + my - 2, 255, 'center', 1, true); }
    const [px2, py2] = Bay.toChart(P.pos.x, P.pos.z, mcx, mcz, span, MS), hx = -Math.sin(P.yaw), hz = -Math.cos(P.yaw);
    if (Math.sin(t * 6) > -0.4) { pDot(mx + px2, my + py2, 255); pDot(mx + px2 + 1, my + py2, 255); pDot(mx + px2, my + py2 + 1, 255); pDot(mx + px2 + 1, my + py2 + 1, 255); }
    for (let k = 2; k <= 4; k++) pDot(mx + px2 + 0.5 + hx * k, my + py2 + 0.5 + hz * k, 200);
    const L = Bay.live; if (L.ok) { const kt = ((P.current || 0) * 1.944).toFixed(1), tide = L.level != null ? (L.level >= 0 ? '+' : '') + L.level.toFixed(1) + 'M' + (L.rising == null ? '' : L.rising ? '▲' : '▼') : '';
      pText('NOAA LIVE', mx + MS, my - 20, 150, 'right', 1, true); pText([tide, L.temp != null ? L.temp.toFixed(0) + '°C' : ''].filter(Boolean).join(' '), mx + MS, my - 14, 190, 'right', 1, true); pText(kt + 'KT', mx + MS, my - 8, 160, 'right', 1, true); } }
}
function drawCaptions(v, introK) {   // what you would hear, shown on the side it came from
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  pFail = 0; if (captions.size) { pGain = 1; const nowMs = performance.now(), sides = { l: 0, r: 0, c: 0 };   /* what you'd hear, shown on the side it came from */
    const shown = new Set(); for (const [k, c] of captions) { const left = c.until - nowMs; if (left <= 0) { captions.delete(k); continue; } const side = panAt(c.x, c.z), s = side < -0.3 ? 'l' : side > 0.3 ? 'r' : 'c', v = 170 * Math.min(1, left / 400); if (shown.has(s + c.text)) continue; shown.add(s + c.text);   /* one line per sound per side, however many boats */
      if (s === 'l') pText('◄ ' + c.text, SL, Math.round(H * 0.42) + 10 * sides.l++, v, 'left', 1, true); else if (s === 'r') pText(c.text + ' ►', W - SL, Math.round(H * 0.42) + 10 * sides.r++, v, 'right', 1, true); else pText(c.text, cx, ST + 30 + 8 * sides.c++, v, 'center', 1, true); }
    pGain = hudGain * introK; }
}
function drawKeyHint(v) {   // the key hints along the bottom, until they settle away
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const ob = opa(bl); if (ob > 0.01 && W > 120) pText(bl.textContent, SL, H - 7 - SB, 120 * ob, 'left', 1, true);
}
function drawTouchControls(v) {   // the round buttons and the drag stick, as dots
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  if (document.body.classList.contains('touch')) {
    for (const id of ['tBurst', 'tAct', 'tMap', 'tCreature', 'tPause']) { const el = $(id), r = el.getBoundingClientRect(), bx = toCell(r.left + r.width / 2), by = toCell(r.top + r.height / 2), on = el.classList.contains('on');
      pRing(bx, by, toCell(r.width / 2), on ? 220 : 90); pText({ tBurst: '►►', tAct: '◆', tMap: 'M', tCreature: '⇄', tPause: 'II' }[id], bx, by - 3, on ? 255 : 200, 'center'); }
    pGain = 1;
    if (touch.id !== null) { const sx = toCell(touch.ox), sy = toCell(touch.oy); pRing(sx, sy, toCell(STICK_R), 70); const kx = sx + toCell(touch.kx || 0), ky = sy + toCell(touch.ky || 0); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) pDot(kx + dx, ky + dy, 200); }
  }
}
function drawStoryLine(v, oHelp) {   // the story line at the bottom (hidden while a chapter card is up)
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const os = opa(storyEl) * (1 - opa($('chapter'))) * (1 - oHelp) * (mapOpen || menu ? 0 : 1); if (os > 0.01) {   // story line (hidden while a chapter card is up)
  const ts = settings.bigText && W > 200 ? 2 : 1, b = storyEl.querySelector('b'), label = b ? b.textContent : '', lines = wrap(storyEl.textContent.slice(label.length), Math.floor(Math.min(cols, 64) / ts));
  let y = H - 14 - SB - lines.length * 10 * ts; if (label) pText(label, cx, y - 11, 140 * os, 'center'); for (const l of lines) { pText(l, cx, y, 230 * os, 'center', ts); y += 10 * ts; } }
}
function drawHelp(v, oHelp) {   // how to swim: measured first, centred when there is room, shrunk when there is not
  const { W, H, ST, SL, SB, cx, t, cols } = v;
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
function drawPauseCard(v) {   // paused: a small framed card, left-aligned, the bay almost gone behind it
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  dotPass.uniforms.uDim.value = 0.96;
  const items = menuItems(), labels = items.map(it => it.label()), TITLE = { settings: 'SETTINGS', comfort: 'COMFORT', controls: 'CONTROLS', feedback: 'SEND FEEDBACK', journal: 'JOURNAL', confirm: 'START OVER?', note: (menu.note || '').toUpperCase() }[menu.kind] || 'PAUSED';
  const note = menu.kind === 'note' ? wrap(LORE[menu.note] || '', Math.min(cols - 4, 46)) : menu.kind === 'confirm' ? ['your progress here will be wiped.'] : menu.kind === 'feedback' ? feedbackLines(Math.min(cols - 4, 46)) : [];
  const chars = Math.max(TITLE.length, ...labels.map(l => [...l].length + 2), ...note.map(l => l.length)), bw = Math.min(W - 6, chars * 6 + 15), bx = (W - bw) >> 1, ix = bx + 8;
  const fit = Math.max(3, Math.floor((H - 46 - note.length * 9) / 10)), shown = Math.min(fit, items.length), first = Math.max(0, Math.min(menu.sel - (fit >> 1), items.length - fit));   /* long lists scroll with the selection */
  const bh = 22 + (note.length ? note.length * 9 + 5 : 0) + shown * 10 + 3, by = Math.max(2, (H - bh - 10) >> 1);
  for (let x = bx; x <= bx + bw; x += 2) { pDot(x, by, 70); pDot(x, by + bh, 70); } for (let y = by; y <= by + bh; y += 2) { pDot(bx, y, 70); pDot(bx + bw, y, 70); }   // the frame
  let y = by + 6; pText(TITLE, ix, y, 240); y += 10; for (let x = ix; x < bx + bw - 7; x += 2) pDot(x, y, 90); y += 6;
  for (const l of note) { pText(l, ix, y, 185); y += 9; } if (note.length) y += 5;
  menu.rows = [];
  items.forEach((it, i) => { if (i < first || i >= first + fit) { menu.rows.push([-99, -99]); return; } const on = i === menu.sel; pText((on ? '► ' : '  ') + labels[i], ix, y, on ? 255 : 165); menu.rows.push([y - 2, y + 8]); y += 10; });
  if (first > 0) pText('▲', bx + bw - 6, by + 18, 120, 'center', 1, true); if (first + fit < items.length) pText('▼', bx + bw - 6, by + bh - 7, 120, 'center', 1, true);
  pText(menu.kind === 'feedback' ? (MOBILE ? 'TYPE, THEN TAP SEND' : 'ENTER SEND  SHIFT+ENTER NEW LINE  ESC BACK') : menu.binding ? 'PRESS THE NEW KEY  ESC KEEP IT' : pad.active ? 'A CHOOSE  ◄► CHANGE  B BACK' : 'ENTER CHOOSE  ◄► CHANGE  ESC BACK', cx, by + bh + 5, 105, 'center', 1, true);
}
function drawFastTravel(v) {   // fast travel: the bay as dots, the places you have found
  const { W, H, ST, SL, SB, cx, t, cols } = v;
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
