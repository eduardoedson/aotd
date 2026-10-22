// HTTP API of the push server. It has no side effects on import, so tests can
// create it with an in memory store and call it without opening a port.

export const MAX_BODY_BYTES = 16 * 1024;
const MAX_MEDIA_IDS = 500;
const MAX_SUBSCRIPTIONS = 50000;

// Push services of the browsers AOTD supports. Subscriptions pointing anywhere
// else are refused, so the server never sends requests to arbitrary hosts.
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
];

export function isAllowedPushEndpoint(endpoint, extraHosts = []) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return extraHosts.includes(host) || PUSH_SERVICE_HOSTS.some((pattern) => pattern.test(host));
}

const isValidKeys = (keys) =>
  Boolean(keys) &&
  typeof keys.p256dh === 'string' &&
  typeof keys.auth === 'string' &&
  keys.p256dh.length > 0 &&
  keys.p256dh.length <= 200 &&
  keys.auth.length > 0 &&
  keys.auth.length <= 100;

const sanitizeIds = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((id) => Number.isInteger(id) && id > 0))].slice(0, MAX_MEDIA_IDS)
    : null;

// Fixed window counter per key, kept in memory. Old windows are dropped as they expire.
export function createRateLimiter({ max, windowMs, now = () => Date.now() }) {
  const windows = new Map();
  let lastSweep = now();

  const sweep = (time) => {
    if (time - lastSweep < windowMs) return;
    lastSweep = time;
    windows.forEach((entry, key) => {
      if (time - entry.start >= windowMs) windows.delete(key);
    });
  };

  return {
    take(key) {
      const time = now();
      sweep(time);
      const entry = windows.get(key);
      if (!entry || time - entry.start >= windowMs) {
        windows.set(key, { start: time, count: 1 });
        return true;
      }
      if (entry.count >= max) return false;
      entry.count += 1;
      return true;
    },
  };
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Behind nginx every request comes from the loopback address, so the visitor IP is
// read from X-Real-IP. The header is only trusted when nginx is the direct peer.
export function getClientIp(request) {
  const peer = request.socket?.remoteAddress ?? '';
  const forwarded = request.headers['x-real-ip'];
  if (LOOPBACK.has(peer) && typeof forwarded === 'string' && forwarded) return forwarded.trim();
  return peer || 'unknown';
}

const sendJson = (response, status, body, headers = {}) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(body === undefined ? '' : JSON.stringify(body));
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

const readJson = (request) =>
  new Promise((resolve, reject) => {
    const declared = Number(request.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      reject(httpError(413, 'Body too large'));
      return;
    }
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(httpError(413, 'Body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(httpError(400, 'Invalid JSON'));
      }
    });
    request.on('error', reject);
  });

/**
 * @param {object} options
 * @param {object} options.store Store created by createStore.
 * @param {string} options.publicKey VAPID public key sent to browsers.
 * @param {string[]} options.allowedOrigins Origins allowed to change subscriptions.
 * @param {() => void} [options.onSubscriptionsChanged] Called after a successful change.
 * @param {string[]} [options.extraPushHosts] Extra push hosts, used by tests.
 * @param {{ take: (key: string) => boolean }} [options.requestLimiter]
 * @param {{ take: (key: string) => boolean }} [options.newSubscriptionLimiter]
 */
export function createApp({
  store,
  publicKey,
  allowedOrigins,
  onSubscriptionsChanged = () => {},
  extraPushHosts = [],
  requestLimiter = createRateLimiter({ max: 60, windowMs: 10 * 60 * 1000 }),
  newSubscriptionLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60 * 1000 }),
}) {
  const origins = new Set(allowedOrigins);

  const isValidSubscription = (value) =>
    Boolean(value) &&
    typeof value === 'object' &&
    isAllowedPushEndpoint(value.endpoint, extraPushHosts) &&
    isValidKeys(value.keys);

  async function upsert(request, response, ip) {
    const body = await readJson(request);
    const { subscription } = body;
    if (!isValidSubscription(subscription)) {
      return sendJson(response, 400, { error: 'Invalid subscription' });
    }

    const { subscriptions } = store.data;
    const known = Boolean(subscriptions[subscription.endpoint]);
    const oldEndpoint = typeof body.oldEndpoint === 'string' ? body.oldEndpoint : null;
    const previous = oldEndpoint ? subscriptions[oldEndpoint] : null;

    // The service worker sends this when the browser replaced the subscription.
    // It has no access to the favorites, so they are moved from the old entry.
    let mediaIds = sanitizeIds(body.mediaIds);
    if (!mediaIds && previous) mediaIds = previous.mediaIds;
    if (!mediaIds) {
      if (oldEndpoint) return sendJson(response, 404, { error: 'Unknown subscription' });
      return sendJson(response, 400, { error: 'Invalid subscription' });
    }

    if (!known && !previous) {
      if (Object.keys(subscriptions).length >= MAX_SUBSCRIPTIONS) {
        return sendJson(response, 503, { error: 'Subscription limit reached' });
      }
      if (!newSubscriptionLimiter.take(ip)) {
        return sendJson(response, 429, { error: 'Too many requests' }, { 'Retry-After': '3600' });
      }
    }

    const cleanSubscription = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    };
    if (previous && oldEndpoint !== subscription.endpoint) {
      await store.update((data) => {
        delete data.subscriptions[oldEndpoint];
        data.subscriptions[subscription.endpoint] = {
          subscription: cleanSubscription,
          mediaIds,
          updatedAt: Date.now(),
          sent: {
            ...(previous.sent ?? {}),
            ...(data.subscriptions[subscription.endpoint]?.sent ?? {}),
          },
        };
      });
    } else {
      await store.upsertSubscription(cleanSubscription, mediaIds);
    }
    onSubscriptionsChanged();
    return sendJson(response, 204);
  }

  async function remove(request, response) {
    const body = await readJson(request);
    if (typeof body.endpoint === 'string') await store.removeSubscription(body.endpoint);
    return sendJson(response, 204);
  }

  async function handle(request, response) {
    const { pathname } = new URL(request.url, 'http://localhost');

    if (request.method === 'GET' && pathname === '/api/push/public-key') {
      return sendJson(response, 200, { publicKey });
    }

    if (pathname !== '/api/push/subscription')
      return sendJson(response, 404, { error: 'Not found' });
    if (request.method !== 'POST' && request.method !== 'DELETE') {
      return sendJson(response, 405, { error: 'Method not allowed' }, { Allow: 'POST, DELETE' });
    }

    // Browsers always send Origin on POST and DELETE, also from the service worker.
    // A missing Origin means the request does not come from the AOTD pages.
    if (!origins.has(request.headers.origin))
      return sendJson(response, 403, { error: 'Forbidden' });

    const ip = getClientIp(request);
    if (!requestLimiter.take(ip)) {
      return sendJson(response, 429, { error: 'Too many requests' }, { 'Retry-After': '600' });
    }

    return request.method === 'POST' ? upsert(request, response, ip) : remove(request, response);
  }

  return (request, response) => {
    handle(request, response).catch((error) => {
      if (response.headersSent) return;
      sendJson(response, error.status ?? 500, {
        error: error.status ? error.message : 'Server error',
      });
      if (!error.status) console.error(error);
    });
  };
}
