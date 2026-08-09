const CACHE_PREFIX = 'uma-log-ai-';
const CACHE_NAME = `${CACHE_PREFIX}shell-v1.2.0`;
const APP_SHELL = ['./', './index.html', './styles.css?v=120', './engine.js?v=120', './demo-data.js?v=120', './app.js?v=120', './learning-worker.js?v=120', './data/races.json', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/data/races.json')) {
    const canonicalDataRequest = new Request(new URL('./data/races.json', self.location.href));
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(canonicalDataRequest, response.clone());
      }
      return response;
    }).catch(() => caches.match(canonicalDataRequest)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
    }
    return response;
  })));
});
