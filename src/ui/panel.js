import * as THREE from 'three';
import { hash2 } from '../lib/rng.js?v=__BUILD__';
import { wrap } from '../lib/text.js?v=__BUILD__';
import { knots, mph } from '../lib/units.js?v=__BUILD__';
import { MOBILE } from '../core/env.js?v=__BUILD__';
import { portrait } from '../core/screen.js?v=__BUILD__';
import { settings } from '../core/settings.js?v=__BUILD__';
import { fwdOf } from '../core/space.js?v=__BUILD__';
import { TUNE } from '../core/tune.js?v=__BUILD__';
import { camera, dotPass, renderer, whenResized } from '../render/display.js?v=__BUILD__';
import { WU } from '../render/materials.js?v=__BUILD__';
import { ENV, weatherLine } from '../world/conditions.js?v=__BUILD__';
import { Bay, TILES, floorAt, loadmsg } from '../world/geo.js?v=__BUILD__';
import { clockText, day } from '../world/time.js?v=__BUILD__';
import { P, abilityName, pulses } from '../actors/player.js?v=__BUILD__';
import { huntHeat } from '../actors/wildlife.js?v=__BUILD__';
import { captions, sideOf } from '../systems/audio.js?v=__BUILD__';
import { aim, kn, menu, menuItems, mouseSteering, pad, photo, photoSpot } from '../systems/input.js?v=__BUILD__';
import { lastSaved } from '../systems/save.js?v=__BUILD__';
import { startedAt, story } from '../systems/story.js?v=__BUILD__';
import { feedbackLines } from './feedback.js?v=__BUILD__';
import { $, LORE, bl, checkpoints, compassMarks, headingDeg, help, mapOpen, mapSel, mapXY, readouts, storyEl, warn } from './hud.js?v=__BUILD__';
import { STICK_R, touch } from './touch.js?v=__BUILD__';
import { _cur, _v, simTime } from '../app/frame.js?v=__BUILD__';
import { specimen } from '../app/specimens.js?v=__BUILD__';
import { drawDebug } from '../app/testing.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  PANEL  —  the display draws its own type: a 5×7 dot font, the compass,
//  the map and every word, lit on the same matrix as the bay.
// ═══════════════════════════════════════════════════════════════════
export const FONT = {"✕": "#...#.#.#...#...#.#.#...#..........", "□": "######...##...##...######..........", "△": "..#...#.#..#.#.#...######..........", "○": ".###.#...##...##...#.###...........", "A": ".###.#...##...#######...##...##...#", "B": "####.#...##...#####.#...##...#####.", "C": ".###.#...##....#....#....#...#.###.", "D": "####.#...##...##...##...##...#####.", "E": "######....#....####.#....#....#####", "F": "######....#....####.#....#....#....", "G": ".###.#...##....#.####...##...#.####", "H": "#...##...##...#######...##...##...#", "I": ".###...#....#....#....#....#...###.", "J": "..###...#....#....#....#.#..#..##..", "K": "#...##..#.#.#..##...#.#..#..#.#...#", "L": "#....#....#....#....#....#....#####", "M": "#...###.###.#.##.#.##...##...##...#", "N": "#...##...###..##.#.##..###...##...#", "O": ".###.#...##...##...##...##...#.###.", "P": "####.#...##...#####.#....#....#....", "Q": ".###.#...##...##...##.#.##..#..##.#", "R": "####.#...##...#####.#.#..#..#.#...#", "S": ".#####....#.....###.....#....#####.", "T": "#####..#....#....#....#....#....#..", "U": "#...##...##...##...##...##...#.###.", "V": "#...##...##...##...##...#.#.#...#..", "W": "#...##...##...##.#.##.#.##.#.#.#.#.", "X": "#...##...#.#.#...#...#.#.#...##...#", "Y": "#...##...#.#.#...#....#....#....#..", "Z": "#####....#...#...#...#...#....#####", "0": ".###.#...##..###.#.###..##...#.###.", "1": "..#...##....#....#....#....#...###.", "2": ".###.#...#....#...#...#...#...#####", "3": "#####...#...#.....#.....##...#.###.", "4": "...#...##..#.#.#..#.#####...#....#.", "5": "######....####.....#....##...#.###.", "6": "..##..#...#....####.#...##...#.###.", "7": "#####....#...#...#...#....#....#...", "8": ".###.#...##...#.###.#...##...#.###.", "9": ".###.#...##...#.####....#...#..##..", " ": "...................................", ".": "..........................##...##..", ",": ".....................##....#...#...", "'": "..#....#...#.......................", "-": "................###................", ":": "......##...##........##...##.......", "/": "....#....#...#...#...#...#....#....", "!": "..#....#....#....#....#.........#..", "?": ".###.#...#....#...#...#.........#..", "(": "...#...#...#....#....#.....#.....#.", ")": ".#.....#.....#....#....#...#...#...", "·": ".................#.................", "×": ".....#...#.#.#...#...#.#.#...#.....", "♥": "##.############.###...#............", "◆": "..#...###.#####.###...#............", "◄": "....#...##..###.####..###...##....#", "►": "#....##...###..####.###..##...#....", "▲": ".......#...###.#####...............", "▼": ".....#####.###...#.................", "←": ".......#...#...#####.#.....#.......", "→": ".......#.....#.#####...#...#.......", "↑": "..#...###.#.#.#..#....#....#....#..", "↓": "..#....#....#....#..#.#.#.###...#..", "⇄": "..#...#...#####.....#####...#...#..", "+": ".......#....#..#####..#....#.......", "=": "..........#####.....#####..........", "\"": ".#.#..#.#..........................", "&": ".##..#..#.#.#...#...#.#.##..#..##.#", ";": "......##...##........##....#...#...", "°": ".##..#..#..##......................", "#": ".#.#..#.#.#####.#.#.#####.#.#..#.#.", "_": "..............................#####", "|": "..#....#....#....#....#....#....#..", "@": ".###.#...##.###.#.##.###....#.###.."};
export const FONT3 = {"✕": "#.#.#.#.#......", "□": "####.####......", "△": ".#.#.####......", "○": ".#.#.#.#.......", "A": ".#.#.#####.##.#", "B": "##.#.###.#.###.", "C": ".###..#..#...##", "D": "##.#.##.##.###.", "E": "####..##.#..###", "F": "####..##.#..#..", "G": ".###..#.##.#.##", "H": "#.##.#####.##.#", "I": "###.#..#..#.###", "J": "..#..#..##.#.#.", "K": "#.##.###.#.##.#", "L": "#..#..#..#..###", "M": "#.########.##.#", "N": "##.#.##.##.##.#", "O": ".#.#.##.##.#.#.", "P": "##.#.###.#..#..", "Q": ".#.#.##.###..##", "R": "##.#.###.#.##.#", "S": ".###...#...###.", "T": "###.#..#..#..#.", "U": "#.##.##.##.####", "V": "#.##.##.##.#.#.", "W": "#.##.########.#", "X": "#.##.#.#.#.##.#", "Y": "#.##.#.#..#..#.", "Z": "###..#.#.#..###", "0": "####.##.##.####", "1": ".#.##..#..#.###", "2": "##...#.#.#..###", "3": "##...#.#...###.", "4": "#.##.####..#..#", "5": "####..##...###.", "6": ".###..####.####", "7": "###..#.#..#..#.", "8": "####.#####.####", "9": "####.####..###.", " ": "...............", ".": ".............#.", "·": ".......#.......", "-": "......###......", "♥": "#.#######.#....", "▼": "...###.#.......", "◆": ".#.###.#.......", "◄": "..#.#####.##..#", "►": "#..##.#####.#..", "▲": "....#.###......", "+": "....#.###.#....", ":": "....#.....#....", "'": ".#..#..........", "/": "..#..#.#.#..#..", "?": "##...#.#.....#.", "(": ".#.#..#..#...#.", ")": ".#...#..#..#.#.", "×": "...#.#.#.#.#...", "⇄": "...###...###...", "!": ".#..#..#.....#.", ",": "..........#.#..", "&": ".#.#.#.#.#.#.##", "←": "....#.###.#....", "→": "....#.###.#....", "↑": ".#.###.#..#..#.", "↓": ".#..#..#.###.#."};
export const panel = { w: 0, h: 0, data: null, tex: null, map: null, mapS: 0 };
export function panelResize(w, h) {
  if (panel.w === w && panel.h === h) return;
  if (panel.tex) panel.tex.dispose();
  panel.w = w; panel.h = h; panel.data = new Uint8Array(w * h);
  panel.tex = new THREE.DataTexture(panel.data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  panel.tex.minFilter = panel.tex.magFilter = THREE.NearestFilter; panel.tex.unpackAlignment = 1; panel.tex.needsUpdate = true;
  dotPass.uniforms.tText.value = panel.tex; panel.map = null;
}
whenResized(panelResize);   // the panel's dots are the display's grid
export let lastHudFail = 0;   // the HUD's segment failure on the last frame
// the type: one small face for readouts, the big one for what the bay says; and these levels of light, so the eye reads values first
export const INK = { value: 230, label: 120, lost: 55, ghost: 0.1 };   // ghost: an unlit segment, faintly there, as on the real glass
// ── the quiet HUD: each part comes up when it has something to tell you and goes back down TUNE.hud.linger seconds later,
//    so calm water is just the bay. HUD ALWAYS ON (settings) keeps every part up
export const hudParts = Object.fromEntries(['hearts', 'motion', 'ability', 'nav', 'place', 'depth', 'chart'].map(n => [n, { k: 0, at: -1e9 }]));
const hudSeen = {}; let hudT = 0;
export const wakePart = n => { hudParts[n].at = WU.uTime.value; };
export const nudgeHud = () => { wakePart('place'); wakePart('chart'); };   // a place found: say where it is
const changed = (key, val) => { const was = hudSeen[key]; hudSeen[key] = val; return was !== undefined && was !== val; };
export function part(n, draw) { const g = pGain; pGain = g * hudParts[n].k; if (pGain > 0.01) draw(); pGain = g; }   // draw one part at its own presence
// the stereo's own digits: seven segments, 4×7 cells each, the unlit ones faintly there. returns the width drawn
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
export function pSeg(str, x, y, v) {
  let at = x;
  for (const ch of String(str)) {
    if (ch === '.') { pDot(at, y + 6, v); at += 2; continue; }
    const on = SEG[ch] || '', lit = s => on.includes(s) ? v : v * INK.ghost;
    for (let i = 0; i < 4; i++) { pDot(at + i, y, lit('a')); pDot(at + i, y + 3, lit('g')); pDot(at + i, y + 6, lit('d')); }
    for (let j = 1; j < 3; j++) { pDot(at, y + j, lit('f')); pDot(at + 3, y + j, lit('b')); pDot(at, y + 3 + j, lit('e')); pDot(at + 3, y + 3 + j, lit('c')); }
    at += 6;
  }
  return at - x;
}
export let pGain = 1;   // the HUD draws through this so it can fade when the water is quiet
export let pFail = 0, pFailK = 0;   // and this, so it can lose segments in deep water, like a stereo going under
export function pDot(x, y, v) { x |= 0; y |= 0; v *= pGain; if (pFail > 0 && hash2(x * 73 + (y >> 2) * 9, pFailK) < pFail) return; if (x < 0 || y < 0 || x >= panel.w || y >= panel.h || v <= 0) return; const i = (panel.h - 1 - y) * panel.w + x; if (v > panel.data[i]) panel.data[i] = Math.min(255, v); }
export function pText(str, x, y, v = 230, align = 'left', scale = 1, small = false) {   // small = the 3×5 readout font
  const F = small ? FONT3 : FONT, gw = small ? 3 : 5, gh = small ? 5 : 7, adv = gw + 1;
  const chars = [...String(str).toUpperCase()], w = chars.length * adv * scale - scale;
  let sx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  for (const ch of chars) { const g = F[ch] || F['?'];
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) if (g[r * gw + c] === '#') for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) pDot(sx + c * scale + dx, y + r * scale + dy, v);
    sx += adv * scale; }
  return w;
}
export function pRing(cx, cy, r, v) { const n = Math.max(12, Math.round(r * 6)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pDot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, v); } }
// fades are driven here from the same state the DOM carries (classes and inline opacity), not read back from CSS
export const fades = new Map();
export let fadeT = performance.now(), fadeDt = 0;
export const fadeWaiters = [];   // [element, target, callback]: run once that element's fade has arrived
export function whenFaded(el, target, fn) { fadeWaiters.push([el, target, fn]); }
export function fadeTarget(el) {
  if (el.classList.contains('panel')) return el.classList.contains('gone') ? 0 : 1;
  if (el.closest('#title')) return $('title').classList.contains('attract') ? 0 : 1;
  if (el === bl) return document.body.classList.contains('settled') ? 0 : 1;
  return el.style.opacity !== '' ? +el.style.opacity : 0;   // story, card, warning and fade start hidden
}
export function opa(el) { if (!el) return 0; const tg = fadeTarget(el); let a = fades.has(el) ? fades.get(el) : tg; a += (tg - a) * Math.min(1, fadeDt * 5); if (Math.abs(tg - a) < 0.01) a = tg; fades.set(el, a);
  if (a === tg && fadeWaiters.length) { const done = fadeWaiters.filter(w => w[0] === el && w[1] === tg); if (done.length) { for (const w of done) fadeWaiters.splice(fadeWaiters.indexOf(w), 1); for (const w of done) w[2](); } }
  return a; }
