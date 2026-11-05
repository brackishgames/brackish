// A float32 GeoTIFF reader: just enough for NOAA's DEM exports (strips or tiles, uncompressed).
export function parseTiffF32(buf) {
  const dv = new DataView(buf), le = dv.getUint16(0, false) === 0x4949;
  const u16 = o => dv.getUint16(o, le), u32 = o => dv.getUint32(o, le);
  const ifd = u32(4), n = u16(ifd), tags = {}, SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 12: 8 };
  for (let i = 0; i < n; i++) { const o = ifd + 2 + i * 12, tag = u16(o), type = u16(o + 2), count = u32(o + 4); tags[tag] = { type, count, off: SZ[type] * count <= 4 ? o + 8 : u32(o + 8) }; }
  const vals = t => { const g = tags[t]; if (!g) return null; const a = []; for (let i = 0; i < g.count; i++) a.push(g.type === 3 ? u16(g.off + i * 2) : u32(g.off + i * 4)); return a; };
  const w = vals(256)[0], h = vals(257)[0];
  if (vals(258)[0] !== 32 || (vals(259) || [1])[0] !== 1) throw new Error('unexpected TIFF layout');
  const out = new Float32Array(w * h);
  const copy = (src, dx, dy, bw, bh) => { for (let y = 0; y < bh && dy + y < h; y++) for (let x = 0; x < bw && dx + x < w; x++) out[(dy + y) * w + dx + x] = dv.getFloat32(src + (y * bw + x) * 4, le); };
  if (tags[324]) { const tw = vals(322)[0], th = vals(323)[0], tilesX = Math.ceil(w / tw); vals(324).forEach((off, i) => copy(off, (i % tilesX) * tw, Math.floor(i / tilesX) * th, tw, th)); }
  else { const rps = (vals(278) || [h])[0]; vals(273).forEach((off, i) => copy(off, 0, i * rps, w, rps)); }
  for (let i = 0; i < out.length; i++) if (!Number.isFinite(out[i]) || Math.abs(out[i]) > 12000) out[i] = 0;
  return { w, h, data: out };
}
