/* Rooster Club Command Center — service worker
   Goal: make the admin installable + usable offline for the shell,
   while NEVER caching live data (Supabase stays network-only). */
/* BUMP THIS ON EVERY DEPLOY that changes the shell. The activate handler
   deletes every cache whose name isn't the current one, so changing the string
   is what actually evicts a stale shell from an already-installed browser. */
const CACHE = 'rcc-shell-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  // cache:'reload' = fetch fresh from the server, not a browser-cached old copy.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Live data + auth: always hit the network, never cache.
  if (req.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;

  // App navigations: network-first, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      // Keep the offline copy current: every successful online open refreshes it,
      // so an offline launch never asks for code files that no longer exist.
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
