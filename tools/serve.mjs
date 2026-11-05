// A local server that never lets the browser keep an old copy, so an edit always shows on reload.
//   node tools/serve.mjs [port]      then open http://localhost:8000/  (add ?dev or ?test)
import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { extname, join, normalize } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.bdem': 'application/octet-stream', '.md': 'text/plain; charset=utf-8' };
export function serve(port) { return new Promise(ok => { const srv = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, ''), file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body); }
  catch { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); }
}); srv.listen(port, () => ok(srv)); }); }
if (process.argv[1] === new URL(import.meta.url).pathname) { const port = +process.argv[2] || 8000; await serve(port); console.log(`brackish on http://localhost:${port}/`); }
