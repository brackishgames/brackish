'use strict';
// ═══════════════════════════════════════════════════════════════════
//  HUD  —  readouts, compass tape, minimap, fast-travel map, story text
// ═══════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const tl = $('tl'), tr = $('tr'), bl = $('bl'), warn = $('warn'), storyEl = $('story'), flash = $('flash'), help = $('help'), mapEl = $('map');
const mini = $('mini'), mctx = mini.getContext('2d'), cmp = $('compass'), cctx = cmp.getContext('2d'), big = $('bigmap'), bctx = big.getContext('2d');
let sayTimer = 0, sayEndT = 0;   // how long the line on screen has left; when the last one went
const tipQueue = [];
function tip(id, text, label = 'TIP') { if (settings.tips[id] || tipQueue.some(q => q.id === id)) return; tipQueue.push({ id, text, label }); }
function stepTips() { if (!tipQueue.length || sayTimer > 0 || paused || !started || performance.now() - sayEndT < 4000 || huntHeat > 0) return;   /* never on top of another line, never mid-hunt */ const q = tipQueue.shift(); settings.tips[q.id] = 1; saveSettings(); say(q.text(), q.label === 'TIP' ? 5 : 7, q.label); }
const sayLog = [];   // the last lines the bay said to you, sent along with feedback
function say(text, secs = 3, label = '') { sayLog.push((label ? label + ' · ' : '') + text.replace(/\n/g, ' / ')); if (sayLog.length > 10) sayLog.shift(); storyEl.innerHTML = (label ? `<b>${label}</b>` : '') + text.replace(/</g, '&lt;'); storyEl.style.opacity = 1; sayTimer = secs; }
bl.textContent = keyboardHint();
// the help screen lists your keys as they are bound now, or the touch controls on a phone
function renderHelpKeys() {
  const L = a => keyLabel(B(a)), esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  // each line short enough to fit on one row of a small screen (about 28 characters)
  const rows = MOBILE ? [['TILT', 'lean to turn · tip to dive'], ['HOLD', 'burst, while the dots last'], ['◆', 'sense or echo: finds clams'], ['M', 'map and fast travel'],
    ['⇄', 'become a body you have been'], ['II', 'pause · settings · feedback']]
    : [['MOUSE', 'steer · right button looks'], [`${L('forward')} ${L('back')}`, 'forward · back · ↑ ↓ too'], [`${L('left')} ${L('right')}`, 'turn · ← → too'],
    [`${L('rise')} ${L('dive')}`, 'rise · dive'], [L('burst'), 'burst, while the dots last'], [L('ability'), 'sense or echo: finds clams'], [L('creature'), 'become a body you have been'],
    [`${L('map')} ${L('pause')} ${L('help')}`, 'map · pause · this screen'], [L('photo'), 'photo, at a moment worth it'], [L('feedback'), 'send us a note from here']];
  help.querySelector('.keys').innerHTML = rows.map(([k, d]) => `<b>${esc(k)}</b><span>${esc(d)}</span>`).join('');
}
renderHelpKeys();

const mapXY = (x, z, S) => { const t = TILES.outer; return [(x - t.xmin) / (t.xmax - t.xmin) * S, (z - t.zmin) / (t.zmax - t.zmin) * S]; };
let compassMarks = [];
function drawCompass(landmarks) { compassMarks = landmarks; }
const headingDeg = () => ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360;
const bearingTo = (x, z) => ((Math.atan2(x - P.pos.x, -(z - P.pos.z)) * 180 / Math.PI) % 360 + 360) % 360;

