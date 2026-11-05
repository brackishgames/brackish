'use strict';
// ═══════════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════════
async function loadBridges() {
  try { if (Date.now() - (+localStorage.getItem('brackish.osmTry') || 0) < 864e5 && !localStorage.getItem('brackish.osmOk')) return; localStorage.setItem('brackish.osmTry', Date.now()); } catch {}   // a failing mirror is tried at most once a day
  try {
    const txt = await cached('osm-bridges-v1', async () => { const ac = new AbortController(); setTimeout(() => ac.abort(), TUNE.guards.osmMs);
      const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(OSM_QUERY), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ac.signal });
      if (!r.ok) throw new Error('overpass ' + r.status); return await r.text(); });
    const els = JSON.parse(txt).elements.filter(e => e.type === 'way' && e.geometry);
    const out = [];
    for (const e of els) { const pts = e.geometry.map(g => toXZ(g.lat, g.lon)); let len = 0, wet = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (len < 150) continue; for (const [x, z] of pts) if (floorAt(x, z) < -0.3) wet++; if (wet / pts.length < 0.4) continue;
      out.push({ name: e.tags?.name || 'bridge', pts }); }
    if (out.length < 3) throw new Error('too few bridges');
    setBridges(out); try { localStorage.setItem('brackish.osmOk', '1'); } catch {}
  } catch (e) { return; }   // OpenStreetMap is optional; the built-in bridges stay
  for (const b of bridges) { if (b.name === 'bridge') continue; const [x, z] = b.pts[Math.floor(b.pts.length / 2)]; if (!POIS.some(p => p[2] === b.name)) { const [lat, lon] = toLL(x, z); POIS.push([lat, lon, b.name]); } }
}
let booting = true;
function loadLoop() {   // until the world is ready, the display shows only the panel layer
  if (!booting) return; requestAnimationFrame(loadLoop);
  renderer.setRenderTarget(lowRT); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.setRenderTarget(null); drawPanel(); composer.render();
}
async function boot() {
  resize(); loadLoop();
  const prog = [0, 0];
  const load = async (name, i) => {
    const t = TILES[name];
    const progress = p => { prog[i] = p; bar.style.width = ((prog[0] + prog[1]) / 2 * 100) + '%'; };
    let dem;   // the depths ship with the game (tools/fetch-dem.mjs); NOAA is only asked if that copy can't be had
    try { dem = decodeDem(await fetchBuf(`data/dem-${name}.bdem?v=${BUILD}`, progress)); }
    catch (e) { if (TEST) throw e; console.warn('shipped depths unavailable, asking NOAA:', e.message); dem = parseTiffF32(await cached(`${name}-v1-${t.n}`, () => fetchBuf(DEM_URL(t), progress))); }
    const { w, h, data } = dem; Object.assign(t, { w, h, data });
    const half = new Uint16Array(w * h); for (let k = 0; k < data.length; k++) half[k] = THREE.DataUtils.toHalfFloat(data[k]);
    const tex = new THREE.DataTexture(half, w, h, THREE.RedFormat, THREE.HalfFloatType); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true; return tex;
  };
  loadmsg.textContent = 'LOADING THE BAY';
  try { const [o, i] = await Promise.all([load('outer', 0), load('inner', 1)]); demUniforms.uDemO.value = o; demUniforms.uDemI.value = i; }
  catch (e) { loadmsg.textContent = 'DEPTHS UNREACHABLE: ' + e.message; throw e; }
  bar.style.width = '100%';
  const stage = async (msg, fn) => { loadmsg.textContent = msg; try { await fn(); } catch (e) { loadmsg.textContent = 'ERROR IN ' + msg + ': ' + e.message; console.error(e); throw e; } };
  setBridges(BRIDGES_FALLBACK.map(b => ({ name: b.name, pts: b.pts.map(p => toXZ(...p)) })));
  await stage('BUILDING STRUCTURES', () => buildStructures());
  if (DEV) { for (const sp of SPECIES) unlocked.add(sp.id);
    for (const [lat, lon, name] of POIS) { const [x, z] = toXZ(lat, lon); if (!checkpoints.some(c => c.name === name)) checkpoints.push({ name, x, z }); }
    for (const w of world.wrecks) if (!checkpoints.some(c => c.name === w.name)) checkpoints.push({ name: w.name, x: w.x, z: w.z }); }
  if (!TEST) Bay.loadLive().then(() => { const L = Bay.live; if (L.ok) $('noaaline').textContent = `LIVE · NOAA ${NOAA.tideStation.name} · ${L.temp != null ? L.temp.toFixed(1) + '°C' : ''}${L.next ? ' · ' + L.next.type + ' TIDE ' + new Date(L.next.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}`; }).catch(() => {});   // live NOAA tide, temperature and currents arrive in the background
  // OpenStreetMap bridges arrive in the background and replace the fallback set
  if (!TEST) loadBridges().then(() => { try { buildStructures(); } catch (e) { console.error(e); } });
  for (let r = 0; !isWater(P.pos.x, P.pos.z, 3) && r < 4000; r += 25) { P.pos.x = START[0] + Math.cos(r * 0.3) * r; P.pos.z = START[1] + Math.sin(r * 0.3) * r; }
  P.pos.y = Math.max(floorAt(P.pos.x, P.pos.z) * 0.4, -8); day.hour = CHAPTERS[0].clock ?? day.hour; if (DEV && new URLSearchParams(location.search).has('clock')) day.hour = +new URLSearchParams(location.search).get('clock');   // ?dev&clock=22 to explore at night
  await loadSaved();
  setTitleHint(); { const [, base, beta] = (document.querySelector('meta[name=version]')?.content || '').match(/^([\d.]+)(?:-beta\.(\d+))?/) || []; $('ver').textContent = base ? base + (beta != null ? ' beta ' + beta : '') : ''; }   // 0.1.0-beta.3 reads as 0.1.0 BETA 3: still being built, and saying so
  await stage('WAKING THE BAY', () => { if (loadedSave) applySave(loadedSave); else { becomeSpecies(speciesById.cownose); cameraBehind(); } rebuildGrass(P.pos.x, P.pos.z); resize(); });
  $('load').classList.add('gone'); whenFaded($('load'), 0, () => { if (!started) $('title').classList.remove('gone'); });   // one card out, then the next in (unless you've already begun)
  booting = false; frame(); bootDone();
  if ('serviceWorker' in navigator && !LOCAL) navigator.serviceWorker.register('sw.js').catch(() => {});   // offline play on the published site; never on your machine, where it would only get in the way
}
boot().catch(e => { console.error(e); logError('boot: ' + (e?.stack || e)); });
