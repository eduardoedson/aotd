// AOTD service worker: caches the app shell so it opens offline, shows Web Push
// notifications and handles their clicks. Bump CACHE_VERSION to drop old caches.
const CACHE_VERSION = 'aotd-v3';
// Small values shared with the page (the current push endpoint). Never versioned.
const META_CACHE = 'aotd-meta';
const PUSH_ENDPOINT_KEY = '/__aotd/push-endpoint';
// Hashed assets from older deploys are dropped after this long or past this count.
const ASSET_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ASSET_MAX_ENTRIES = 120;
const PUSH_API = '/api/push';
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

// Removes cached build assets that are too old, then the oldest ones above the limit.
const trimAssets = async () => {
  const cache = await caches.open(CACHE_VERSION);
  const requests = (await cache.keys()).filter((request) =>
    new URL(request.url).pathname.startsWith('/assets/'),
  );
  const now = Date.now();
  const dated = await Promise.all(
    requests.map(async (request) => {
      const response = await cache.match(request);
      const date = Date.parse(response?.headers.get('date') ?? '');
      return { request, time: Number.isNaN(date) ? 0 : date };
    }),
  );
  dated.sort((a, b) => b.time - a.time);
  await Promise.all(
    dated
      .filter((entry, index) => index >= ASSET_MAX_ENTRIES || now - entry.time > ASSET_MAX_AGE_MS)
      .map((entry) => cache.delete(entry.request)),
  );
};

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION && key !== META_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(trimAssets)
      .catch(() => {})
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

let assetsTrimmed = false;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    // A long lived worker may never activate again, so it also trims once per start.
    if (!assetsTrimmed) {
      assetsTrimmed = true;
      event.waitUntil(trimAssets().catch(() => {}));
    }
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(handleAsset(request));
  } else {
    event.respondWith(handleStatic(request));
  }
});

// Notifications sent by the AOTD push server (server/).
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'AOTD', {
      body: payload.body || 'A new episode is out!',
      icon: payload.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag,
      data: { url: payload.url || '/' },
    }),
  );
});

// Opens the episode page: reuses a tab this worker controls when there is one,
// otherwise (or when navigating that tab fails) opens a new window.
const openTarget = async (target) => {
  const controlled = await self.clients.matchAll({ type: 'window' });
  const existing = controlled.find((client) => client.url.startsWith(self.location.origin));
  if (existing) {
    try {
      const focused = await existing.focus();
      const navigated = await focused.navigate(target);
      if (navigated) return navigated;
    } catch {
      // Falls through to a new window below.
    }
  }
  return self.clients.openWindow(target);
};

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(openTarget(target));
});

const readStoredEndpoint = async () => {
  const cache = await caches.open(META_CACHE);
  const response = await cache.match(PUSH_ENDPOINT_KEY);
  return response ? response.text() : null;
};

const storeEndpoint = async (endpoint) => {
  const cache = await caches.open(META_CACHE);
  await cache.put(PUSH_ENDPOINT_KEY, new Response(endpoint));
};

const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

// The browser replaced or expired the push subscription. A new one is created and
// sent with the old endpoint, so the server moves the favorites to it. Without
// this, notifications would stop until the visitor opened AOTD again.
const renewSubscription = async (event) => {
  const oldEndpoint = event.oldSubscription?.endpoint || (await readStoredEndpoint());
  if (!oldEndpoint) return;

  let subscription = event.newSubscription;
  if (!subscription) {
    const response = await fetch(`${PUSH_API}/public-key`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;
    const { publicKey } = await response.json();
    if (!publicKey) return;
    subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const response = await fetch(`${PUSH_API}/subscription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON(), oldEndpoint }),
  });
  if (response.ok) await storeEndpoint(subscription.endpoint);
};

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(renewSubscription(event).catch(() => {}));
});
