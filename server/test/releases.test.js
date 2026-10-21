import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  collectMediaIds,
  fetchNextEpisodes,
  findReleases,
  updateTracker,
} from '../src/releases.js';
import { createStore } from '../src/store.js';

const NOW = Date.parse('2026-10-21T12:00:00Z');
const seconds = (ms) => Math.floor(ms / 1000);

test('collects unique media ids from every subscription', () => {
  const ids = collectMediaIds({
    a: { mediaIds: [1, 2] },
    b: { mediaIds: [2, 3] },
  });
  assert.deepEqual(ids.sort(), [1, 2, 3]);
});

test('finds released episodes once and skips old ones', () => {
  const tracker = {
    1: { episode: 5, airingAt: seconds(NOW - 60000), title: 'Frieren', notified: false },
    2: { episode: 1, airingAt: seconds(NOW + 60000), title: 'Later', notified: false },
    3: { episode: 2, airingAt: seconds(NOW - 7 * 86400000), title: 'Old', notified: false },
  };
  const first = findReleases(tracker, NOW);
  assert.equal(first.releases.length, 1);
  assert.equal(first.releases[0].payload.body, 'Episode 5 is out now!');
  assert.equal(first.releases[0].payload.url, '/2026-10-21/1');
  assert.equal(first.tracker[3].notified, true);

  const second = findReleases(first.tracker, NOW);
  assert.equal(second.releases.length, 0);
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
  const dir = await mkdtemp(path.join(tmpdir(), 'aotd-push-'));
  const store = await createStore(dir);
  await store.upsertSubscription({ endpoint: 'https://push.example/abc', keys: {} }, [1, 2]);
  const saved = JSON.parse(await readFile(path.join(dir, 'push-data.json'), 'utf8'));
  assert.deepEqual(saved.subscriptions['https://push.example/abc'].mediaIds, [1, 2]);

  const reopened = await createStore(dir);
  assert.ok(reopened.data.subscriptions['https://push.example/abc']);
  await reopened.removeSubscription('https://push.example/abc');
  assert.equal(Object.keys(reopened.data.subscriptions).length, 0);
});
