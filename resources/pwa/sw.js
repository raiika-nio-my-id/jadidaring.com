/* Jadidaring service worker. Network-first, no content caching.
   Only the offline fallback page (+ logo) is precached. Bump VERSION to roll a new worker. */
const VERSION = 'v1';
const CACHE = 'jd-offline-' + VERSION;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/marketing/images/logo-mark-light.svg'];

// Never intercepted: APIs, admin, auth/OAuth, realtime sockets, game rooms.
const SKIP = /^\/(api|admin|auth|masuk|daftar|keluar|app|apps|rt|game|sw\.js|up)(\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('jd-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return; // sub-resources go straight to the network
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || SKIP.test(url.pathname)) return;

  event.respondWith(
    fetch(req).catch(() => caches.open(CACHE).then((c) => c.match(OFFLINE_URL)).then((r) => r || Response.error()))
  );
});
