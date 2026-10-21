// AOTD service worker: caches the app shell so it opens offline and handles
// notification clicks. Bump CACHE_VERSION to force old caches to be dropped.
const CACHE_VERSION = 'aotd-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

const putInCache = async (request, response) => {
  if (!response || !response.ok || response.type === 'opaque') return response;
  const cache = await caches.open(CACHE_VERSION);
  await cache.put(request, response.clone());
  return response;
};

// Pages: try the network first so new deploys show up, fall back to the cached shell.
const handleNavigation = async (request) => {
  try {
    const response = await fetch(request);
    await putInCache('/index.html', response.clone());
    return response;
  } catch {
    const cached = await caches.match('/index.html');
    return cached || Response.error();
  }
};

// Hashed build assets never change, so the cache can answer first.
const handleAsset = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  return putInCache(request, response);
};

// Other same origin files: network first with cache fallback.
const handleStatic = async (request) => {
  try {
    const response = await fetch(request);
    return await putInCache(request, response);
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(handleAsset(request));
  } else {
    event.respondWith(handleStatic(request));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        return existing.focus().then((client) => client.navigate?.(target) ?? client);
      }
      return self.clients.openWindow(target);
    }),
  );
});
