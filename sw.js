/* DM Hub Service Worker — Offline-First Relative-Path Cache */
const CACHE_NAME = 'dm-hub-v11';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './css/tokens.css',
  './css/layout.css',
  './css/components.css',
  './js/data/srd-data.js',
  './js/data/name-data.js',
  './js/core/dice-engine.js',
  './js/core/store.js',
  './js/core/backup-manager.js',
  './js/ui/ui-utils.js',
  './js/ui/overview-view.js',
  './js/ui/encounter-view.js',
  './js/ui/roller-view.js',
  './js/ui/roll-log-view.js',
  './js/ui/prep-view.js',
  './js/ui/notes-view.js',
  './js/ui/settings-view.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
