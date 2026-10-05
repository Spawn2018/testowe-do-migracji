/* Watch Tower — PWA (§14). CACHE bump przy każdej zmianie precache / offline. */
const CACHE = 'wt-static-v2026-10-05-push';
const PRECACHE = [
  '/',
  '/offline.html',
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

function isApiOrAuth(url) {
  const p = url.pathname;
  if (p.startsWith('/rest/') || p.startsWith('/auth/') || p.startsWith('/functions/') || p.startsWith('/realtime/') || p.startsWith('/storage/')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isApiOrAuth(url)) return;

  /* Nawigacja (HTML) — sieć najpierw; offline → offline.html */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/offline.html').then((h) => h || caches.match('/'))),
    );
    return;
  }

  /* Statyczne brand / offline — cache first */
  if (url.pathname.startsWith('/brand/') || url.pathname === '/offline.html' || url.pathname === '/sw.js') {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        void caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
