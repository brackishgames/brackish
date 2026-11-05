// Fetch the bay's bathymetry from NOAA NCEI once and write it into data/, so the game never needs NOAA to start.
//   node tools/fetch-dem.mjs          (run again only if the tile bounds in src/01-geo.js change)
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { parseTiffF32 } from '../src/lib/tiff.js';
import { encodeDem, decodeDem } from '../src/lib/dem.js';
// the tile bounds live in the game; read them from there so the two can never disagree
const src = readFileSync(new URL('../src/01-geo.js', import.meta.url), 'utf8');
const TILES = Object.fromEntries([...src.matchAll(/(\w+): \{ lon0: ([-\d.]+), lat0: ([-\d.]+), lon1: ([-\d.]+), lat1: ([-\d.]+), n: (\d+) \}/g)].map(m => [m[1], { lon0: +m[2], lat0: +m[3], lon1: +m[4], lat1: +m[5], n: +m[6] }]));
if (!TILES.outer || !TILES.inner) throw new Error('could not find TILES in src/01-geo.js');
const url = t => `https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/exportImage?bbox=${t.lon0},${t.lat0},${t.lon1},${t.lat1}&bboxSR=4326&imageSR=4326&size=${t.n},${t.n}&format=tiff&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image`;
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
for (const [name, t] of Object.entries(TILES)) {
  process.stdout.write(`${name}: downloading… `);
  const r = await fetch(url(t)); if (!r.ok) throw new Error(`NOAA ${r.status}`);
  const { w, h, data } = parseTiffF32(await r.arrayBuffer());
  const out = encodeDem(w, h, data), check = decodeDem(out);
  let worst = 0; for (let i = 0; i < data.length; i++) worst = Math.max(worst, Math.abs(check.data[i] - data[i]));
  let lo = 0, hi = 0; for (const v of data) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  writeFileSync(new URL(`../data/dem-${name}.bdem`, import.meta.url), Buffer.from(out));
  console.log(`${w}×${h}, ${lo.toFixed(1)} m to ${hi.toFixed(1)} m, worst rounding ${(worst * 100).toFixed(2)} cm, ${(out.byteLength / 1e6).toFixed(1)} MB`);
}
