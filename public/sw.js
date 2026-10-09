// Same-origin, network-first PWA shell only. No geocoding/API/user-data caching.
const CACHE_NAME = "uniride-angular-v3.2.1";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/assets/Logo_UniRide.webp",
  "/assets/uniride-icon-192.png",
  "/assets/uniride-icon-512.png",
  "/assets/campus-autonoma-nocturno.webp",
  "/assets/campus-autonoma-diurno.webp",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("uniride-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }
  if (
    !url.pathname.startsWith("/assets/") &&
    !url.pathname.match(/\.(?:js|css|webmanifest)$/)
  )
    return;
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then(async (response) => {
          if (response.ok) {
            const copy = response.clone();
            try {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(req, copy);
            } catch (error) {
              console.warn("UniRide: no se pudo actualizar la cache", error);
            }
          }
          return response;
        }),
    ),
  );
});
