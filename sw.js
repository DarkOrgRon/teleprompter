/* ============================================================
   sw.js – Service Worker
   Macht die App offline nutzbar. Es werden ausschliesslich
   die eigenen Dateien zwischengespeichert; es gibt keine
   Verbindung zu fremden Servern.
   ============================================================ */

/* Bei jeder Aktualisierung der App hochzaehlen,
   damit Geraete die neue Fassung sicher erhalten. */
var CACHE_NAME = 'teleprompter-v1';

var PRECACHE = [
  './',
  'index.html',
  'style.css',
  'js/store.js',
  'js/recorder.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (name !== CACHE_NAME) return caches.delete(name);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;

  // Nur eigene Dateien behandeln
  var url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Seitenaufrufe: erst Netz, sonst gespeicherte Startseite
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match('index.html').then(function (cached) {
          return cached || caches.match('./');
        });
      })
    );
    return;
  }

  // Dateien: erst Cache, dann Netz (und ins Cache nachlegen)
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });
    })
  );
});