export const toCell = px => px * renderer.getPixelRatio() / dotPass.uniforms.uPitch.value;
// ── the panel: every word and mark on screen, drawn as dots. drawPanel decides which screen is up; each part draws itself
//    from `v`, this frame's layout: size, the margins clear of notches, the centre, the time, how many characters fit
export function panelLayout() {
  const W = panel.w, H = panel.h;
  return { W, H, ST: Math.round(H * 0.045), SL: 3 + Math.round(W * 0.012), SB: Math.round(H * 0.02), cx: W >> 1, t: WU.uTime.value, cols: Math.max(12, Math.floor((W - 8) / 6)) };
}
export function drawPanel() {
  if (!panel.data) return; panel.data.fill(0); { const now = performance.now(); fadeDt = Math.min(0.1, Math.max(1 / 120, (now - fadeT) / 1000)); fadeT = now; }   // always progress, even if the clock stalls
  const v = panelLayout(), oLoad = opa($('load')), oTitle = opa($('title')), oHelp = opa(help), oMap = mapOpen ? 1 : 0, oFade = opa($('fade'));
  dotPass.uniforms.uDim.value = Math.max(oFade, oLoad, oHelp * 0.85, oMap * 0.9, menu ? 0.85 : 0);
  const done = () => { panel.tex.needsUpdate = true; };
  if (oLoad > 0.01) { drawLoading(v, oLoad); return done(); }
  if (portrait()) { drawTurnPhone(v); return done(); }
  if (specimen.on) return done();   // the model page labels itself, in type you can read
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
export function drawLoading(v, oLoad) {   // one line of dots filling, and an error if there is one
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const bw = Math.min(40, W - 20), pct = (parseFloat($('bar').style.width) || 0) / 100, by = H >> 1;   // loading: one line of dots, nothing else
  for (let i = 0; i < bw; i++) pDot(cx - bw / 2 + i, by, (i < bw * pct ? 200 : 26) * oLoad);
  if (/ERROR|UNREACHABLE/.test(loadmsg.textContent)) wrap(loadmsg.textContent, cols).forEach((l, i) => pText(l, cx, by + 6 + i * 10, 200 * oLoad, 'center'));
}
export function drawTurnPhone(v) {   // held upright: a phone outline turning on its side, and one line. the bay waits.
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  dotPass.uniforms.uDim.value = 0.9;
  const side = Math.floor(t * 0.8) % 2, pw = side ? 26 : 14, ph = side ? 14 : 26, py = (H >> 1) - 24;
  for (let x = 0; x <= pw; x++) { pDot(cx - pw / 2 + x, py - ph / 2, 200); pDot(cx - pw / 2 + x, py + ph / 2, 200); }
  for (let y = 0; y <= ph; y++) { pDot(cx - pw / 2, py - ph / 2 + y, 200); pDot(cx + pw / 2, py - ph / 2 + y, 200); }
  wrap('turn your phone sideways', cols).forEach((l, i) => pText(l, cx, py + 22 + i * 10, 220, 'center'));
}
export function drawPhotoHints(v) {   // photo mode: the bay and a small stamp, as the stereo would print it. the keys fade away, and are never in the picture
  const { W, H, SL, SB, cx } = v, since = photo.t - photo.savedT, hint = Math.max(0, Math.min(1, TUNE.photo.hint - photo.t));
  dotPass.uniforms.uDim.value = settings.flash ? Math.max(0, 1 - since / TUNE.photo.shutter) : 0;   // the shutter
  pText(photo.spot || '', SL, H - 7 - SB, 170, 'left', 1, true); pText(`${Math.max(0, -P.pos.y).toFixed(1)}M  ${clockText(day.hour)}`, W - SL, H - 7 - SB, 170, 'right', 1, true);
  if (photo.shot) return;
  if (hint > 0) pText(pad.active ? 'STICKS MOVE · RT ZOOM · A SAVE · B EXIT' : 'MOUSE ORBIT · WHEEL ZOOM · WASD MOVE · Q E LENS · ENTER SAVE · ESC EXIT', cx, H - 18 - SB, 140 * hint, 'center', 1, true);
  if (since < 1.5) pText('SAVED TO DOWNLOADS', cx, 6, 200 * Math.min(1, 1.5 - since), 'center');
}
export function drawTitle(v, oTitle) {   // the title: under the bubble logo, the prompt, the version
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const ps = [$('titlehint'), $('restart'), $('ver')].filter(el => el && el.style.display !== 'none');   // the title is the logo and one prompt
  let y = Math.round(H * 0.6);
  for (const el of ps) { const o = oTitle * opa(el), small = el.tagName === 'SMALL';
    for (const l of wrap(el.textContent, cols)) { pText(l, cx, y, (small ? 120 : 215) * o, 'center'); y += 10; } y += 5; }
}
export function wakeHud(v) {   // what each part of the HUD has to tell you this frame, and how far up it is
  const { t } = v, dt = Math.min(0.25, Math.max(0, t - hudT)), H = TUNE.hud; hudT = t;
  const ready = (P.actReady || 0) <= simTime, began = t - (story.beganAt || 0) < H.chapterShow, danger = huntHeat > 0 || opa(warn) > 0.01;
  const goal = compassMarks.find(l => l.goal), off = goal ? Math.abs(((goal.bearing - headingDeg() + 540) % 360) - 180) : 0;
  const now = {
    hearts: P.hp < 3 || danger || began || changed('hp', P.hp) || changed('fed', P.fed || 0),
    motion: began || P.bursting || (P.sta ?? 1) < 0.999 || changed('speed', Math.round(P.speed / H.speedStep)),
    ability: !ready || changed('ready', ready),
    nav: Math.abs(P.turnIn || 0) > 0.1 || (!!goal && (off > H.offGoal || began || changed('goal', story.goal.join()))),   // straight at the goal, its beam is enough
    place: began || changed('place', readouts.place),
    depth: Math.abs(P.climbIn || 0) > 0.1 || Math.abs(P.vel.y) > H.sinking || -P.pos.y > TUNE.fail.from || P.pos.y - floorAt(P.pos.x, P.pos.z) < H.nearFloor,
    chart: !!goal && goal.dist > H.farGoal && (off > H.offGoal || began),
  };
  for (const n in hudParts) { const p = hudParts[n]; if (now[n]) p.at = t; const want = settings.hudFull || t - p.at < H.linger ? 1 : 0;
    p.k += (want - p.k) * Math.min(1, dt * (want > p.k ? H.rise : H.fall)); if (Math.abs(want - p.k) < 0.01) p.k = want; }
}
export function drawHud(v) {
  const { W, H, t } = v;
  const introK = THREE.MathUtils.smoothstep(t - startedAt, ...TUNE.timing.hudIn);   // the HUD eases in over the first seconds of a swim
  pGain = introK;
  setHudFailure(v);
  // laid out by what each thing is about, so the eye learns where to look: you (top left), where you are going (top middle),
  // how deep (left edge), the water around you (the chart, in a bottom corner), what you hear and are told (bottom middle)
  drawYou(v); part('depth', () => drawDepthGauge(v)); drawSystem(v); drawAimMark(v);
  _v.copy(P.pos).project(camera); const px = (_v.x * 0.5 + 0.5) * W, py = (0.5 - _v.y * 0.5) * H, onScreen = _v.z < 1;   // where you are on screen
  drawPulses(v, px, py); drawTurnMarks(v, px, py, onScreen); drawCurrentDashes(v); drawBurstStreaks(v);
  part('nav', () => drawCompassTape(v)); part('place', () => drawPlace(v)); drawPhotoPrompt(v, introK); drawWarning(v); part('chart', () => drawChart(v)); drawCaptions(v, introK); drawKeyHint(v); drawTouchControls(v);
}
export function setHudFailure(v) {   // deep water: the readouts lose dots, and now and then the whole display stutters
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  { const deep = THREE.MathUtils.smoothstep(-P.pos.y, TUNE.fail.from, TUNE.fail.to); pFailK = settings.flicker ? Math.floor(t * 2.5) : 0;   // deep water: the readouts lose dots, and now and then the whole display stutters
    pFail = deep * (0.1 + 0.2 * Math.max(0, Math.sin(t * 0.53) * Math.sin(t * 1.7))); if (settings.flicker && deep > 0.3 && hash2(pFailK, 41) < 0.04 * deep) pFail = 0.6; } lastHudFail = pFail;
}
export function drawSystem(v) {   // top right: what the game did for you (SAVED)
  const { W, ST, SL } = v;
  const age = (performance.now() - lastSaved) / 1000; if (age < 2) pText('SAVED', W - SL, ST + 2, 150 * Math.min(1, 2 - age), 'right', 1, true);
}
// top left, you: your hearts; how you are moving (speed, and the burst you have left); your ability, on its own key.
// then the tide on you, air and the hunt, only when they matter. labels dim, values bright, and every row keeps its place whether or not the others show
export const YOU_ROW = 8;
export function drawYou(v) {
  const { SL, ST, t } = v, row = k => ST + 2 + k * YOU_ROW, slots = Math.max(3, P.hp), quiet = !settings.hudFull;
  part('hearts', () => { for (let i = 0; i < slots; i++) pText('♥', SL + i * 5, row(0), i < P.hp ? INK.value : INK.lost, 'left', 1, true);   // the hearts you have, and the ones you've lost
    if (P.fed) pText('+' + P.fed, SL + slots * 5 + 2, row(0), INK.label, 'left', 1, true); });
  part('motion', () => { let x = SL; for (const [value, unit] of [[mph(P.speed), 'MPH'], [knots(P.speed), 'KT']]) { const n = value.toFixed(1); pText(n, x, row(1), INK.value, 'left', 1, true); x += n.length * 4 + 2; pText(unit, x, row(1), INK.label, 'left', 1, true); x += unit.length * 4 + 4; }   // the same speed, in the miles you know and the knots you are learning
    const bx = SL + 38;
    const sta = P.sta ?? 1; for (let i = 0; i < 8; i++) { const on = i < Math.round(sta * 8); for (let x = 0; x < 2; x++) pDot(bx + i * 3 + x, row(0) + 2, on ? 220 : 60); } });   // the burst left, beside your hearts
  part('ability', () => { const ready = (P.actReady || 0) <= simTime, key = document.body.classList.contains('touch') ? '◆' : kn('ability');
    pText(key, SL, row(2), ready ? INK.value : 80, 'left', 1, true); pText(abilityName(), SL + [...key].length * 4 + 4, row(2), ready ? 170 : 70, 'left', 1, true); });
  // below them, only when they matter. quiet, the tide is the silt drifting past and the hunt is the edges closing in, with the warning naming it
  let k = 3;
  if (readouts.tide && !quiet) pText(readouts.tide, SL, row(k++), 200, 'left', 1, true);
  if ((P.air ?? 1) < (quiet ? TUNE.hud.airShow : 0.999)) { const low = P.air < 0.25, y = row(k++); pText('AIR', SL, y, low ? 150 + 105 * (0.5 + 0.5 * Math.sin(t * 8)) : 170, 'left', 1, true); for (let i = 0; i < 8; i++) { const on = i < Math.ceil(P.air * 8); for (let x = 0; x < 2; x++) pDot(SL + 14 + i * 3 + x, y + 2, on ? 220 : 60); } }   // lungs
  if (huntHeat > 0 && !quiet) { const n = Math.ceil(huntHeat * 3); pText('HUNTED ' + '◆'.repeat(n) + '·'.repeat(3 - n), SL, row(k++), 150 + 105 * (0.5 + 0.5 * Math.sin(t * 6)), 'left', 1, true); }   // stars: break contact to drain them
}
export function drawDepthGauge(v) {   // surface at the top, the bottom of the bay below, you between; rise and dive chevrons beside you
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  { const gx = SL, g0 = Math.round(H * 0.34), gh = Math.max(16, Math.min(Math.round(H * 0.3), chartBox(v).left ? H - chartBox(v).MS - SB - 30 - g0 : H)),   /* on a phone, clear of the chart below it */ floor = Math.max(1, -floorAt(P.pos.x, P.pos.z)), at = THREE.MathUtils.clamp(-P.pos.y / floor, 0, 1);   /* depth gauge: surface at the top, the bottom of the bay below, you between */
    for (let y = 0; y <= gh; y += 2) pDot(gx, g0 + y, 50); for (let x = -1; x <= 2; x++) { pDot(gx + x, g0 - 1, 150); pDot(gx + x, g0 + gh + 1, 110); }
    const py = g0 + Math.round(at * gh); for (let x = -1; x <= 2; x++) { pDot(gx + x, py, 255); pDot(gx + x, py + 1, 255); }
    { const w = pSeg(Math.max(0, -P.pos.y).toFixed(1), gx + 5, py - 3, INK.value); pText('M', gx + 6 + w, py - 1, INK.label, 'left', 1, true); }   // how deep you are rides beside you, in the stereo's big digits
    pText('FLOOR', gx - 1, g0 + gh + 4, INK.label, 'left', 1, true); pText(P.pos.y - floorAt(P.pos.x, P.pos.z) > TUNE.water.bottomSeen ? '---' : readouts.floor + 'M', gx + 23, g0 + gh + 4, 190, 'left', 1, true);   // past where you can see it, you don't know   // and the bottom under you, at the bottom
    const climbIn = P.climbIn || 0, fl = (t * 2.2) % 1;   // rise and dive: chevrons flowing up or down the gauge, beside you
    if (Math.abs(climbIn) > 0.1) for (let k = 0; k < 2; k++) { const up = climbIn > 0, d = 9 + (k + fl) * 5; pText(up ? '▲' : '▼', gx + 8, up ? py - 6 - d : py - 2 + d, 240 * Math.min(1, Math.abs(climbIn) * 1.5) * (1 - 0.7 * (k + fl) / 2), 'center'); } }
}
export function drawAimMark(v) {   // where the mouse is steering you: faint, never faded
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  if (mouseSteering() && aim.yaw != null) { _v.copy(fwdOf(aim.yaw, aim.pitch)).multiplyScalar(14).add(P.pos).project(camera);
    if (_v.z < 1) { const ax = (_v.x * 0.5 + 0.5) * W, ay = (0.5 - _v.y * 0.5) * H; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) pDot(ax + dx, ay + dy, 110 / pGain); } }   // where you're steering: faint, never faded
}
export function drawPulses(v, px, py) {   // the sense and echo rings, out from you
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  for (let i = pulses.length - 1; i >= 0; i--) { const age = t - pulses[i].t0, life = pulses[i].kind === 'echo' ? 1.8 : 1.4; if (age > life) { pulses.splice(i, 1); continue; }
    const rings = pulses[i].kind === 'echo' ? 3 : 1; for (let k = 0; k < rings; k++) { const a = age - k * 0.18; if (a > 0) pRing(px, py, a / life * W * 0.55, 210 * (1 - a / life)); } }
}
export function drawTurnMarks(v, px, py, onScreen) {   // turning: chevrons beside you, drifting the way you turn
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  // each control has its own shape. turning: chevrons beside you, drifting the way you turn
  const flow = (t * 2.2) % 1, turnIn = P.turnIn || 0;
  if (Math.abs(turnIn) > 0.1 && onScreen) { const dir = turnIn > 0 ? -1 : 1, v = 230 * Math.min(1, Math.abs(turnIn) * 1.5);   // + is left
    for (let k = 0; k < 2; k++) { const d = 12 + (k + flow) * 8; pText(dir < 0 ? '◄' : '►', px + dir * d, py - 3, v * (1 - 0.7 * (k + flow) / 2), 'center'); } }
}
export function drawCurrentDashes(v) {   // the current: faint dashes drifting one way, like silt in a flow
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  // the current: faint dashes all drifting the same way, slow, like silt in a flow. nothing like the burst's rush out from the middle
  { const c = P.current || 0; if (c > 0.2 && !P.camUp) { _v.copy(P.pos).project(camera); const sx0 = _v.x, sy0 = _v.y; _v.copy(P.pos).addScaledVector(_cur, 4 / Math.max(0.01, _cur.length())).project(camera);
    let dx = (_v.x - sx0) * W, dy = -(_v.y - sy0) * H; const dl = Math.hypot(dx, dy); if (dl > 0.5) { dx /= dl; dy /= dl;
      const v = 120 * THREE.MathUtils.smoothstep(c, 0.2, 1.0), drift = t * (6 + c * 10);
      for (let i = 0; i < 34; i++) { const bx = hash2(i, 11) * W, by = hash2(i, 23) * H, run = (drift + hash2(i, 5) * W) % W, x0 = bx + dx * run, y0 = by + dy * run;
        const wx = ((x0 % W) + W) % W, wy = ((y0 % H) + H) % H; for (let k = 0; k < 3; k++) pDot(wx + dx * k * 1.5, wy + dy * k * 1.5, v * (k + 1) / 3); } } } }
}
export function drawBurstStreaks(v) {   // burst: streaks rushing out from the middle of the view
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  // burst: streaks rushing out from the middle of the view, the way speed looks
  if (settings.speedFx && (P.burstMix || 0) > 0.02) for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2 + hash2(i, 7) * 0.15, u = (t * 1.8 + hash2(i, 3)) % 1, r = 0.72 + u * 0.4, ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < 4; k++) { const rr = r + k * 0.022; pDot(cx + ca * rr * W * 0.5, (H >> 1) + sa * rr * H * 0.5, 130 * P.burstMix * Math.sin(u * Math.PI) * (k + 2) / 5); } }   // out at the edges, and only a glance: nearer the middle they read as scratches on the picture
}
export function drawCompassTape(v) {   // top middle, where you are going: the compass tape and the goal on it
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const hdg = headingDeg(), half = Math.max(24, Math.floor(W * 0.17)), ppd = half / 60;   // compass
  for (const [deg, name] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W'], [45, '·'], [135, '·'], [225, '·'], [315, '·']]) { const rel = ((deg - hdg + 540) % 360) - 180; if (Math.abs(rel) <= 60) pText(name, cx + Math.round(rel * ppd), ST + 9, name === '·' ? 110 : 190, 'center', 1, true); }
  for (let y = ST + 7; y <= ST + 15; y += 8) { pDot(cx, y, 255); pDot(cx, y + 1, 255); }   // the lubber line above and below the cardinals
  const goal = compassMarks.find(l => l.goal);
  if (goal) { const raw = ((goal.bearing - hdg + 540) % 360) - 180, off = Math.abs(raw) > 52, gx = cx + Math.round(THREE.MathUtils.clamp(raw, -52, 52) * ppd);
    const label = goal.dist > 999 ? (goal.dist / 1000).toFixed(1) + 'KM' : Math.round(goal.dist / 10) * 10 + 'M';
    pText(off ? (raw > 0 ? '►' : '◄') : '◆', gx, ST + 1, 255, 'center', 1, true); pText(label, gx + (raw > 0 ? -4 : 4), ST + 1, 190, raw > 0 ? 'right' : 'left', 1, true); }
}
export function drawPlace(v) { if (readouts.place) pText(readouts.place, v.cx, v.ST + 19, 150, 'center', 1, true); }   // where you are, under which way you are going
export function drawPhotoPrompt(v, introK) {   // a moment worth keeping
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  { const spot = photoSpot(); if (spot) { pGain = 1; pText(`◆ ${kn('photo')} PHOTO`, W - SL, ST + 2 + ((performance.now() - lastSaved) / 1000 < 2 ? 8 : 0), 130 + 40 * Math.sin(t * 2), 'right', 1, true); pGain = introK; } }   /* a moment worth keeping */
}
export function drawWarning(v) {   // DIVE, or what is hunting you
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const ow = opa(warn), failW = pFail; pFail = 0; if (ow > 0.01 && warn.textContent) pText(warn.textContent, cx, ST + 28, 255 * ow * (0.65 + 0.35 * Math.sin(t * 8)), 'center'); pFail = failW;
}
export const chartBox = v => ({ MS: Math.max(22, Math.min(46, Math.floor(v.H * 0.2))), left: document.body.classList.contains('touch') });   // the chart's size, and which corner
export function drawChart(v) {   // a bottom corner, the water around you: the chart, and the live NOAA readings over it. on a phone the buttons have the right, so it sits left
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  { const { MS, left } = chartBox(v), mx = left ? SL : W - MS - SL, my = H - MS - SB, span = 3000, ax = left ? mx : mx + MS, al = left ? 'left' : 'right';
    if (!panel.mini || panel.miniS !== MS || t - (panel.miniT || 0) > 0.5) { panel.mini = Bay.chart(P.pos.x, P.pos.z, span, MS, panel.mini && panel.miniS === MS ? panel.mini : undefined); panel.miniS = MS; panel.miniT = t; panel.miniC = [P.pos.x, P.pos.z]; }
    const [mcx, mcz] = panel.miniC;
    for (let j = 0; j < MS; j++) for (let i = 0; i < MS; i++) pDot(mx + i, my + j, panel.mini[j * MS + i] * 0.85);
    for (let i = -1; i <= MS; i++) { pDot(mx + i, my - 1, 60); pDot(mx + i, my + MS, 60); pDot(mx - 1, my + i, 60); pDot(mx + MS, my + i, 60); }
    const g = story.goal; if (g) { const [gx, gy] = Bay.toChart(g[0], g[1], mcx, mcz, span, MS); pText('◆', THREE.MathUtils.clamp(gx, 2, MS - 2) + mx, THREE.MathUtils.clamp(gy, 2, MS - 4) + my - 2, 255, 'center', 1, true); }
    const [px2, py2] = Bay.toChart(P.pos.x, P.pos.z, mcx, mcz, span, MS), hx = -Math.sin(P.yaw), hz = -Math.cos(P.yaw);
    if (Math.sin(t * 6) > -0.4) { pDot(mx + px2, my + py2, 255); pDot(mx + px2 + 1, my + py2, 255); pDot(mx + px2, my + py2 + 1, 255); pDot(mx + px2 + 1, my + py2 + 1, 255); }
    for (let k = 2; k <= 4; k++) pDot(mx + px2 + 0.5 + hx * k, my + py2 + 0.5 + hz * k, 200);
    const L = Bay.live; if (L.ok) { const level = L.level != null ? 'WATER ' + (L.level >= 0 ? '+' : '') + L.level.toFixed(1) + 'M' + (L.rising == null ? '' : L.rising ? '▲' : '▼') : '';   // the current on you is in your own readout, in M/S, once
      pText(ENV.live ? weatherLine() : 'NOAA LIVE', ax, my - 15, 110, al, 1, true); pText([level, L.temp != null ? L.temp.toFixed(0) + 'C' : ''].filter(Boolean).join('  '), ax, my - 8, 190, al, 1, true); } }
}
export function drawCaptions(v, introK) {   // what you would hear, above the story line, leaning to the side it came from
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  pFail = 0; if (captions.size) { pGain = 1; const nowMs = performance.now(), sides = { l: 0, r: 0, c: 0 };   /* what you'd hear, shown on the side it came from */
    const shown = new Set(); for (const [k, c] of captions) { const left = c.until - nowMs; if (left <= 0) { captions.delete(k); continue; } const side = sideOf(c.x, c.z), s = side < -0.3 ? 'l' : side > 0.3 ? 'r' : 'c', a = 170 * Math.min(1, left / 400); if (shown.has(s + c.text)) continue; shown.add(s + c.text);   /* one line per sound per side, however many boats */
      const y = storyTop(v) - 10 - 8 * sides[s]++, lean = Math.round(v.W * 0.18);
      if (s === 'l') pText('◄ ' + c.text, cx - lean, y, a, 'center', 1, true); else if (s === 'r') pText(c.text + ' ►', cx + lean, y, a, 'center', 1, true); else pText(c.text, cx, y, a, 'center', 1, true); }
    pGain = introK; }
}
export function drawKeyHint(v) {   // the key hints along the bottom, until they settle away
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  // in the space beside the chart: as many keys to a row as fit, the rows stacking up from the bottom
  const ob = opa(bl); if (ob > 0.01 && W > 120) { const { MS, left } = chartBox(v), x0 = left ? SL + MS + 6 : SL, room = Math.floor((W - SL * 2 - MS - 6) / 4), rows = [];
    for (const part of bl.textContent.split(/\s{3,}|\s·\s/)) { const last = rows[rows.length - 1]; if (last && last.length + 3 + part.length <= room) rows[rows.length - 1] += '   ' + part; else rows.push(part); }
    rows.forEach((r, i) => pText(r, x0, H - 7 - SB - (rows.length - 1 - i) * 7, 120 * ob, 'left', 1, true)); }
}
export function drawTouchControls(v) {   // the round buttons and the drag stick, as dots
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  if (document.body.classList.contains('touch')) {
    for (const id of ['tBurst', 'tAct', 'tMap', 'tCreature', 'tPause']) { const el = $(id), r = el.getBoundingClientRect(); if (!r.width) continue; const bx = toCell(r.left + r.width / 2), by = toCell(r.top + r.height / 2), on = el.classList.contains('on');
      pRing(bx, by, toCell(r.width / 2), on ? 220 : 90); pText({ tBurst: '►►', tAct: '◆', tMap: 'M', tCreature: '⇄', tPause: 'II' }[id], bx, by - 3, on ? 255 : 200, 'center'); }
    pGain = 1;
    if (touch.id !== null) { const sx = toCell(touch.ox), sy = toCell(touch.oy); pRing(sx, sy, toCell(STICK_R), 70); const kx = sx + toCell(touch.kx || 0), ky = sy + toCell(touch.ky || 0); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) pDot(kx + dx, ky + dy, 200); }
  }
}
export const storyRoom = v => { const { MS, left } = chartBox(v); return left ? Math.floor((v.W - 2 * (v.SL + MS + 4)) / 6) : Infinity; };   // on a phone the chart has one bottom corner and the buttons the other
export function storyLayout(v) { const ts = settings.bigText && v.W > 200 ? 2 : 1, b = storyEl.querySelector('b'), label = b ? b.textContent : ''; return { ts, label, lines: opa(storyEl) > 0.01 ? wrap(storyEl.textContent.slice(label.length), Math.floor(Math.min(v.cols, 64, storyRoom(v)) / ts)) : [] }; }
export const storyTop = v => { const { ts, label, lines } = storyLayout(v); return v.H - 14 - v.SB - lines.length * 10 * ts - (label && lines.length ? 11 : 0); };   // the top of the story line, or where it would start
export function drawStoryLine(v, oHelp) {   // the story line at the bottom (hidden while a chapter card is up)
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  const os = opa(storyEl) * (1 - opa($('chapter'))) * (1 - oHelp) * (mapOpen || menu ? 0 : 1); if (os > 0.01) {   // story line (hidden while a chapter card is up)
  const { ts, label, lines } = storyLayout(v);
  let y = H - 14 - SB - lines.length * 10 * ts; if (label) pText(label, cx, y - 11, 140 * os, 'center'); for (const l of lines) { pText(l, cx, y, 230 * os, 'center', ts); y += 10 * ts; } }
}
// every card on this display is built the same: a frame of fine dots, a title and a rule, then its rows, with the head unit's status beside the title and the keys under the frame
export function cardFrame(bx, by, bw, bh, a = 1) { for (let x = bx; x <= bx + bw; x += 2) { pDot(x, by, 70 * a); pDot(x, by + bh, 70 * a); } for (let y = by; y <= by + bh; y += 2) { pDot(bx, y, 70 * a); pDot(bx + bw, y, 70 * a); } }
export function cardHead(title, ix, by, bx, bw, a = 1) { pText(title, ix, by + 6, 240 * a); pText(statusLine(), bx + bw - 7, by + 7, 140 * a, 'right', 1, true); for (let x = ix; x < bx + bw - 7; x += 2) pDot(x, by + 16, 90 * a); return by + 22; }
export const statusLine = () => `${clockText(day.hour)}${ENV.live ? '  ' + (ENV.rain > 0 ? 'RAIN' : ENV.cloud > 0.6 ? 'OVERCAST' : 'CLEAR') : ''}`;   // the clock on the stereo's glass
export function drawHelp(v, oHelp) {   // how to swim: a card like every other, one thing a row
  const { W, H, cx } = v, ks = [...help.querySelectorAll('.keys > *')], pairs = []; for (let i = 0; i + 1 < ks.length; i += 2) pairs.push([ks[i].textContent, ks[i + 1].textContent]);
  const keyW = Math.max(...pairs.map(p => [...p[0]].length)) * 6 + 8, descW = Math.max(...pairs.map(p => p[1].length)) * 6, bw = Math.min(W - 6, Math.max(keyW + descW + 16, 150)), bh = 28 + pairs.length * 10, bx = (W - bw) >> 1, by = Math.max(2, (H - bh - 10) >> 1), ix = bx + 8, a = oHelp;
  dotPass.uniforms.uDim.value = Math.max(dotPass.uniforms.uDim.value, 0.96 * oHelp); cardFrame(bx, by, bw, bh, a); let y = cardHead('HOW TO SWIM', ix, by, bx, bw, a);
  for (const [k, d] of pairs) { pText(k, ix, y, 240 * a); pText(d, ix + keyW, y, 170 * a); y += 10; }
  pText(MOBILE ? 'TAP TO CLOSE' : 'H TO CLOSE', cx, by + bh + 5, 105 * a, 'center', 1, true);
}
export function drawPauseCard(v) {   // paused: a small framed card, left-aligned, the bay almost gone behind it
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  dotPass.uniforms.uDim.value = 0.96;
  const items = menuItems(), labels = items.map(it => it.label()), TITLE = { settings: 'SETTINGS', sound: 'SOUND', comfort: 'COMFORT', controls: 'CONTROLS', keys: 'KEYS', feedback: 'SEND FEEDBACK', journal: 'JOURNAL', confirm: 'START OVER?', note: (menu.note || '').toUpperCase() }[menu.kind] || 'PAUSED';
  const note = menu.kind === 'note' ? wrap(LORE[menu.note] || '', Math.min(cols - 4, 46)) : menu.kind === 'confirm' ? ['your progress here will be wiped.'] : menu.kind === 'feedback' ? feedbackLines(Math.min(cols - 4, 46)) : [];
  const chars = Math.max(TITLE.length, ...labels.map(l => [...l].length + 2), ...note.map(l => l.length)), bw = Math.min(W - 6, chars * 6 + 15), bx = (W - bw) >> 1, ix = bx + 8;
  const fit = Math.max(3, Math.floor((H - 46 - note.length * 9) / 10)), shown = Math.min(fit, items.length), first = Math.max(0, Math.min(menu.sel - (fit >> 1), items.length - fit));   /* long lists scroll with the selection */
  const bh = 22 + (note.length ? note.length * 9 + 5 : 0) + shown * 10 + 3, by = Math.max(2, (H - bh - 10) >> 1);
  cardFrame(bx, by, bw, bh); let y = cardHead(TITLE, ix, by, bx, bw);
  for (const l of note) { pText(l, ix, y, 185); y += 9; } if (note.length) y += 5;
  menu.rows = [];
  items.forEach((it, i) => { if (i < first || i >= first + fit) { menu.rows.push([-99, -99]); return; } const on = i === menu.sel; pText((on ? '► ' : '  ') + labels[i], ix, y, on ? 255 : 165); menu.rows.push([y - 2, y + 8]); y += 10; });
  if (first > 0) pText('▲', bx + bw - 6, by + 18, 120, 'center', 1, true); if (first + fit < items.length) pText('▼', bx + bw - 6, by + bh - 7, 120, 'center', 1, true);
  pText(menu.kind === 'feedback' ? (MOBILE ? 'TYPE, THEN TAP SEND' : 'ENTER SEND  SHIFT+ENTER NEW LINE  ESC BACK') : menu.binding ? 'PRESS THE NEW KEY  ESC KEEP IT' : pad.active ? 'A CHOOSE  ◄► CHANGE  B BACK' : 'ENTER CHOOSE  ◄► CHANGE  ESC BACK', cx, by + bh + 5, 105, 'center', 1, true);
}
export function drawFastTravel(v) {   // fast travel: the bay as dots, the places you have found
  const { W, H, ST, SL, SB, cx, t, cols } = v;
  pText('FAST TRAVEL', 6, 3, 240); pText(statusLine(), W - 6, 4, 140, 'right', 1, true); for (let x = 6; x < W - 6; x += 2) pDot(x, 12, 90);
  const land = W > H * 1.3, S = Math.max(20, land ? Math.min(H - 20, (W >> 1) - 8) : Math.min(W - 12, Math.floor(H * 0.55))), mx = land ? W - S - 6 : (W - S) >> 1, my = 16;
  const tt = TILES.outer, span = tt.xmax - tt.xmin, ccx = (tt.xmin + tt.xmax) / 2, ccz = (tt.zmin + tt.zmax) / 2;
  if (!panel.map || panel.mapS !== S) { panel.map = Bay.chart(ccx, ccz, span, S); panel.mapS = S; }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) pDot(mx + i, my + j, panel.map[j * S + i]);
  checkpoints.forEach((c, i) => { const [px, py] = mapXY(c.x, c.z, S), v = i === mapSel ? (Math.sin(t * 8) > 0 ? 255 : 120) : 220; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) pDot(mx + px + dx, my + py + dy, v); });
  { const [px, py] = mapXY(P.pos.x, P.pos.z, S); if (Math.sin(t * 5) > -0.3) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) pDot(mx + px + dx, my + py + dy, 255); }
  const lx = land ? 6 : mx, ly = land ? 18 : my + S + 6, maxN = Math.max(1, Math.floor((H - ly - 4) / 10)), first = Math.max(0, Math.min(mapSel - (maxN >> 1), checkpoints.length - maxN)), lc = Math.max(8, Math.floor((land ? mx - 10 : W - lx - 4) / 6) - 2);
  checkpoints.slice(first, first + maxN).forEach((c, k) => { const i = first + k; pText((i === mapSel ? '► ' : '  ') + c.name.slice(0, lc), lx, ly + k * 10, i === mapSel ? 255 : 150); });
}
