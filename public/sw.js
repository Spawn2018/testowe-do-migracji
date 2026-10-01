/* Watch Tower — PWA cache (BRAND-15 / §14). Podbij CACHE przy zmianie ikon/manifestu. */
const CACHE = 'wt-static-v2026-10-01';
const PRECACHE = [
  '/',
  '/brand/manifest.webmanifest',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/icon-maskable-192.png',
  '/brand/icon-maskable-512.png',
  '/brand/favicon.ico',
  '/brand/watchtower-symbol.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/brand/') || url.pathname === '/brand/manifest.webmanifest') {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
        const copy = res.clone();
        void caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      })),
    );
  }
});
