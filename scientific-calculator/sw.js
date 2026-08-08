const CACHE_PREFIX = "scientific-calculator-";
const CACHE_NAME = CACHE_PREFIX + "v1.1.1";
const APP_SHELL = ["./", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      const response = await fetch("./");
      if (!response.ok) throw new Error("App shell request failed");
      const html = await response.clone().text();
      const assets = Array.from(
        html.matchAll(/(?:src|href)=["']([^"']+)["']/g),
        (match) => match[1],
      )
        .map((asset) => new URL(asset, self.registration.scope))
        .filter(
          (asset) =>
            asset.origin === self.location.origin &&
            (asset.pathname.includes("/assets/") ||
              asset.pathname.includes("/_next/static/")),
        )
        .map((asset) => asset.href);
      if (assets.length) await cache.addAll([...new Set(assets)]);
      await cache.put("./", response);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./", copy));
          }
          return response;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
