import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyDeliveries,
  collectMediaIds,
  deliverReleases,
  fetchNextEpisodes,
  findReleases,
  SENT_RETENTION_MS,
  updateTracker,
} from '../src/releases.js';
import { createStore } from '../src/store.js';

// Temporary data lives inside the project, which is always writable, instead of
// the system temp folder that sandboxes and some Windows setups restrict.
const TEMP_ROOT = fileURLToPath(new URL('../.test-tmp/', import.meta.url));

const makeTempDir = async () => {
  await fs.mkdir(TEMP_ROOT, { recursive: true });
  return fs.mkdtemp(path.join(TEMP_ROOT, 'store-'));
};

after(() => fs.rm(TEMP_ROOT, { recursive: true, force: true }));

const NOW = Date.parse('2026-10-21T12:00:00Z');
const seconds = (ms) => Math.floor(ms / 1000);

test('collects unique media ids from every subscription', () => {
  const ids = collectMediaIds({
    a: { mediaIds: [1, 2] },
    b: { mediaIds: [2, 3] },
  });
  assert.deepEqual(ids.sort(), [1, 2, 3]);
});

test('finds pending releases until they are delivered and closes old ones', () => {
  const tracker = {
    1: { episode: 5, airingAt: seconds(NOW - 60000), title: 'Frieren', notified: false },
    2: { episode: 1, airingAt: seconds(NOW + 60000), title: 'Later', notified: false },
    3: { episode: 2, airingAt: seconds(NOW - 7 * 86400000), title: 'Old', notified: false },
  };
  const first = findReleases(tracker, NOW);
  assert.equal(first.releases.length, 1);
  assert.equal(first.releases[0].episode, 5);
  assert.equal(first.releases[0].payload.body, 'Episode 5 is out now!');
  assert.equal(first.releases[0].payload.url, '/2026-10-21/1');
  assert.equal(first.tracker[1].notified, false);
  assert.equal(first.tracker[3].notified, true);
  assert.equal(first.changed, true);

  // Still pending: nothing was delivered yet.
  const second = findReleases(first.tracker, NOW);
  assert.equal(second.releases.length, 1);
  assert.equal(second.changed, false);

  const done = { ...first.tracker, 1: { ...first.tracker[1], notified: true } };
  assert.equal(findReleases(done, NOW).releases.length, 0);
});

const subscription = (endpoint, mediaIds, sent) => ({
  subscription: { endpoint, keys: { p256dh: 'p', auth: 'a' } },
  mediaIds,
  updatedAt: NOW,
  ...(sent ? { sent } : {}),
});

const pendingTracker = () => ({
  1: { episode: 5, airingAt: seconds(NOW - 60000), title: 'Frieren', notified: false },
});

test('keeps a release pending after a transient failure and retries only the failed browser', async () => {
  const data = {
    tracker: pendingTracker(),
    subscriptions: {
      'https://push.example/ok': subscription('https://push.example/ok', [1]),
      'https://push.example/down': subscription('https://push.example/down', [1]),
    },
  };
  const calls = [];
  let downFails = true;
  const send = async (target) => {
    calls.push(target.endpoint);
    if (target.endpoint.endsWith('/down') && downFails) {
      throw Object.assign(new Error('Service unavailable'), { statusCode: 503 });
    }
  };

  const { releases } = findReleases(data.tracker, NOW);
  const first = await deliverReleases(releases, data.subscriptions, send);
  applyDeliveries(data, first, NOW);

  assert.deepEqual(first.completed, []);
  assert.equal(data.tracker[1].notified, false);
  assert.ok(data.subscriptions['https://push.example/ok'].sent['aotd-1-5']);
  assert.equal(data.subscriptions['https://push.example/down'].sent, undefined);

  downFails = false;
  calls.length = 0;
  const retry = await deliverReleases(
    findReleases(data.tracker, NOW).releases,
    data.subscriptions,
    send,
  );
  applyDeliveries(data, retry, NOW);

  assert.deepEqual(calls, ['https://push.example/down']);
  assert.equal(data.tracker[1].notified, true);
});

test('removes expired subscriptions and does not retry permanent failures', async () => {
  const data = {
    tracker: pendingTracker(),
    subscriptions: {
      'https://push.example/gone': subscription('https://push.example/gone', [1]),
      'https://push.example/bad': subscription('https://push.example/bad', [1]),
    },
  };
  const send = async (target) => {
    const statusCode = target.endpoint.endsWith('/gone') ? 410 : 400;
    throw Object.assign(new Error('Rejected'), { statusCode });
  };

  const result = await deliverReleases(
    findReleases(data.tracker, NOW).releases,
    data.subscriptions,
    send,
  );
  applyDeliveries(data, result, NOW);

  assert.deepEqual(Object.keys(data.subscriptions), ['https://push.example/bad']);
  assert.equal(data.tracker[1].notified, true);
});

