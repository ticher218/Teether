
/* Allarbaa.cloud — Safe static-asset cache */
const CACHE = 'allarbaa-static-v2';
const OLD_CACHES = ['teesher-v1'];

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => OLD_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache API data, blog pages, or navigation documents.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/p/') ||
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/sitemap.xml' ||
    url.pathname === '/feed.xml' ||
    url.pathname === '/robots.txt'
  ) {
    return;
  }

  // Cache static assets only.
  if (!/\.(css|js|png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(url.pathname)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return Response.error();
      })
  );
});
