// very small cache-first SW
const CACHE = 'mileage-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS.filter(Boolean));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE && caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  e.respondWith((async () => {
    const cache = await caches.match(req);
    if (cache) return cache;
    try {
      const res = await fetch(req);
      // 同一オリジンのみキャッシュ
      if (new URL(req.url).origin === self.origin) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      return cache || Response.error();
    }
  })());
});

