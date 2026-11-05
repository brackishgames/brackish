import * as THREE from 'three';
import { toXZ } from '../lib/geo.js?v=__BUILD__';
import { TUNE } from '../core/tune.js?v=__BUILD__';
// ═══════════════════════════════════════════════════════════════════
//  GEOGRAPHY  —  local metric frame centred on Tampa Bay. 1 unit = 1 m.
//  +x east, −z north, y up, sea level y = 0. Depths are real NOAA values.
// ═══════════════════════════════════════════════════════════════════
export const TILES = {
  outer: { lon0: -83.6, lat0: 27.0, lon1: -82.2, lat1: 28.3, n: 1024 },
  inner: { lon0: -82.9, lat0: 27.45, lon1: -82.3, lat1: 28.1, n: 1024 },
};
for (const t of Object.values(TILES)) { t.xmin = toXZ(0, t.lon0)[0]; t.xmax = toXZ(0, t.lon1)[0]; t.zmin = toXZ(t.lat1, 0)[1]; t.zmax = toXZ(t.lat0, 0)[1]; }
export const DEM_URL = t => `https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/exportImage?bbox=${t.lon0},${t.lat0},${t.lon1},${t.lat1}&bboxSR=4326&imageSR=4326&size=${t.n},${t.n}&format=tiff&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image`;
export const OSM_QUERY = `[out:json][timeout:50];(way["bridge"]["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](27.0,-83.0,28.3,-82.2);way["bridge"]["railway"="rail"](27.0,-83.0,28.3,-82.2););out geom;`;

export const POIS = [
  [27.6205, -82.6555, 'Sunshine Skyway'], [27.600, -82.761, 'Egmont Key'], [27.615, -82.722, 'Fort De Soto'],
  [27.530, -82.735, 'Anna Maria Island'], [27.877, -82.565, 'Gandy Bridge'], [27.945, -82.548, 'Howard Frankland'],
  [27.965, -82.620, 'Courtney Campbell'], [27.85, -82.50, 'MacDill'], [27.78, -82.42, 'Apollo Beach'],
  [27.96, -82.83, 'Clearwater Pass'], [27.68, -82.74, 'Pass-a-Grille'], [27.78, -82.78, 'Johns Pass'],
  [27.75, -82.55, 'Middle Tampa Bay'], [27.92, -82.60, 'Old Tampa Bay'], [27.85, -82.45, 'Hillsborough Bay'],
  [27.52, -82.62, 'Manatee River'], [27.70, -82.50, 'Lower Tampa Bay'], [27.33, -82.60, 'Sarasota Bay'],
  [27.58, -82.90, 'Egmont Channel'], [27.60, -83.10, 'The Shelf'], [27.80, -82.95, 'Gulf of Mexico'],
];
// Fallback bridge alignments (approximate) used only if OpenStreetMap is unreachable.
export const BRIDGES_FALLBACK = [
  { name: 'Sunshine Skyway', pts: [[27.690, -82.657], [27.585, -82.6505]] },
  { name: 'Gandy Bridge', pts: [[27.8768, -82.5885], [27.8780, -82.5370]] },
  { name: 'Howard Frankland', pts: [[27.9195, -82.5765], [27.9575, -82.5290]] },
  { name: 'Courtney Campbell', pts: [[27.9670, -82.6700], [27.9640, -82.5790]] },
];
// Tampa ship channel, Egmont entrance to Port Tampa (approximate centreline; the dredged cut is in the DEM).
export const CHANNEL = [[27.595, -82.86], [27.600, -82.765], [27.612, -82.700], [27.6205, -82.6555], [27.660, -82.610], [27.730, -82.560], [27.800, -82.500], [27.850, -82.450]].map(p => toXZ(...p));
// Unsettling places (approximate): wrecks and reef rubble on the bottom.
export const WRECKS = [
  { ll: [27.605, -82.74], name: 'The Barge', kind: 'ship', s: 0.35 }, { ll: [27.577, -82.78], name: 'Egmont wreck', kind: 'cruiser', s: 1.6 },
  { ll: [27.645, -82.655], name: 'Old Skyway rubble', kind: 'rubble' }, { ll: [27.598, -82.652], name: 'Old Skyway rubble', kind: 'rubble' },
  { ll: [27.70, -82.95], name: 'Shelf wreck', kind: 'ship', s: 0.6 }, { ll: [27.56, -82.97], name: 'Deep reef', kind: 'rubble' },
  { ll: [27.86, -82.49], name: 'Hillsborough hulk', kind: 'cruiser', s: 2.2 }, { ll: [27.93, -82.63], name: 'Old Tampa Bay skiff', kind: 'cruiser', s: 1 },
  // real places (positions approximate): the cutter Blackthorn, sunk off the Skyway in 1980 and later scuttled as a Gulf reef; Fort Dade's batteries falling into the Gulf off Egmont Key
  { ll: [27.897, -83.193], name: 'USCGC Blackthorn', kind: 'ship', s: 0.32, rest: 0.4 }, { ll: [27.6045, -82.7655], name: 'Fort Dade ruins', kind: 'ruins' },
];
// the Sunshine Skyway main span: two cable-stayed pylons in the ship channel, ringed by the protective dolphins added after 1980
export const SKYWAY = { center: [27.6205, -82.6555], axis: [[27.690, -82.657], [27.585, -82.6505]], span: 366, dolphins: 18 };
export const ANCHORAGE = [{ ll: [27.592, -82.82], yaw: 1.9 }];   // tankers waiting off Egmont
export const FEVER_PATH = [[27.607, -82.7535], [27.600, -82.800], [27.592, -82.850], [27.580, -82.910], [27.565, -82.980]].map(p => toXZ(...p));   // Egmont hole, out the Egmont Channel, onto the shelf
export const START = toXZ(27.607, -82.751);   // chapter I: the Egmont pass

