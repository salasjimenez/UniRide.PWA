// UniRide Angular PWA. Static same-origin assets only; no caching of route or user APIs.
// Works at localhost:4200/ and https://salasjimenez.github.io/UniRide.PWA/.
const CACHE_NAME = 'uniride-angular-pages-v1';
const SCOPE_URL = new URL(self.registration.scope);
const BASE_PATH = SCOPE_URL.pathname;
const APP_URL = new URL('./', SCOPE_URL).href;
const STATIC_ASSETS = [
  './',
  'manifest.webmanifest',
  'assets/Logo_UniRide.webp',
  'assets/uniride-icon-192.png',
  'assets/uniride-icon-512.png',
  'assets/campus-autonoma-nocturno.webp',
  'assets/campus-autonoma-diurno.webp',
].map((path) => new URL(path, SCOPE_URL).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('uniride-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return;

  if (request.mode === 'navigate') {
    // Network-first: latest HTML when online, cached application shell when offline.
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone(); // Clone before awaiting cache operations.
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(APP_URL, copy);
          } catch (error) {
            console.warn('UniRide: no se pudo almacenar el HTML', error);
          }
        }
        return response;
      } catch (error) {
        const cached = await caches.match(APP_URL);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  const isStatic = url.pathname.startsWith(`${BASE_PATH}assets/`) ||
    /\.(?:js|css|webmanifest)$/.test(url.pathname);
  if (!isStatic) return;

  // Cache-first for versioned bundles/images; never store external API responses.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone(); // Prevent Response body is already used.
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, copy);
      } catch (error) {
        console.warn('UniRide: no se pudo actualizar la cache', error);
      }
    }
    return response;
  })());
});
