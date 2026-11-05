// Offline play: every file from this site is fetched fresh when the network is there (so a deploy is never stale),
// and kept, so the next visit works without it. Data from NOAA and OpenStreetMap is left alone: the game copes without it.
const CACHE = 'brackish-__BUILD__';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);   // an old deploy's files go
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try { const r = await fetch(e.request); if (r.ok) cache.put(e.request, r.clone()); return r; }
    catch { return (await cache.match(e.request, { ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('.html') })) || Response.error(); }
  })());
});
