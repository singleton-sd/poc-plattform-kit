// PWA service worker stub. No offline caching strategy yet -- just enough
// to be installable and registered. Expand per pillar as SPA routes land.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Pass-through for now -- no cache strategy yet.
});
