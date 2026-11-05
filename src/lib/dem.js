// The bay's depths as shipped with the game: a tiny header, then int16 centimetres (±327 m, which the bay never leaves).
//   'BDEM' · u16 version · u16 w · u16 h · u16 0 · int16[w*h] little-endian
const MAGIC = 0x4d454442;   // 'BDEM'
export function encodeDem(w, h, data) {
  const buf = new ArrayBuffer(12 + w * h * 2), dv = new DataView(buf);
  dv.setUint32(0, MAGIC, true); dv.setUint16(4, 1, true); dv.setUint16(6, w, true); dv.setUint16(8, h, true);
  for (let i = 0; i < w * h; i++) dv.setInt16(12 + i * 2, Math.max(-32767, Math.min(32767, Math.round(data[i] * 100))), true);
  return buf;
}
export function decodeDem(buf) {
  const dv = new DataView(buf); if (dv.getUint32(0, true) !== MAGIC) throw new Error('not a BDEM file');
  const w = dv.getUint16(6, true), h = dv.getUint16(8, true), data = new Float32Array(w * h);
  if (buf.byteLength < 12 + w * h * 2) throw new Error('truncated BDEM file');
  for (let i = 0; i < w * h; i++) data[i] = dv.getInt16(12 + i * 2, true) / 100;
  return { w, h, data };
}