test('does not mark a newer episode as sent and prunes old delivery records', () => {
  const data = {
    tracker: {
      1: { episode: 6, airingAt: seconds(NOW + 60000), title: 'Frieren', notified: false },
    },
    subscriptions: {
      a: subscription('a', [1], {
        'aotd-1-1': NOW - SENT_RETENTION_MS - 1,
        'aotd-1-4': NOW - 1000,
      }),
    },
  };
  applyDeliveries(
    data,
    {
      delivered: [{ endpoint: 'a', tag: 'aotd-1-5' }],
      gone: [],
      completed: [{ mediaId: 1, episode: 5 }],
    },
    NOW,
  );

  assert.equal(data.tracker[1].notified, false);
  assert.deepEqual(Object.keys(data.subscriptions.a.sent).sort(), ['aotd-1-4', 'aotd-1-5']);
});

test('tracks the next episode and drops media nobody follows', () => {
  const tracker = { 9: { episode: 1, airingAt: 1, title: 'Gone', notified: true } };
  const next = updateTracker(
    tracker,
    [
      {
        id: 1,
        title: { userPreferred: 'Frieren' },
        coverImage: { medium: null },
        nextAiringEpisode: { episode: 6, airingAt: seconds(NOW + 3600000) },
      },
    ],
    [1],
    NOW,
  );
  assert.deepEqual(Object.keys(next), ['1']);
  assert.equal(next[1].episode, 6);
  assert.equal(next[1].notified, false);
});

test('fetches next episodes in chunks of 50', async () => {
  const calls = [];
  const fakeFetch = async (_url, init) => {
    const { variables } = JSON.parse(init.body);
    calls.push(variables.ids.length);
    return {
      ok: true,
      json: async () => ({ data: { Page: { media: variables.ids.map((id) => ({ id })) } } }),
    };
  };
  const ids = Array.from({ length: 120 }, (_, index) => index + 1);
  const media = await fetchNextEpisodes(ids, fakeFetch);
  assert.deepEqual(calls, [50, 50, 20]);
  assert.equal(media.length, 120);
});

test('store persists subscriptions to disk', async () => {
  const dir = await makeTempDir();
  const store = await createStore(dir);
  await store.upsertSubscription({ endpoint: 'https://push.example/abc', keys: {} }, [1, 2]);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'push-data.json'), 'utf8'));
  assert.deepEqual(saved.subscriptions['https://push.example/abc'].mediaIds, [1, 2]);

  const reopened = await createStore(dir);
  assert.ok(reopened.data.subscriptions['https://push.example/abc']);
  await reopened.removeSubscription('https://push.example/abc');
  assert.equal(Object.keys(reopened.data.subscriptions).length, 0);
  assert.deepEqual(
    (await fs.readdir(dir)).filter((name) => name.endsWith('.tmp')),
    [],
    'no temporary files are left behind',
  );
});

test('store keeps the delivery log when a browser subscribes again', async () => {
  const store = await createStore(await makeTempDir());
  const endpoint = 'https://push.example/abc';
  await store.upsertSubscription({ endpoint, keys: {} }, [1]);
  await store.update((data) => {
    data.subscriptions[endpoint].sent = { 'aotd-1-5': NOW };
  });
  await store.upsertSubscription({ endpoint, keys: {} }, [1, 2]);
  assert.deepEqual(store.data.subscriptions[endpoint].sent, { 'aotd-1-5': NOW });
});

test('store keeps writing after a failed write', async () => {
  const dir = await makeTempDir();
  let failNext = true;
  const flakyFs = {
    ...fs,
    writeFile: async (...args) => {
      if (failNext) {
        failNext = false;
        throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' });
      }
      return fs.writeFile(...args);
    },
  };
  const store = await createStore(dir, flakyFs);

  await assert.rejects(
    store.upsertSubscription({ endpoint: 'https://push.example/a', keys: {} }, [1]),
    /Disk full/,
  );
  await store.upsertSubscription({ endpoint: 'https://push.example/b', keys: {} }, [2]);

  const saved = JSON.parse(await fs.readFile(path.join(dir, 'push-data.json'), 'utf8'));
  assert.deepEqual(Object.keys(saved.subscriptions).sort(), [
    'https://push.example/a',
    'https://push.example/b',
  ]);
});

test('store retries a rename blocked by another process', async () => {
  const dir = await makeTempDir();
  let blocked = 2;
  const lockedFs = {
    ...fs,
    rename: async (...args) => {
      if (blocked > 0) {
        blocked -= 1;
        throw Object.assign(new Error('Operation not permitted'), { code: 'EPERM' });
      }
      return fs.rename(...args);
    },
  };
  const store = await createStore(dir, lockedFs);
  await store.setTracker({ 1: { episode: 1 } });

  const saved = JSON.parse(await fs.readFile(path.join(dir, 'push-data.json'), 'utf8'));
  assert.deepEqual(saved.tracker, { 1: { episode: 1 } });
});