// checkpoints: discovered places you can fast travel to
const checkpoints = [{ name: 'Skyway north', x: START[0], z: START[1] }];
let lastCheckpoint = checkpoints[0];
// what a place is, once, the first time you reach it. all of it is true.
const LORE = {
  'Sunshine Skyway': 'In May 1980 a freighter hit the old span in a squall and 1,200 feet of it fell into the bay. Thirty-five people died.',
  'Skyway main span': 'The new span is held up by cables from two towers. The piers are ringed with rock so no ship can reach them again.',
  'USCGC Blackthorn': 'A Coast Guard buoy tender. In January 1980 it collided with a tanker under the Skyway and capsized. Twenty-three men died. It was sunk out here as a reef.',
  'Egmont Key': 'A lighthouse has stood here since 1848. In 1898 the army built Fort Dade around it for a war with Spain.',
  'Fort Dade ruins': 'The gun batteries of Fort Dade. The beach has eaten into them for a century.',
  'Fort De Soto': 'Built in 1898 to guard the mouth of the bay. Its guns never fired at an enemy.',
  'Johns Pass': 'A hurricane opened this pass in 1848. Nobody dug it.',
  'Gandy Bridge': 'In 1924 it was the first bridge across the bay, and for a while the longest toll bridge in the world.',
  'Howard Frankland': 'The bridge across the middle of the bay. People here call it the Frankenstein.',
  'Courtney Campbell': 'The causeway across the top of Old Tampa Bay, opened in 1934.',
  'Apollo Beach': 'The power plant at Big Bend runs its warm water out here. In a cold snap, hundreds of manatees crowd into it.',
  'Egmont Channel': 'The ship channel is dredged through the pass. Everything that comes into the bay comes through here.',
  'Old Skyway rubble': 'When the old bridge was taken down, some of it was dropped here. Now it is reef.',
};
function restoreCheckpoints(list) { checkpoints.length = 0; checkpoints.push(...list); lastCheckpoint = checkpoints[checkpoints.length - 1] || checkpoints[0]; }   // from a save
function discover(name, x, z) { if (checkpoints.some(c => c.name === name)) return; checkpoints.push({ name, x, z }); nudgeHud(); chimeCheckpoint(); if (LORE[name] && !world.wrecks.some(w => w.name === name)) tip('lore:' + name, () => LORE[name], name.toUpperCase()); tip('map', () => `${kn('map')} opens the chart. travel to any place you have found.`); if (unlocked.size > 1) tip('tab', () => `${kn('tab')} becomes a creature you have been.`); lastCheckpoint = checkpoints[checkpoints.length - 1]; say(`CHECKPOINT · ${name.toUpperCase()}`, 2.5); saveGame(); }
function cameraBehind() { camPos.copy(P.pos).addScaledVector(fwdOf(P.yaw, 0), -6).add(new THREE.Vector3(0, 1.5, 0)); camLook.copy(P.pos); }   /* no swing on arrival */
function travelTo(cp) {
  let x = cp.x, z = cp.z; for (let r = 0; !isWater(x, z, 2.5) && r < 3000; r += 30) { x = cp.x + Math.cos(r * 0.4) * r; z = cp.z + Math.sin(r * 0.4) * r; }
  P.pos.set(x, Math.max(floorAt(x, z) + 1.5, -6), z); P.speed = P.sp.cruise; P.stun = 0; P.air = 1; if (P.vel) P.vel.set(0, 0, 0); cameraBehind(); lastCheckpoint = cp;
}
let mapOpen = false, mapSel = 0;   // the fast-travel chart, and which place on it is picked
function mapKey(code) {   // ↑ ↓ pick a place, ENTER goes there
  if (code === 'ArrowUp') mapSel = Math.max(0, mapSel - 1); if (code === 'ArrowDown') mapSel = Math.min(checkpoints.length - 1, mapSel + 1);
  if (code === 'Enter') { travelTo(checkpoints[mapSel]); toggleMap(); } renderMapList();
}
function toggleMap() { mapOpen = !mapOpen; mapEl.style.display = mapOpen ? 'flex' : 'none'; if (mapOpen) { mapSel = Math.max(0, checkpoints.indexOf(lastCheckpoint)); renderMapList(); } }
function renderMapList() { $('cplist').innerHTML = checkpoints.map((c, i) => `<li class="${i === mapSel ? 'sel' : ''}">${c.name}</li>`).join('');  }

