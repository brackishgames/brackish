import * as THREE from 'three';
import { toXZ } from '../lib/geo.js?v=__BUILD__';
import { DEV, TEST } from '../core/env.js?v=__BUILD__';
import { emit, once } from '../core/events.js?v=__BUILD__';
import { rand } from '../core/random.js?v=__BUILD__';
import { canFull, goFull } from '../core/screen.js?v=__BUILD__';
import { fwdOf } from '../core/space.js?v=__BUILD__';
import { TUNE } from '../core/tune.js?v=__BUILD__';
import { WU } from '../render/materials.js?v=__BUILD__';
import { FEVER_PATH, floorAt } from '../world/geo.js?v=__BUILD__';
import { day } from '../world/time.js?v=__BUILD__';
import { SPECIES, speciesById } from '../actors/creatures.js?v=__BUILD__';
import { fever, feverR } from '../actors/fever.js?v=__BUILD__';
import { P, becomeSpecies, unlocked } from '../actors/player.js?v=__BUILD__';
import { WILD_ACTIVE, setWild, wild } from '../actors/wildlife.js?v=__BUILD__';
import { bell, chimeCheckpoint, chimeStart } from './audio.js?v=__BUILD__';
import { lockPointer, sprinting } from './input.js?v=__BUILD__';
import { saveGame } from './save.js?v=__BUILD__';
import { $, cameraBehind, checkpoints, discover, say, sayTimer, travelTo } from '../ui/hud.js?v=__BUILD__';
import { logo } from '../ui/logo.js?v=__BUILD__';
import { whenFaded } from '../ui/panel.js?v=__BUILD__';
import { tilt } from '../ui/touch.js?v=__BUILD__';
import { later } from '../app/frame.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  STORY  —  a young cownose ray, the channel, the fever, the Gulf.
// ═══════════════════════════════════════════════════════════════════
export const CHAPTERS = [
  { title: 'I · THE HOLE OFF EGMONT', species: 'cownose', clock: 7, start: [27.60629, -82.75359], goal: () => toXZ(27.6055, -82.7565), radius: 60,
    lines: ['You are a young cownose ray.', 'The current pours through the pass by Egmont Key, into a hole 25 metres deep.', 'Follow the beam of light.', 'E to sense. Clams hide in the sand, and they give a heart back.'] },
  { title: 'II · THE CHANNEL', start: [27.61982, -82.65863], goal: () => toXZ(27.6215, -82.6555), radius: 90,
    lines: ['Something hums under the Skyway.', 'The ship channel is dredged deep and the hulls do not see you.', 'Cross it. When the water hums, dive.'] },
  { title: 'III · THE FEVER', feverAt: 'hole', start: [27.60796, -82.75062], goal: () => [fever.c.x, fever.c.z], radius: 60,
    lines: ['Thousands of your kind are gathering in the deep water off Egmont.', 'A group of rays is called a fever.', 'Find them.'] },
  { title: 'IV · THE GULF', follow: true, withFever: true, feverMoves: true, goal: () => [fever.c.x, fever.c.z], radius: 70, done: () => story.followT > 120 || (fever.seg + 1 >= FEVER_PATH.length && feverR(P.pos) < 1.2),
    lines: ['Stay with the fever.', 'They are leaving the bay, west, where the bottom falls away.', 'Do not lose them in the murk.'] },
  { title: 'V · THIRTY METRES', start: [27.52, -83.17], surface: true, clock: 17.5,
    lines: ['Three days west.', 'Thirty metres of water and no bottom in sight.', 'Rise. Break the surface. The pelicans go where the fever goes.'] },
  { title: 'VI · THE POD', species: 'dolphin', start: [27.6185, -82.66117], pair: true, goal: () => { const m = wild.find(o => o.partner); return m && m.pos.distanceTo(P.pos) > 25 ? [m.pos.x, m.pos.z] : null; },
    lines: ['The fever scatters. Something faster finds you.', 'You are a bottlenose dolphin now, and one of the pod has come to swim beside you.', 'Swim straight at the surface, close beside it. Leap together, three times.'] },
  { title: 'VII · THE SHADOW', species: 'bull', clock: 21, start: [27.84, -82.47], feed: 8,
    lines: ['Hillsborough Bay. Warm, brown, shallow.', 'You are a bull shark now. The mullet know you before they see you.', 'Feed. E to lunge. They scatter. Eight will do.'] },
  { title: 'VIII · SLOW WATER', species: 'manatee', start: [27.80099, -82.41895], goal: () => toXZ(27.8005, -82.4145), radius: 90,
    lines: ['You are a manatee. Nothing here is fast except the boats.', 'The power plant at Apollo Beach runs warm water into the bay, and in winter that is the only warm water there is.', 'Get there. Stay deep when the water hums.'] },
  { title: 'IX · DAWN', feverAt: 'hole', species: 'cownose', start: [27.60629, -82.75359], surface: true, clock: 5.6,
    lines: ['Spring. The fever comes back to the bay.', 'You are a cownose ray again, in the pass where you began.', 'Rise. Break the surface at dawn.'] },
  { title: 'FREE SWIM', free: true,
    lines: ['The bay is yours, and every body you have been.', 'TAB to change. M for the map and fast travel.', 'There are things on the bottom nobody talks about.'] },
];
export const story = { ch: 0, line: -1, surfaceT: 0, followT: 0, breaths: 0, wasUp: false, fed0: 0, goal: null,
  begin(i) {
    this.ch = i; this.line = 0; this.breaths = 0; this.surfaceT = 0; this.hammer = false; this.syncs = 0; for (const o of wild) o.partner = false; this.beganAt = WU.uTime.value; this.fed0 = P.fed || 0; P.hp = Math.max(P.hp || 0, 3); const c = CHAPTERS[i];
    const fade = $('fade'), card = $('chapter'), run = this.run = (this.run || 0) + 1, current = () => run === this.run;   // a newer start supersedes this one, and its leftovers do nothing
    const arrive = () => { if (!current()) return;
      if (c.feverAt === 'hole') { fever.seg = 0; fever.t = 0; fever.moving = false; fever.c.set(FEVER_PATH[0][0], fever.c.y, FEVER_PATH[0][1]); }   // the fever gathers in the hole off Egmont (III), and is back there in the spring (IX)
      if (c.species) becomeSpecies(speciesById[c.species]); if (c.clock !== undefined) day.hour = c.clock;
      if (c.start) { const [x, z] = toXZ(...c.start); travelTo({ name: c.title, x, z }); }   // every chapter that has a place begins there, however you came to it
      if (c.withFever) joinFever(c.title);   // the fever moves: this chapter starts wherever it has got to
      if (c.pair) this.spawnPartner();
      card.textContent = c.title; card.style.opacity = 1; chimeStart();
      later(TUNE.timing.cardHold, () => { if (!current()) return; fade.style.opacity = 0; card.style.opacity = 0; say(c.lines[0], 8, c.species && i > 0 ? `${c.title}  ·  THE BAY REMEMBERS` : c.title); });   // each new body is another life the bay has kept
      if (c.feverMoves) fever.moving = true;   // they leave the bay, and you go with them
      emit('chapter-begun', i);
    };
    if (i > 0) fade.style.opacity = 1;   // the screen goes black (drawn on screen time) while the chapter waits its moment on the world's clock,
    later(i > 0 ? TUNE.timing.toBlack : 0, arrive, 'world');   // so the world changes inside a world step, the same on every machine
  },
  ending() {
    const card = $('chapter'), bodies = SPECIES.filter(sp => unlocked.has(sp.id)).map(sp => sp.name), places = checkpoints.map(c => c.name).filter(n => !/^[IVX]+ · /.test(n));
    const cards = ['the bodies you have been', bodies.slice(0, 4).join('  ·  '), bodies.slice(4).join('  ·  '), 'the places', places.slice(0, 4).join('  ·  '), places.slice(4, 8).join('  ·  '), 'the bay remembers you', 'BRACKISH'].filter(Boolean);
    let i = 0; const show = () => { if (i >= cards.length) { card.style.opacity = 0; whenFaded(card, 0, () => this.begin(this.ch + 1)); return; }
      card.textContent = cards[i++]; card.style.opacity = 1; bell(); later(TUNE.timing.endingCard, () => { card.style.opacity = 0; whenFaded(card, 0, show); }); };   // each card goes, then the next comes
    P.endingCam = true; later(TUNE.timing.endingFirst, show);
  },
  spawnPartner() { const w = wild.find(o => o.id < WILD_ACTIVE && !o.hunting); if (!w) return; setWild(w, speciesById.dolphin, P.pos.x + Math.cos(P.yaw) * 4, Math.min(P.pos.y, -0.8), P.pos.z - Math.sin(P.yaw) * 4); w.yaw = P.yaw; w.partner = true; },
  together() { this.syncs = (this.syncs || 0) + 1; if (CHAPTERS[this.ch].pair && this.syncs < 3) say(['together.', 'again.'][this.syncs - 1], 2); },   /* the bond is the leap */
  advance() { const c = CHAPTERS[this.ch]; if (this.line + 1 < c.lines.length) { this.line++; say(c.lines[this.line], 7); this.lineT = 0; } },   // the chapter's name heads its first line only
  step(dt) {
    this.lineT = (this.lineT || 0) + dt; if (this.lineT > 8 && sayTimer <= 0) { this.advance(); this.lineT = 0; }
    const c = CHAPTERS[this.ch]; if (c.free) { this.goal = null; return; }
    this.goal = c.goal ? c.goal() : null;
    if (c.follow && feverR(P.pos) < 1.2) this.goal = null;   // among them there is nothing to point at; the beam comes back if you fall behind
    let done = false;
    if (c.goal && !c.follow && !c.pair && this.goal) done = Math.hypot(this.goal[0] - P.pos.x, this.goal[1] - P.pos.z) < c.radius;
    if (c.pair) done = (this.syncs || 0) >= 3;
    if (c.breaths && !c.goal) done = false;
    if (c.follow && this.followT > 50 && !this.hammer) {   // great hammerheads follow the cownose migrations, taking the ones at the edge
      this.hammer = true; const w = wild.filter(o => !o.hunting && o.id < WILD_ACTIVE).sort((a, b) => b.pos.distanceTo(P.pos) - a.pos.distanceTo(P.pos))[0], back = fwdOf(fever.yaw).multiplyScalar(-75).add(fever.c);
      if (w) { setWild(w, speciesById.hammer, back.x, fever.c.y - 3, back.z); w.yaw = fever.yaw; w.feverPass = 20; say('something is following the fever. stay in the middle of them.', 4); }
    }
    if (c.follow) { const d = Math.hypot(fever.c.x - P.pos.x, fever.c.z - P.pos.z); fever.speed = d > 80 ? 0.4 : 1.0; if (d < 90) { const q = Math.floor(this.followT / 30); this.followT += dt; if (Math.floor(this.followT / 30) > q && q < 3) say(['the fever carries you west', 'the bottom falls away under you', 'the bay is behind you now'][q], 3); } if (d < 90 && !sprinting()) P.speed = Math.max(P.speed, fever.speed + 0.2); if (d > 140 && sayTimer <= 0) say('the fever is pulling away', 2); done = c.done(); }
    if (c.surface) { this.surfaceT = P.pos.y > -0.35 ? this.surfaceT + dt : 0; done = this.surfaceT > 4; }
    if (c.feed) { done = (P.fed || 0) - this.fed0 >= c.feed; if (sayTimer <= 0 && rand() < 0.002) say(`FED ${(P.fed || 0) - this.fed0} / ${c.feed}`, 1.5); }
    if (c.breaths) { const up = P.pos.y > -0.3; if (up && !this.wasUp) { this.breaths++; say(`BREATH ${this.breaths} / ${c.breaths}`, 1.5); } this.wasUp = up; done = done && this.breaths >= c.breaths; if (done && this.breaths < c.breaths) done = false; }
    if (done) { const place = c.title.replace(/^[IVX]+ · /, ''); if (checkpoints.some(k => k.name === place)) chimeCheckpoint(); discover(place, P.pos.x, P.pos.z);   /* a replayed chapter still rings */ if (CHAPTERS[this.ch + 1].free && !this.ended) { this.ended = true; this.ending(); } else this.begin(this.ch + 1); once('chapter-begun').then(() => saveGame()); }   /* saved once the next chapter is really under way */
  } };
