/* Service worker: downloads the whole game once and then always serves it from the cache,
 * so it works with no internet connection.
 * Bump VERSION whenever any file changes, so installed devices fetch the new copy. */
const VERSION = 'v2';
const CACHE = 'excretory-wheel-' + VERSION;
const FILES = [
  './',
  './index.html',
  './styles.css',
  './words.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES.map(f => new Request(f, {cache: 'reload'}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('excretory-wheel-') && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => {
      if(hit) return hit;
      return fetch(req).catch(() => {
        if(req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
