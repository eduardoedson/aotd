import http from 'node:http';
import webpush from 'web-push';
import { createStore } from './store.js';
import { collectMediaIds, fetchNextEpisodes, findReleases, updateTracker } from './releases.js';

const {
  PORT = '3100',
  HOST = '127.0.0.1',
  DATA_DIR = './data',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:admin@eduardoalves.tech',
  ALLOWED_ORIGIN = 'https://aotd.eduardoalves.tech',
  REFRESH_MINUTES = '15',
} = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID keys. Run "npm run generate-vapid" and set the variables.');
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const MAX_BODY_BYTES = 16 * 1024;
const MAX_MEDIA_IDS = 500;
const MAX_SUBSCRIPTIONS = 50000;
const CHECK_INTERVAL_MS = 60 * 1000;
const REFRESH_INTERVAL_MS = Number(REFRESH_MINUTES) * 60 * 1000;

const store = await createStore(DATA_DIR);

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(body === undefined ? '' : JSON.stringify(body));
};

const readJson = (request) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    request.on('error', reject);
  });

const isValidSubscription = (value) => {
  if (!value || typeof value !== 'object') return false;
  try {
    const url = new URL(value.endpoint);
    if (url.protocol !== 'https:') return false;
  } catch {
    return false;
  }
  return typeof value.keys?.p256dh === 'string' && typeof value.keys?.auth === 'string';
};

const sanitizeIds = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((id) => Number.isInteger(id) && id > 0))].slice(0, MAX_MEDIA_IDS)
    : null;

// Browsers always send Origin on cross site POST requests; reject foreign pages.
const isAllowedOrigin = (request) => {
  const origin = request.headers.origin;
  return !origin || origin === ALLOWED_ORIGIN;
};

async function handle(request, response) {
  const { pathname } = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && pathname === '/api/push/public-key') {
    return sendJson(response, 200, { publicKey: VAPID_PUBLIC_KEY });
  }

  if (pathname !== '/api/push/subscription') return sendJson(response, 404, { error: 'Not found' });
  if (!isAllowedOrigin(request)) return sendJson(response, 403, { error: 'Forbidden' });

  if (request.method === 'POST') {
    const body = await readJson(request);
    const mediaIds = sanitizeIds(body.mediaIds);
    if (!isValidSubscription(body.subscription) || !mediaIds) {
      return sendJson(response, 400, { error: 'Invalid subscription' });
    }
    const known = Boolean(store.data.subscriptions[body.subscription.endpoint]);
    if (!known && Object.keys(store.data.subscriptions).length >= MAX_SUBSCRIPTIONS) {
      return sendJson(response, 503, { error: 'Subscription limit reached' });
    }
    await store.upsertSubscription(
      { endpoint: body.subscription.endpoint, keys: body.subscription.keys },
      mediaIds,
    );
    refreshSoon();
    return sendJson(response, 204);
  }

  if (request.method === 'DELETE') {
    const body = await readJson(request);
    if (typeof body.endpoint === 'string') await store.removeSubscription(body.endpoint);
    return sendJson(response, 204);
  }

  return sendJson(response, 405, { error: 'Method not allowed' });
}

async function sendReleases(now = Date.now()) {
  const { releases, tracker } = findReleases(store.data.tracker, now);
  if (releases.length === 0) return;
  await store.setTracker(tracker);

  const deliveries = [];
  Object.values(store.data.subscriptions).forEach((entry) => {
    releases
      .filter((release) => entry.mediaIds.includes(release.mediaId))
      .forEach((release) => {
        deliveries.push(
          webpush
            .sendNotification(entry.subscription, JSON.stringify(release.payload), {
              TTL: 6 * 60 * 60,
            })
            .catch((error) => {
              // 404 and 410 mean the browser dropped the subscription.
              if (error.statusCode === 404 || error.statusCode === 410) {
                return store.removeSubscription(entry.subscription.endpoint);
              }
              console.error('Push delivery failed', error.statusCode ?? error.message);
              return undefined;
            }),
        );
      });
  });
  await Promise.all(deliveries);
  console.log(`Sent ${deliveries.length} notification(s) for ${releases.length} release(s)`);
}

async function refreshTracker(now = Date.now()) {
  await sendReleases(now);
  const ids = collectMediaIds(store.data.subscriptions);
  if (ids.length === 0) return;
  const media = await fetchNextEpisodes(ids);
  await store.setTracker(updateTracker(store.data.tracker, media, ids, now));
}

let refreshTimer = null;
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTracker().catch((error) => console.error('Refresh failed', error.message));
  }, 5000);
}

const server = http.createServer((request, response) => {
  handle(request, response).catch((error) => {
    sendJson(response, error.status ?? 500, {
      error: error.status ? error.message : 'Server error',
    });
    if (!error.status) console.error(error);
  });
});

server.listen(Number(PORT), HOST, () => {
  console.log(`AOTD push server listening on http://${HOST}:${PORT}`);
});

refreshTracker().catch((error) => console.error('Initial refresh failed', error.message));
setInterval(() => {
  refreshTracker().catch((error) => console.error('Refresh failed', error.message));
}, REFRESH_INTERVAL_MS);
setInterval(() => {
  sendReleases().catch((error) => console.error('Release check failed', error.message));
}, CHECK_INTERVAL_MS);

const shutdown = () => {
  server.close(() => store.persist().finally(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
