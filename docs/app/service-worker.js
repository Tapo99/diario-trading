// ============================================================
// Cachea el shell de la app para que funcione sin internet.
// Estrategia: red primero, cache como respaldo solo si no hay
// conexion. Asi, cuando el dispositivo tiene internet (el caso
// normal), siempre se usa la version mas nueva de inmediato en
// vez de esperar a que el service worker viejo se actualice solo.
// ============================================================
const CACHE_NAME = "diario-trading-v20";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./db.js",
  "./activation.js",
  "./wizard.js",
  "./diario.js",
  "./stats.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca interceptar llamadas al Apps Script (necesitan red real).
  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
