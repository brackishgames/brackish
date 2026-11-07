// What taking pictures of the game needs: one browser, one server, and a contact sheet. tools/shot.mjs and tools/specimens.mjs share it.
import { launch } from '../tests/chrome.mjs';
import { serve } from './serve.mjs';
export async function studio() {
  const server = await serve(0), browser = await launch(), base = `http://localhost:${server.address().port}`;
  return { base, page: () => browser.page(), done() { browser.close(); server.close(); } };
}
// a frame or two after anything changed: waits on the game's own clock, never on a guess
export const settled = (page, secs = 0.2) => page.eval('performance.now()').then(t => page.until(`performance.now() > ${t} + ${secs * 1000}`, 'a frame'));
export const png = async page => (await page.cmd('Page.captureScreenshot', { format: 'png' })).data;
// tiles (base64 png + a caption) laid out on one image, drawn by the page itself so there is nothing to install
export async function contactSheet(page, tiles, { cols = 4, width = 480 } = {}) {
  await page.eval(`window.__tiles = []; 1`); for (const t of tiles) await page.eval(`window.__tiles.push(${JSON.stringify(t)}); 1`);
  return page.eval(`(async () => { const imgs = await Promise.all(__tiles.map(t => createImageBitmap(new Blob([Uint8Array.from(atob(t.png), c => c.charCodeAt(0))], { type: 'image/png' }))));
    const w = ${width}, h = Math.round(w * imgs[0].height / imgs[0].width), cap = 22, rows = Math.ceil(imgs.length / ${cols}), c = document.createElement('canvas'); c.width = w * ${cols}; c.height = (h + cap) * rows;
    const g = c.getContext('2d'); g.fillStyle = '#05080c'; g.fillRect(0, 0, c.width, c.height); g.font = '13px ui-monospace, monospace';
    imgs.forEach((im, i) => { const x = (i % ${cols}) * w, y = Math.floor(i / ${cols}) * (h + cap); g.drawImage(im, x, y, w - 2, h); g.fillStyle = '#c8d6e2'; g.fillText(__tiles[i].caption, x + 6, y + h + 15); });
    return c.toDataURL('image/png').split(',')[1]; })()`);
}
