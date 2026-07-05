// sw.js — Service Worker for the offline Enumerator App.
// Caches the app shell on first (online) load so the app OPENS and WORKS
// with zero network afterwards. Must be served from the site root so its
// scope covers the whole app.

const CACHE_NAME = 'voiceinsights-enumerator-v2';
const SHELL_FILES = [
  '/enumerator.html',
  '/manifest.json',
  '/assets/img/icon-192.png',
  '/assets/img/icon-512.png',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/assets/js/config.js',
  '/assets/js/offline-db.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for the app shell so it loads instantly offline.
// Everything else (API calls) goes to the network as normal — we WANT
// those to fail loudly offline so the app knows to queue locally.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isShellFile = SHELL_FILES.some((f) => url.pathname === f) || url.pathname === '/';

  if (isShellFile) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
  // Non-shell requests (API calls to the Worker) are left alone — no caching,
  // no interception. If there's no network, they simply fail and the app
  // catches that and stores the data locally instead.
});