const goalBeam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), mat({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: GLSL_COMMON + `varying vec2 vUv; void main(){ float e = sin(vUv.x * 3.14159); float b = 0.55 * e * e * (1.0 - vUv.y * 0.6) * (0.75 + 0.25 * sin(uTime * 3.0 - vUv.y * 12.0)); gl_FragColor = outB(b); }` }));
goalBeam.frustumCulled = false; goalBeam.visible = false; scene.add(goalBeam);
function stepGoalBeam(t) {
  goalBeam.visible = !!story.goal;
  if (!story.goal) return;
  const [x, z] = story.goal, f = floorAt(x, z), d = Math.hypot(x - camPos.x, z - camPos.z);
  goalBeam.position.set(x, f, z); goalBeam.rotation.y = Math.atan2(camPos.x - x, camPos.z - z);
  goalBeam.scale.set(2 + d * 0.02, Math.max(12, -f + 30), 1);
}
// the readouts, the place you're in, the warning, the compass marks, and the story line's countdown: once a frame
let nearestPoi = '', poiTimer = 0;
function stepHud(dt) {
  const f = lastFloor / vex, [lat, lon] = toLL(P.pos.x, P.pos.z);
  const tide = (P.current || 0) > 0.15 ? `  TIDE ${P.current.toFixed(1)}${tideArrow()}` : '';
  tl.textContent = `DOWN ${Math.max(0, -P.pos.y).toFixed(1)}M  FLOOR ${(-f).toFixed(0)}M  ${P.speed.toFixed(1)}M/S${tide}  ${'♥'.repeat(P.hp)}${P.fed ? '  +' + P.fed : ''}`;
  poiTimer -= dt;
  if (poiTimer < 0) { poiTimer = 0.5; let best = 'Gulf of Mexico', bd = 1e12;
    for (const [plat, plon, name] of POIS) { const [x, z] = toXZ(plat, plon), d = (x - P.pos.x) ** 2 + (z - P.pos.z) ** 2; if (d < bd && d < 2500 ** 2) { bd = d; best = name; } if (d < 350 ** 2 && started) discover(name, x, z); }
    for (const w of world.wrecks) { const d = Math.hypot(w.x - P.pos.x, w.z - P.pos.z); if (d < 22 && started && LORE[w.name]) tip('lore:' + w.name, () => LORE[w.name], w.name.toUpperCase()); if (d < 60) { best = w.name; if (started) discover(w.name, w.x, w.z); } }
    nearestPoi = best; }
  tr.textContent = nearestPoi;
  const { b, d } = nearestBoat(); const danger = b && d < (b.type === BOAT_TYPES.ship ? 220 : 60) && P.pos.y > -2.5;
  const hunter = wild.find(w => w.hunting);
  const L = hunter && hunter.lunge, tele = L ? (L.phase === 'wind' ? `${L.side < 0 ? '◄' : '►'} ${L.side < 0 ? 'LEFT' : 'RIGHT'} · wait` : L.phase === 'lunge' ? 'TURN' : hunter.sp.name.toUpperCase()) : '';
  warn.textContent = danger ? `▲ DIVE` : hunter ? `▲ ${tele}` : ''; warn.style.opacity = danger || hunter ? 1 : 0;
  const landmarks = [];
  if (story.goal) landmarks.push({ name: 'goal', bearing: bearingTo(...story.goal), dist: Math.hypot(story.goal[0] - P.pos.x, story.goal[1] - P.pos.z), goal: true });
  for (const [plat, plon, name] of POIS) { const [x, z] = toXZ(plat, plon), dist = Math.hypot(x - P.pos.x, z - P.pos.z); if (dist < 8000 && dist > 150) landmarks.push({ name, bearing: bearingTo(x, z), dist }); }
  drawCompass(landmarks);
  if (sayTimer > 0) { sayTimer -= dt; if (sayTimer <= 0) { storyEl.style.opacity = 0; sayEndT = performance.now(); } }
}
