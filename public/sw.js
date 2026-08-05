// Service worker de la PWA — cachea los ARCHIVOS de la app (HTML/JS/íconos)
// para que abra sin internet una vez instalada. Esto es independiente del
// offline-first de los DATOS (localStorage + Supabase, ver modules/store.js)
// — ese ya funcionaba sin esto; lo que faltaba era que la propia app (el
// archivo index.html y sus scripts) pudiera cargar sin red la primera vez
// que no hay conexión.
//
// Estrategia: red primero, caché como respaldo. Nunca al revés — con los
// query strings de cache-busting que ya usa cada <script src="...?v=fecha">,
// servir de caché primero arriesgaría mostrar código viejo estando online.
// Solo cuando la red falla de verdad (sin conexión) se usa lo cacheado.
//
// No hace falta precachear los ~39 módulos de renders/ a mano: en la
// primera visita con internet, cada uno se cachea solo la primera vez que
// el navegador lo pide (línea "cachear respuesta exitosa" más abajo) — para
// la segunda visita ya está todo, con o sin conexión.
const CACHE_VERSION = 'smp-centinela-v1';
const ARCHIVOS_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) { return cache.addAll(ARCHIVOS_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  // Nunca intercepta llamadas a otros orígenes (Supabase, Resend, Sentry,
  // Google Fonts) — esas siempre van a la red real, o fallan visiblemente
  // si no hay conexión. Solo se cachean los archivos propios de la app.
  if (url.origin !== location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).then(function (resp) {
      if (resp && resp.ok) {
        var copia = resp.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(event.request, copia); });
      }
      return resp;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        return cached || caches.match('./index.html');
      });
    })
  );
});
