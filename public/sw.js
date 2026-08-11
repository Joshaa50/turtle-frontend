// Runtime-caching service worker for offline field use. Bump CACHE_VERSION
// whenever shell assets (index.html, manifest, icon) change.
const CACHE_VERSION = 'turtle-portal-v1';
const SCOPE = self.registration.scope.endsWith('/') ? new URL(self.registration.scope).pathname : new URL(self.registration.scope).pathname + '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.add(SCOPE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache API calls to the backend - those are handled by the app's
  // own offline queue, and stale cached responses here would be actively harmful.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so users get fresh content when online, falling
  // back to the cached shell when offline (patchy signal on the beach at dawn).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(SCOPE, copy));
          return response;
        })
        .catch(() => caches.match(SCOPE))
    );
    return;
  }

  // Static assets (JS/CSS/images/fonts): cache-as-you-go, stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});
