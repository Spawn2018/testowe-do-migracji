/* Watch Tower — PWA (§14). CACHE bump przy każdej zmianie precache / offline. */
/* C16: push ack, pushsubscriptionchange, notificationclick openWindow, icon/badge */
const CACHE = 'wt-static-v2026-10-15-c16-push';
const PRECACHE = [
  '/',
  '/offline.html',
  '/brand/manifest.webmanifest',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/icon-maskable-192.png',
  '/brand/icon-maskable-512.png',
  '/brand/badge-96.png',
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
  if (event.data && event.data.type === 'WT_PUSH_CFG' && event.data.resubUrl) {
    void caches.open(CACHE).then((c) => c.put(
      '/__wt_push_cfg',
      new Response(JSON.stringify({ resubUrl: event.data.resubUrl }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    ));
  }
});

async function ackDelivery(data) {
  const nid = data && data.nid;
  const ack = data && data.ack;
  const ackUrl = data && data.ack_url;
  if (!nid || !ack || !ackUrl) return;
  try {
    await fetch(ackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nid, ack, sid: data.sid || undefined }),
    });
  } catch { /* potwierdzenie nie blokuje wyświetlenia */ }
}

self.addEventListener('push', (event) => {
  let data = { title: 'Watch Tower', body: '', url: '/', tag: 'wt' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* treść pusta */ }
  const ts = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Watch Tower', {
      body: data.body || '',
      tag: data.tag || 'wt',
      data: { url: data.url || '/', nid: data.nid, ack: data.ack, sid: data.sid },
      icon: '/brand/icon-192.png',
      badge: '/brand/badge-96.png',
      timestamp: ts,
      renotify: true,
    }).then(() => ackDelivery(data)),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/';
  const target = new URL(raw, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const c of clientList) {
        if ('focus' in c) {
          try {
            if ('navigate' in c) await c.navigate(target);
          } catch { /* okno niekontrolowane przez SW — openWindow poniżej */ }
          try { return await c.focus(); } catch { /* dalej */ }
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const oldEp = event.oldSubscription && event.oldSubscription.endpoint;
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) c.postMessage({ type: 'WT_PUSH_RESYNC' });
    try {
      const opts = event.oldSubscription && event.oldSubscription.options
        ? event.oldSubscription.options
        : { userVisibleOnly: true };
      const sub = await self.registration.pushManager.subscribe(opts);
      const json = sub.toJSON();
      const cfgRes = await caches.match('/__wt_push_cfg');
      const cfg = cfgRes ? await cfgRes.json() : null;
      if (!cfg || !cfg.resubUrl || !oldEp || !json.endpoint || !json.keys) return;
      await fetch(cfg.resubUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_endpoint: oldEp,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        }),
      });
    } catch { /* syncWebPush przy starcie aplikacji */ }
  })());
});
