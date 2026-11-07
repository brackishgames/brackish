// Every model in the game, on its own: writes models/*.stl (GitHub shows those in its 3D viewer), models/specimens.json (sizes and
// triangle counts, for a person or an AI to check), screenshots/specimens.png (the sheet), and models/README.md.    npm run specimens
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { studio, settled, png, contactSheet } from './lib-shots.mjs';
mkdirSync('models', { recursive: true });
const st = await studio(), page = await st.page();
await page.open(`${st.base}/?test&seed=1&specimens`, { w: 1000, h: 800 });
const ids = await page.eval('SPECIMENS.map(s => s.id)'), report = [], tiles = [], game = [];
await page.eval(`document.querySelector('nav').style.display = 'none'; 1`);
for (const id of ids) {
  const r = await page.eval(`showSpecimen(${JSON.stringify(id)})`); await settled(page, 0.25);
  game.push({ png: await png(page), caption: r.name });
  await page.eval('specimen.raw = true; 1'); await settled(page, 0.25); tiles.push({ png: await png(page), caption: r.name }); await page.eval('specimen.raw = false; 1');
  if (!r.place) { const b64 = await page.eval('specimenStl()'); writeFileSync(`models/${id}.stl`, Buffer.from(b64, 'base64')); r.stl = `${id}.stl`; }
  report.push(r);
}
if (page.errors.length) { console.error(page.errors.join('\n')); process.exit(1); }
writeFileSync('models/specimens.json', JSON.stringify(report, null, 1) + '\n');
writeFileSync('screenshots/specimens.png', Buffer.from(await contactSheet(page, tiles, { cols: 5, width: 320 }), 'base64'));
writeFileSync('screenshots/specimens-in-game.png', Buffer.from(await contactSheet(page, game, { cols: 5, width: 320 }), 'base64'));
const rows = report.filter(r => !r.place).map(r => `| [${r.name}](${r.stl}) | ${r.group} | ${r.size.map(v => v.toFixed(2)).join(' × ')} m | ${r.real ?? ''} | ${r.triangles.toLocaleString('en-US')} |`);
writeFileSync('models/README.md', `# The models\n\nEvery model in the game, built by the code that builds it for the bay. Open any name to turn it in GitHub's 3D viewer. Written by \`npm run specimens\`; don't edit by hand.\n\n<img src="../screenshots/specimens.png" alt="Every model in the game, in plain studio light" width="100%">\n\nAnd as the player sees them:\n\n<img src="../screenshots/specimens-in-game.png" alt="Every model on the game's own dot-matrix display" width="100%">\n\n| Model | Kind | Size (x × y × z) | Real size (m) | Triangles |\n|---|---|---|---|---|\n${rows.join('\n')}\n\nThe last rows of the picture are real places, as built in the bay. To see any of them on the game's own display, from four angles at once: \`node tools/serve.mjs\`, then \`localhost:8000/?dev&specimens\`.\n`);
console.log(`${report.length} specimens: models/README.md, models/specimens.json, screenshots/specimens.png`);
for (const r of report) if (r.real && !r.place) { const big = r.group === 'animals' && /ray/i.test(r.name) ? r.size[0] : r.size[2]; if (Math.abs(big - r.real) / r.real > 0.25) console.log(`  size check: ${r.name} is ${big.toFixed(2)} m, real ${r.real} m`); }   // a ray is measured across the wings; everything else nose to tail
st.done(); process.exit(0);