export const TITLE_HINT = 'PRESS ENTER OR CLICK';
export let started = false;   // past the title: set once, by startGame
export let startedAt = -1e9;   // screen time the swim began: the HUD eases in from here
// put you at the fever's trailing edge, among the stragglers, wherever it has got to
export function joinFever(name) { const back = fwdOf(fever.yaw, 0).multiplyScalar(-TUNE.fever.behind).add(fever.c); travelTo({ name, x: back.x, z: back.z }); P.yaw = fever.yaw; P.pos.y = THREE.MathUtils.clamp(fever.c.y, floorAt(P.pos.x, P.pos.z) + P.sp.alt + 0.5, -1); cameraBehind(); }
export function startGame(save) { if (canFull && !DEV && !TEST) goFull(); tilt.zero = null; started = true; lockPointer(); document.body.classList.add('playing'); startedAt = WU.uTime.value; later(TUNE.timing.hintFor, () => document.body.classList.add('settled'));
  $('title').classList.add('gone');
  if (save && CHAPTERS[save.ch].withFever && Math.hypot(P.pos.x - fever.c.x, P.pos.z - fever.c.z) > TUNE.fever.rejoin) joinFever(CHAPTERS[save.ch].title);   // a save from far off: back with them
  if (save) { logo.release(); if (CHAPTERS[save.ch].pair) story.spawnPartner(); story.ch = save.ch; story.line = 0; const c = CHAPTERS[save.ch]; const card = $('chapter'); card.textContent = c.title; card.style.opacity = 1; chimeStart(); later(TUNE.timing.resumeCard, () => { card.style.opacity = 0; say(c.lines[0], 7, c.title); }); if (CHAPTERS[save.ch].feverMoves && !save.fever) fever.moving = true; emit('chapter-begun', save.ch); return; }
  story.begin(0); }
export function pressedAny() { P.titleIdle = 0; if (!started) { $('title').classList.remove('attract'); } }