// ═══════════════════════════════════════════════════════════════════
//  DATA  —  NOAA float TIFFs + OSM bridges, cached in IndexedDB.
// ═══════════════════════════════════════════════════════════════════
export const bar = document.getElementById('bar'), loadmsg = document.getElementById('loadmsg');
export const within = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);   // storage must never hang the load
export function idb() { return within(TUNE.guards.storageMs, new Promise((res, rej) => { const r = indexedDB.open('brackish', 1); r.onupgradeneeded = () => r.result.createObjectStore('dem'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked')); })); }
export async function cached(key, fetcher) {
  let db = null; try { db = await idb(); } catch { return fetcher(); }
  const hit = await within(TUNE.guards.storageMs, new Promise(res => { const rq = db.transaction('dem').objectStore('dem').get(key); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(undefined); })).catch(() => undefined);
  if (hit) return hit;
  const v = await fetcher();
  try { db.transaction('dem', 'readwrite').objectStore('dem').put(v, key); } catch {}
  return v;
}
export async function fetchBuf(url, onProgress) {
  const r = await fetch(url); if (!r.ok) throw new Error(new URL(url, location.href).pathname.split('/').pop() + ' ' + r.status);
  const total = +r.headers.get('content-length') || 0, reader = r.body.getReader(), chunks = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(total ? got / total : 0); }
  const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}
export function tileSample(t, x, z) {
  const u = (x - t.xmin) / (t.xmax - t.xmin) * (t.w - 1), v = (z - t.zmin) / (t.zmax - t.zmin) * (t.h - 1);
  const x0 = Math.max(0, Math.min(t.w - 2, Math.floor(u))), y0 = Math.max(0, Math.min(t.h - 2, Math.floor(v)));
  const fx = Math.min(1, Math.max(0, u - x0)), fy = Math.min(1, Math.max(0, v - y0)), d = t.data, w = t.w;
  const a = d[y0 * w + x0], b = d[y0 * w + x0 + 1], c = d[(y0 + 1) * w + x0], e = d[(y0 + 1) * w + x0 + 1];
  return (a + (b - a) * fx) * (1 - fy) + (c + (e - c) * fx) * fy;
}
export let vex = 1;
export function floorAt(x, z) {
  const i = TILES.inner, m = 300;
  const t = (x > i.xmin + m && x < i.xmax - m && z > i.zmin + m && z < i.zmax - m) ? i : TILES.outer;
  return tileSample(t, x, z) * vex;
}
export const isWater = (x, z, min = 1.5) => floorAt(x, z) < -min;

// ═══════════════════════════════════════════════════════════════════
//  BAY  —  the game's own API for the real world. Physics, spawns, the
//  seafloor, the charts and the HUD all read the bay through this one
//  object, so there is one source of truth for depth, water and tide.
//  Sources: NOAA NCEI bathymetry (depth), NOAA CO-OPS (live tide, water
//  temperature, tidal current predictions), OpenStreetMap (bridges).
// ═══════════════════════════════════════════════════════════════════
export const NOAA = {
  api: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
  tideStation: { id: '8726520', name: 'ST. PETERSBURG' },
  // tidal current prediction stations across the bay (id, lat, lon)
  currentStations: [['ACT8401', 27.6005, -82.8677], ['ACT8411', 27.6043, -82.7603], ['ACT8416', 27.5617, -82.7673], ['ACT8421', 27.6045, -82.7238],
    ['ACT8441', 27.6083, -82.694], ['ACT8466', 27.6388, -82.6255], ['ACT8476', 27.6112, -82.5945], ['ACT8486', 27.6605, -82.6417], ['ACT8521', 27.7245, -82.6097],
    ['ACT8536', 27.7253, -82.5357], ['ACT8551', 27.837, -82.5732], ['ACT8566', 27.8792, -82.5805], ['ACT8576', 27.9258, -82.5862], ['ACT8586', 27.786, -82.522], ['ACT8596', 27.846, -82.4437]],
  url: (q) => `${NOAA.api}?${q}&units=metric&time_zone=gmt&format=json&application=brackish`,
};
export const Bay = {
  floor: (x, z) => floorAt(x, z),                       // metres, negative below sea level
  depth: (x, z) => Math.max(0, -floorAt(x, z)),
  isWater: (x, z, min = 1.5) => floorAt(x, z) < -min,
  live: { ok: false, level: null, rising: null, next: null, temp: null, stations: [], updated: null },
  // ── tidal current: live NOAA predictions near stations, a modelled channel flow elsewhere
  current(x, z, out) {
    out.set(0, 0, 0); let wsum = 0;
    const now = Date.now();
    for (const st of this.live.stations) {
      const v = st.at(now); if (!v) continue;
      const d2 = (x - st.x) ** 2 + (z - st.z) ** 2; if (d2 > 7000 ** 2) continue;
      const w = 1 / (d2 + 600 ** 2); out.x += v.x * w; out.z += v.z * w; wsum += w;
    }
    if (wsum > 0) { const near = Math.min(1, wsum * 1500 ** 2); out.multiplyScalar(near / wsum); return out; }
    return modelCurrent(x, z, out);
  },
  // ── charts: one renderer for the minimap and the fast-travel map, styled like a NOAA chart in dots
  chart(cx, cz, span, S, out = new Uint8Array(S * S)) {
    const step = span / S, x0 = cx - span / 2, z0 = cz - span / 2, d = new Float32Array(S * S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) d[j * S + i] = -floorAt(x0 + (i + 0.5) * step, z0 + (j + 0.5) * step);
    const band = v => v < 0 ? -1 : v < 2 ? 0 : v < 5 ? 1 : v < 10 ? 2 : v < 20 ? 3 : 4;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const k = j * S + i, v = d[k], b = band(v);
      if (b < 0) { const coast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => { const ii = i + a, jj = j + c; return ii >= 0 && jj >= 0 && ii < S && jj < S && d[jj * S + ii] > 0; });
        out[k] = coast ? 240 : 70; continue; }   // land lit, coast bright   // land: a solid lit mass, the way a chart prints it
      const edge = [[1, 0], [0, 1]].some(([a, c]) => { const ii = i + a, jj = j + c; return ii < S && jj < S && band(d[jj * S + ii]) !== b && band(d[jj * S + ii]) >= 0; });
      out[k] = edge ? [0, 40, 34, 28, 22][b] : 0;   // open water dark; only the 2, 5, 10, 20 m contours show   // water dark, deeper darker, faint contours at 2, 5, 10 and 20 m
    }
    return out;
  },
  toChart(x, z, cx, cz, span, S) { return [(x - (cx - span / 2)) / span * S, (z - (cz - span / 2)) / span * S]; },
  // ── live NOAA data, cached for an hour, never blocks the game
  async loadLive() {
    const key = 'brackish.noaa', hour = 36e5;
    let data = null;
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < hour) data = c.d; } catch {}
    if (!data) {
      const get = async q => { const r = await within(TUNE.guards.liveMs, fetch(NOAA.url(q))); if (!r.ok) throw new Error('noaa ' + r.status); return r.json(); };
      const day = new Date(), ymd = d => d.toISOString().slice(0, 10).replace(/-/g, ''), y = new Date(day - 864e5), t2 = new Date(+day + 864e5);
      const range = `begin_date=${ymd(y)}&end_date=${ymd(t2)}`, st = NOAA.tideStation.id;
      const queries = [`product=water_level&datum=MLLW&date=latest&station=${st}`, `product=predictions&datum=MLLW&interval=hilo&${range}&station=${st}`,
        `product=water_temperature&date=latest&station=${st}`, ...NOAA.currentStations.map(([id]) => `product=currents_predictions&${range}&interval=30&station=${id}`)];
      const results = new Array(queries.length); let next = 0;   // four at a time: NOAA turns away bursts
      await Promise.all(Array.from({ length: 4 }, async () => { while (next < queries.length) { const i = next++; try { results[i] = { value: await get(queries[i]) }; } catch { results[i] = {}; } } }));
      const [lvl, hilo, temp, ...cur] = results;
      data = { lvl: lvl.value, hilo: hilo.value, temp: temp.value, cur: cur.map(c => c.value || null) };
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch {}
    }
    this.applyLive(data);
  },
  applyLive(data) {
    const L = this.live, gmt = s => Date.parse(s.replace(' ', 'T') + 'Z');
    const lv = data.lvl?.data?.[0]; if (lv) { L.level = +lv.v; L.updated = gmt(lv.t); }
    const t = data.temp?.data?.[0]; if (t && t.v !== '') L.temp = +t.v;
    const preds = data.hilo?.predictions || [], now = Date.now(), nxt = preds.find(p => gmt(p.t) > now);
    if (nxt) { L.next = { type: nxt.type === 'H' ? 'HIGH' : 'LOW', at: gmt(nxt.t), v: +nxt.v }; L.rising = nxt.type === 'H'; }
    L.stations = [];
    data.cur.forEach((res, i) => {
      const cp = res?.current_predictions?.cp; if (!cp || !cp.length) return;
      const [id, lat, lon] = NOAA.currentStations[i], [x, z] = toXZ(lat, lon);
      const pts = cp.map(p => { const v = +p.Velocity_Major / 100, dir = (v >= 0 ? +p.meanFloodDir : +p.meanEbbDir) * Math.PI / 180, s = Math.abs(v);
        return { t: gmt(p.Time), x: Math.sin(dir) * s, z: -Math.cos(dir) * s }; }).sort((a, b) => a.t - b.t);
      L.stations.push({ id, x, z, at(now) { if (now < pts[0].t || now > pts[pts.length - 1].t) return null;
        let k = 1; while (pts[k].t < now) k++; const a = pts[k - 1], b = pts[k], u = (now - a.t) / Math.max(1, b.t - a.t), e = 0.5 - 0.5 * Math.cos(Math.PI * u);   // eased between predictions
        return { x: a.x + (b.x - a.x) * e, z: a.z + (b.z - a.z) * e }; } });
    });
    L.ok = L.level != null || L.stations.length > 0;
  },
};
// a modelled flow along the ship channel, used where no NOAA station is close
export function modelCurrent(x, z, out) {
  let best = 1e9, bx = 0, bz = 0;
  for (let i = 0; i + 1 < CHANNEL.length; i++) {
    const [ax, az] = CHANNEL[i], [cx, cz] = CHANNEL[i + 1], dx = cx - ax, dz = cz - az, L2 = dx * dx + dz * dz;
    const u = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1), px = ax + dx * u, pz = az + dz * u, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; const L = Math.sqrt(L2); bx = dx / L; bz = dz / L; }
  }
  const k = 0.45 * Math.sin(dayClock * 2 * Math.PI / 12.4) * Math.exp(-best / 900);
  return out.set(bx * k, 0, bz * k);
}
