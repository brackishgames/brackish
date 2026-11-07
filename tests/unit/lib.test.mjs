import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, hash2 } from '../../src/lib/rng.js';
import { toXZ, toLL } from '../../src/lib/geo.js';
import { wrap } from '../../src/lib/text.js';
import { encodeDem, decodeDem } from '../../src/lib/dem.js';
import { tiltAngles, ramp } from '../../src/lib/tilt.js';
import { sealSave, openSave, migrateSave, SAVE_VERSION } from '../../src/lib/save.js';
import { makeGrid, pushOut } from '../../src/lib/collide.js';
import { buildReport, issueUrl, defang } from '../../src/lib/feedback.js';

test('a seed replays the same rolls', () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const ra = Array.from({ length: 5 }, a), rb = Array.from({ length: 5 }, b);
  assert.deepEqual(ra, rb); assert.notDeepEqual(ra, Array.from({ length: 5 }, c));
  for (const v of ra) assert.ok(v >= 0 && v < 1);
});
test('hash2 is fixed per cell and in range', () => {
  assert.equal(hash2(3, 9), hash2(3, 9)); assert.notEqual(hash2(3, 9), hash2(9, 3));
  for (let i = 0; i < 200; i++) { const h = hash2(i * 7, -i); assert.ok(h >= 0 && h < 1); }
});
test('the map frame round-trips and points the right way', () => {
  const [x, z] = toXZ(27.6205, -82.6555), [lat, lon] = toLL(x, z);
  assert.ok(Math.abs(lat - 27.6205) < 1e-9 && Math.abs(lon + 82.6555) < 1e-9);
  assert.ok(toXZ(27.75, -82.5)[0] > 0, 'east is +x'); assert.ok(toXZ(27.8, -82.55)[1] < 0, 'north is -z');
  assert.deepEqual(toXZ(27.75, -82.55), [0, -0]);
});
test('wrap keeps lines within the width and loses no words', () => {
  const s = 'In May 1980 a freighter hit the old span in a squall and 1,200 feet of it fell into the bay.';
  for (const max of [12, 20, 40]) { const lines = wrap(s, max); for (const l of lines) assert.ok(l.length <= max, `${l} > ${max}`); assert.equal(lines.join(' '), s); }
  assert.deepEqual(wrap('a\n\nb', 10), ['a', '', 'b']);
});
test('the shipped depth format keeps centimetres', () => {
  const data = Float32Array.from([0, -25.37, 12.5, -0.01, -327.67, 1.234]);
  const back = decodeDem(encodeDem(3, 2, data));
  assert.equal(back.w, 3); assert.equal(back.h, 2);
  data.forEach((v, i) => assert.ok(Math.abs(back.data[i] - v) <= 0.005, `${back.data[i]} vs ${v}`));
  assert.throws(() => decodeDem(new ArrayBuffer(16)), /BDEM/);
});
test('tilt: leaning the phone like a wheel turns, tipping it dives', () => {
  // held sideways (screen angle 90), standing up, tipped back 40°
  const level = tiltAngles(0, -50, 90);
  assert.ok(Math.abs(level.lean) < 1e-6);
  assert.ok(tiltAngles(20, -50, 90).lean < -0.3, 'wheel turned right: lean goes negative (right)');
  assert.ok(tiltAngles(-20, -50, 90).lean > 0.3, 'wheel turned left');
  assert.ok(tiltAngles(0, -20, 90).pitch > level.pitch, 'top tipped away from you: pitch grows (dive)');
  assert.ok(Math.abs(tiltAngles(0, 50, 270).lean) < 1e-6, 'the other landscape is level too');
  assert.equal(ramp(0.05, 0.06, 0.45), 0); assert.equal(ramp(1, 0.06, 0.45), 1); assert.equal(ramp(-1, 0.06, 0.45), -1);
});
test('saves: sealed, refused when edited, carried forward from v1', async () => {
  const raw = await sealSave({ v: SAVE_VERSION, ch: 2, hp: 4, sta: 0.5 }, 'salt');
  assert.equal((await openSave(raw, 'salt')).ch, 2);
  const bad = JSON.parse(raw); bad.json = bad.json.replace('"ch":2', '"ch":9');
  await assert.rejects(openSave(JSON.stringify(bad), 'salt'), /signature/);
  await assert.rejects(openSave(raw, 'other salt'), /signature/);
  const old = migrateSave({ v: 1, ch: 4 }); assert.equal(old.v, SAVE_VERSION); assert.equal(old.hp, 3); assert.equal(old.ch, 4);
  assert.equal(migrateSave({ v: 99 }), null); assert.equal(migrateSave(null), null);
});
test('collision: pushed out of pilings and turned boxes, not out of what is above you', () => {
  const pile = { kind: 'c', x: 0, z: 0, r: 1.2, y0: -10, y1: 3 };
  const hit = pushOut(pile, 0.5, -2, 0, 0.4); assert.ok(hit); assert.ok(Math.abs(Math.hypot(hit.x, hit.z) - 1.6) < 1e-9); assert.equal(hit.nx, 1);
  assert.equal(pushOut(pile, 3, -2, 0, 0.4), null, 'clear of it'); assert.equal(pushOut(pile, 0.5, -12, 0, 0.4), null, 'below its foot');
  const pier = { kind: 'b', x: 10, z: 10, hx: 7, hz: 4.5, yaw: Math.PI / 2, y0: -20, y1: 60 };
  // turned a quarter, the pier's long side runs along z
  const h2 = pushOut(pier, 10, 0, 15, 0.5); assert.ok(h2, 'inside along its long side'); assert.ok(Math.abs(h2.z - 17.5) < 1e-9 && Math.abs(h2.nz - 1) < 1e-9);
  assert.equal(pushOut(pier, 16, 0, 10, 0.5), null, 'outside its short side');
  const g = makeGrid(40); g.add(pile); g.add(pier); assert.ok(g.near(1, 1).includes(pile)); assert.ok(g.near(12, 14).includes(pier)); assert.equal(g.near(500, 500).length, 0);
});
test('feedback reports: no pings, no escaping, fit in a link', () => {
  assert.equal(defang('hi @joe ```x```'), "hi @​joe '''x'''");
  const r = buildReport('the shark @everyone\nsecond line', { version: '0.1.0-beta.1', chapter: 'III', said: ['a'], errors: ['TypeError: x'] });
  assert.equal(r.title, 'Feedback: the shark @\u200beveryone');
  assert.ok(r.details.includes('chapter: III') && r.details.includes('version: 0.1.0-beta.1') && r.details.includes('  TypeError: x'));
  assert.ok(r.body.startsWith('### What happened?\n\nthe shark') && r.body.includes('### Game details\n\n```text\nversion: 0.1.0-beta.1'), 'laid out like the issue form');
  assert.deepEqual(r.labels, ['feedback', 'beta']); assert.equal(buildReport('', { version: 'x' }, 'error').labels[0], 'crash');
  const u = new URL(issueUrl(r)); assert.equal(u.searchParams.get('template'), 'feedback.yml'); assert.equal(u.searchParams.get('what'), r.what); assert.equal(u.searchParams.get('details'), r.details);
  const long = issueUrl({ ...r, details: 'x'.repeat(20000) }); assert.ok(long.length <= 7000); assert.equal(new URL(long).searchParams.get('what'), r.what, 'the details give way before the note');
});

import { seaState, readObservation, waveNumber } from '../../src/lib/sea.js';
test('waves grow with wind and fetch, and stay within what the bay makes', () => { const calm = seaState(2), blow = seaState(12); assert.ok(blow.height > calm.height * 3); assert.ok(blow.height > 0.5 && blow.height < 1.6, `${blow.height} m in a stiff wind`); assert.ok(blow.period > 2.5 && blow.period < 6); assert.ok(Math.abs(waveNumber(8) - (2 * Math.PI / 8) ** 2 / 9.81) < 1e-9); });
test('a weather observation reads into rain, cloud and wind', () => { const r = readObservation({ presentWeather: [{ weather: 'rain', intensity: 'heavy' }], windSpeed: { value: 36 }, windDirection: { value: 300 }, cloudLayers: [{ amount: 'OVC' }], textDescription: 'Heavy Rain' }); assert.equal(r.rain, 1); assert.equal(r.cloud, 1); assert.equal(r.wind, 10); const c = readObservation({ presentWeather: [], windSpeed: { value: null }, cloudLayers: [{ amount: 'CLR' }] }); assert.equal(c.rain, 0); assert.equal(c.wind, 0); });
