import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkReleases, refreshReleaseTracker, releaseTrackerStore } from './notifications';
import { favoritesStore } from './favorites';
import { timeZoneStore } from './timezone';

afterEach(() => {
  favoritesStore.reset();
  releaseTrackerStore.reset();
  timeZoneStore.reset();
});

const NOW = Date.parse('2026-10-21T12:00:00Z');
const seconds = (ms: number) => Math.floor(ms / 1000);

describe('release notifications', () => {
  it('notifies once for released episodes of favorites', () => {
    timeZoneStore.set('utc');
    favoritesStore.set({ 1: { id: 1, title: 'Frieren' } });
    releaseTrackerStore.set({
      1: {
        episode: 5,
        airingAt: seconds(NOW - 60000),
        title: 'Frieren',
        image: null,
        notified: false,
      },
      2: { episode: 1, airingAt: seconds(NOW - 60000), title: 'Not a favorite', notified: false },
    });
    const notify = vi.fn();

    checkReleases(NOW, notify);
    checkReleases(NOW, notify);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      'Frieren',
      expect.objectContaining({ body: 'Episode 5 is out now!', data: { url: '/2026-10-21/1' } }),
    );
  });

  it('silently skips releases that are too old', () => {
    favoritesStore.set({ 1: { id: 1, title: 'Frieren' } });
    releaseTrackerStore.set({
      1: { episode: 2, airingAt: seconds(NOW - 7 * 86400000), title: 'Frieren', notified: false },
    });
    const notify = vi.fn();

    checkReleases(NOW, notify);

    expect(notify).not.toHaveBeenCalled();
    expect(releaseTrackerStore.get()[1].notified).toBe(true);
  });

  it('tracks the next episode of every favorite', async () => {
    favoritesStore.set({ 1: { id: 1, title: 'Frieren' } });
    const client = {
      query: vi.fn().mockResolvedValue({
        Page: {
          media: [
            {
              id: 1,
              title: { userPreferred: 'Frieren' },
              coverImage: { medium: 'https://s4.anilist.co/x.jpg' },
              nextAiringEpisode: { episode: 6, airingAt: seconds(NOW + 3600000) },
            },
          ],
        },
      }),
    };

    await refreshReleaseTracker(client, NOW, vi.fn());

    expect(client.query).toHaveBeenCalledWith([1]);
    expect(releaseTrackerStore.get()[1]).toMatchObject({ episode: 6, notified: false });
  });

  it('tracks favorites beyond the first 50 by querying in batches', async () => {
    const ids = Array.from({ length: 120 }, (_, index) => index + 1);
    favoritesStore.set(Object.fromEntries(ids.map((id) => [id, { id, title: `Anime ${id}` }])));
    const client = {
      query: vi.fn(async (batch: number[]) => ({
        Page: {
          media: batch.map((id) => ({
            id,
            title: { userPreferred: `Anime ${id}` },
            coverImage: null,
            nextAiringEpisode: { episode: 2, airingAt: seconds(NOW + 3600000) },
          })),
        },
      })),
    };

    await refreshReleaseTracker(client, NOW, vi.fn());

    expect(client.query.mock.calls.map(([batch]) => batch.length)).toEqual([50, 50, 20]);
    expect(Object.keys(releaseTrackerStore.get())).toHaveLength(120);
    expect(releaseTrackerStore.get()[120]).toMatchObject({ episode: 2, notified: false });
  });
});
