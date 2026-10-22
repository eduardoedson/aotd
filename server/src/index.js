import http from 'node:http';
import webpush from 'web-push';
import { createApp } from './app.js';
import { createStore } from './store.js';
import {
  applyDeliveries,
  collectMediaIds,
  deliverReleases,
  fetchNextEpisodes,
  findReleases,
  updateTracker,
} from './releases.js';

const {
  PORT = '7115',
  HOST = '127.0.0.1',
  DATA_DIR = './data',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:admin@eduardoalves.tech',
  // Comma separated, e.g. "https://aotd.eduardoalves.tech,http://localhost:7115".
  ALLOWED_ORIGIN = 'https://aotd.eduardoalves.tech',
  REFRESH_MINUTES = '15',
} = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID keys. Run "npm run setup-env" or "npm run generate-vapid".');
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const CHECK_INTERVAL_MS = 60 * 1000;
const REFRESH_INTERVAL_MS = Number(REFRESH_MINUTES) * 60 * 1000;
// Subscription changes trigger an AniList refresh, but never more than once a minute.
const CHANGE_REFRESH_DELAY_MS = 5000;
const MIN_REFRESH_GAP_MS = 60 * 1000;

const store = await createStore(DATA_DIR);

const sendPush = (subscription, payload) =>
  webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 6 * 60 * 60,
    timeout: 15000,
  });

// A release is only marked as sent after every follower received it. Transient
// failures stay pending and are retried on the next check, while the delivery
// log on each subscription keeps a retry from notifying the same browser twice.
async function runReleaseDelivery(now) {
  const { releases, tracker, changed } = findReleases(store.data.tracker, now);
  if (changed) await store.setTracker(tracker);
  if (releases.length === 0) return;

  const result = await deliverReleases(releases, store.data.subscriptions, sendPush);
  await store.update((data) => applyDeliveries(data, result, Date.now()));

  result.failures.forEach((failure) => {
    console.error('Push delivery failed', failure.status, failure.tag);
  });
  const pending = releases.length - result.completed.length;
  const sent = result.attempted - result.failures.length - result.gone.length;
  console.log(
    `Sent ${sent} of ${result.attempted} notification(s) for ` +
      `${releases.length} release(s), ${pending} pending retry, ${result.gone.length} expired`,
  );
}

// Runs never overlap: a check that starts while one is still sending waits for it.
let releaseRun = null;
function sendReleases(now = Date.now()) {
  if (!releaseRun) {
    releaseRun = runReleaseDelivery(now).finally(() => {
      releaseRun = null;
    });
  }
  return releaseRun;
}

async function runRefresh(now) {
  await sendReleases(now);
  const ids = collectMediaIds(store.data.subscriptions);
  if (ids.length === 0) return;
  const media = await fetchNextEpisodes(ids);
  await store.setTracker(updateTracker(store.data.tracker, media, ids, Date.now()));
}

let refreshRun = null;
let lastRefreshAt = 0;
function refreshTracker(now = Date.now()) {
  if (!refreshRun) {
    refreshRun = runRefresh(now).finally(() => {
      refreshRun = null;
      lastRefreshAt = Date.now();
    });
  }
  return refreshRun;
}

let refreshTimer = null;
function refreshSoon() {
  if (refreshTimer) return;
  const delay = Math.max(CHANGE_REFRESH_DELAY_MS, lastRefreshAt + MIN_REFRESH_GAP_MS - Date.now());
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshTracker().catch((error) => console.error('Refresh failed', error.message));
  }, delay);
}

const app = createApp({
  store,
  publicKey: VAPID_PUBLIC_KEY,
  allowedOrigins: ALLOWED_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  onSubscriptionsChanged: refreshSoon,
});

const server = http.createServer(app);
server.requestTimeout = 15000;
server.headersTimeout = 10000;

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
