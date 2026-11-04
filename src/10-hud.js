'use strict';
// ═══════════════════════════════════════════════════════════════════
//  HUD  —  readouts, compass tape, minimap, fast-travel map, story text
// ═══════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const tl = $('tl'), tr = $('tr'), bl = $('bl'), warn = $('warn'), storyEl = $('story'), flash = $('flash'), help = $('help'), mapEl = $('map');
const mini = $('mini'), mctx = mini.getContext('2d'), cmp = $('compass'), cctx = cmp.getContext('2d'), big = $('bigmap'), bctx = big.getContext('2d');
let sayTimer = 0;
const tipQueue = [];
function tip(id, text, label = 'TIP') { if (settings.tips[id] || tipQueue.some(q => q.id === id)) return; tipQueue.push({ id, text, label }); }
function stepTips() { if (!tipQueue.length || sayTimer > 0 || paused || !started || performance.now() - sayEndT < 4000 || huntHeat > 0) return;   /* never on top of another line, never mid-hunt */ const q = tipQueue.shift(); settings.tips[q.id] = 1; saveSettings(); say(q.text(), q.label === 'TIP' ? 5 : 7, q.label); }
function say(text, secs = 3, label = '') { storyEl.innerHTML = (label ? `<b>${label}</b>` : '') + text.replace(/</g, '&lt;'); storyEl.style.opacity = 1; sayTimer = secs; }
bl.textContent = 'WASD swim   SPACE rise   C dive   SHIFT burst   E ability   M map   H help';

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
function discover(name, x, z) { if (checkpoints.some(c => c.name === name)) return; checkpoints.push({ name, x, z }); hudWakeT = WU.uTime.value; chimeCheckpoint(); if (LORE[name]) tip('lore:' + name, () => LORE[name], name.toUpperCase()); tip('map', () => `${kn('map')} opens the chart. travel to any place you have found.`); if (unlocked.size > 1) tip('tab', () => `${kn('tab')} becomes a creature you have been.`); lastCheckpoint = checkpoints[checkpoints.length - 1]; say(`CHECKPOINT · ${name.toUpperCase()}`, 2.5); saveGame(); }
function cameraBehind() { camPos.copy(P.pos).addScaledVector(fwdOf(P.yaw, 0), -6).add(new THREE.Vector3(0, 1.5, 0)); camLook.copy(P.pos); }   /* no swing on arrival */
function travelTo(cp) {
  let x = cp.x, z = cp.z; for (let r = 0; !isWater(x, z, 2.5) && r < 3000; r += 30) { x = cp.x + Math.cos(r * 0.4) * r; z = cp.z + Math.sin(r * 0.4) * r; }
  P.pos.set(x, Math.max(floorAt(x, z) + 1.5, -6), z); P.speed = P.sp.cruise; P.stun = 0; P.air = 1; if (P.vel) P.vel.set(0, 0, 0); cameraBehind(); lastCheckpoint = cp;
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
