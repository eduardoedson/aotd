import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createApp,
  createRateLimiter,
  getClientIp,
  isAllowedPushEndpoint,
  MAX_BODY_BYTES,
} from '../src/app.js';
import { createStore } from '../src/store.js';

const TEMP_ROOT = fileURLToPath(new URL('../.test-tmp/app/', import.meta.url));
const ORIGIN = 'https://aotd.example';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';
const KEYS = { p256dh: 'BPk', auth: 'xyz' };

let server;
let baseUrl;
let store;
let changes;
let limits;

const unlimited = () => ({ take: () => true });

async function startApp(options = {}) {
  await fs.mkdir(TEMP_ROOT, { recursive: true });
  store = await createStore(await fs.mkdtemp(path.join(TEMP_ROOT, 'app-')));
  changes = 0;
  const app = createApp({
    store,
    publicKey: 'public-key',
    allowedOrigins: [ORIGIN],
    onSubscriptionsChanged: () => {
      changes += 1;
    },
    requestLimiter: limits?.request ?? unlimited(),
    newSubscriptionLimiter: limits?.newSubscription ?? unlimited(),
    ...options,
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

const stopApp = () =>
  new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
    server = null;
  });

const call = (method, body, headers = {}) =>
  fetch(`${baseUrl}/api/push/subscription`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const subscribe = (endpoint = ENDPOINT, mediaIds = [1, 2], extra = {}, headers = {}) =>
  call('POST', { subscription: { endpoint, keys: KEYS }, mediaIds, ...extra }, headers);

before(() => fs.mkdir(TEMP_ROOT, { recursive: true }));
beforeEach(async () => {
  await stopApp();
  limits = null;
  await startApp();
});
after(async () => {
  await stopApp();
  await fs.rm(TEMP_ROOT, { recursive: true, force: true });
  // The shared parent folder goes away once every test file cleaned up its own.
  await fs.rmdir(path.dirname(TEMP_ROOT)).catch(() => {});
});

test('accepts only the push services of real browsers', () => {
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/x'), true);
  assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'), true);
  assert.equal(isAllowedPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x'), true);
  assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/abc'), true);
  assert.equal(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/x'), false);
  assert.equal(isAllowedPushEndpoint('https://evil.example/fcm.googleapis.com'), false);
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.example/x'), false);
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com:8443/x'), false);
  assert.equal(isAllowedPushEndpoint('https://127.0.0.1/x'), false);
  assert.equal(isAllowedPushEndpoint(42), false);
});

test('serves the public key', async () => {
  const response = await fetch(`${baseUrl}/api/push/public-key`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { publicKey: 'public-key' });
});

test('stores a subscription with sanitized favorites', async () => {
  const response = await subscribe(ENDPOINT, [3, 3, -1, 'x', 4]);
  assert.equal(response.status, 204);
  assert.deepEqual(store.data.subscriptions[ENDPOINT].mediaIds, [3, 4]);
  assert.deepEqual(store.data.subscriptions[ENDPOINT].subscription, {
    endpoint: ENDPOINT,
    keys: KEYS,
  });
  assert.equal(changes, 1);
});

test('refuses requests without the AOTD origin', async () => {
  assert.equal(
    (await subscribe(ENDPOINT, [1], {}, { Origin: 'https://evil.example' })).status,
    403,
  );
  const noOrigin = await new Promise((resolve, reject) => {
    const request = http.request(
      `${baseUrl}/api/push/subscription`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      resolve,
    );
    request.on('error', reject);
    request.end(
      JSON.stringify({ subscription: { endpoint: ENDPOINT, keys: KEYS }, mediaIds: [1] }),
    );
  });
  assert.equal(noOrigin.statusCode, 403);
  noOrigin.resume();
  assert.equal(Object.keys(store.data.subscriptions).length, 0);
});

test('refuses endpoints outside the known push services', async () => {
  const response = await subscribe('https://internal.example/hook', [1]);
  assert.equal(response.status, 400);
  assert.equal(Object.keys(store.data.subscriptions).length, 0);
});

test('refuses invalid bodies', async () => {
  assert.equal((await call('POST', '{oops')).status, 400);
  assert.equal((await call('POST', 'null')).status, 400);
  assert.equal(
    (await call('POST', { subscription: { endpoint: ENDPOINT, keys: {} }, mediaIds: [1] })).status,
    400,
  );
  assert.equal((await subscribe(ENDPOINT, 'not a list')).status, 400);
  assert.equal((await call('POST', 'x'.repeat(MAX_BODY_BYTES + 1))).status, 413);
});

test('answers 404 and 405 for unknown routes and methods', async () => {
  assert.equal((await fetch(`${baseUrl}/api/push/other`)).status, 404);
  const response = await fetch(`${baseUrl}/api/push/subscription`, {
    method: 'PUT',
    headers: { Origin: ORIGIN },
  });
  assert.equal(response.status, 405);
});

test('deletes a subscription', async () => {
  await subscribe();
  const response = await call('DELETE', { endpoint: ENDPOINT });
  assert.equal(response.status, 204);
  assert.equal(store.data.subscriptions[ENDPOINT], undefined);
});

test('moves favorites and delivery log when the browser replaces the subscription', async () => {
  await subscribe(ENDPOINT, [7, 8]);
  await store.update((data) => {
    data.subscriptions[ENDPOINT].sent = { 'aotd-7-1': 1 };
  });
  const replacement = 'https://fcm.googleapis.com/fcm/send/new';

  const response = await subscribe(replacement, null, { oldEndpoint: ENDPOINT });

  assert.equal(response.status, 204);
  assert.equal(store.data.subscriptions[ENDPOINT], undefined);
  assert.deepEqual(store.data.subscriptions[replacement].mediaIds, [7, 8]);
  assert.deepEqual(store.data.subscriptions[replacement].sent, { 'aotd-7-1': 1 });
});

test('answers 404 when the replaced subscription is unknown and no favorites are sent', async () => {
  const response = await subscribe('https://fcm.googleapis.com/fcm/send/new', null, {
    oldEndpoint: 'https://fcm.googleapis.com/fcm/send/missing',
  });
  assert.equal(response.status, 404);
});

test('limits requests per visitor', async () => {
  await stopApp();
  limits = { request: createRateLimiter({ max: 2, windowMs: 60000 }) };
  await startApp();

  assert.equal((await subscribe()).status, 204);
  assert.equal((await subscribe()).status, 204);
  const limited = await subscribe();
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
});

test('limits new subscriptions per visitor but not updates', async () => {
  await stopApp();
  limits = { newSubscription: createRateLimiter({ max: 1, windowMs: 60000 }) };
  await startApp();

  assert.equal((await subscribe(ENDPOINT, [1])).status, 204);
  assert.equal((await subscribe(ENDPOINT, [1, 2])).status, 204);
  assert.equal((await subscribe('https://fcm.googleapis.com/fcm/send/second', [1])).status, 429);
});

test('rate limiter opens a new window after it expires', () => {
  let time = 0;
  const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => time });
  assert.equal(limiter.take('a'), true);
  assert.equal(limiter.take('a'), false);
  assert.equal(limiter.take('b'), true);
  time = 1000;
  assert.equal(limiter.take('a'), true);
});

test('trusts X-Real-IP only from the local proxy', () => {
  const fromProxy = {
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-real-ip': '203.0.113.9' },
  };
  const direct = {
    socket: { remoteAddress: '198.51.100.4' },
    headers: { 'x-real-ip': '203.0.113.9' },
  };
  assert.equal(getClientIp(fromProxy), '203.0.113.9');
  assert.equal(getClientIp(direct), '198.51.100.4');
});
