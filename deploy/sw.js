/* Cache shell so iPad works offline after first open (no Mac needed) */
const CACHE = 'urge-quiz-kiosk-v12';
const ASSETS = [
  './',
  './index.html',
  './fonts/bc-normal-800.ttf',
  './fonts/bc-italic-800.ttf',
  './fonts/montserrat-500.ttf',
  './assets/pack-antistress.jpg',
  './assets/pack-electrolyte.jpg',
  './assets/logo-small.png',
  './assets/logo-large.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const url = new URL(event.request.url);
      const isHtml =
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('/') ||
        url.pathname.endsWith('urge-quiz-kiosk');
      if (isHtml) {
        return fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          })
          .catch(() => cached || caches.match('./index.html'));
      }
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
