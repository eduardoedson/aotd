import { describe, expect, it } from 'vitest';
import { getBadges } from './badges';

const airingAt = 1_800_000_000;
const keys = (input: Partial<Parameters<typeof getBadges>[0]>) =>
  getBadges({ episode: 5, airingAt, duration: 24, now: airingAt * 1000 - 1, ...input }).map(
    (badge) => badge.key,
  );

describe('getBadges', () => {
  it('marks premieres and finales', () => {
    expect(keys({ episode: 1 })).toEqual(['new']);
    expect(keys({ episode: 12, totalEpisodes: 12 })).toEqual(['finale']);
  });

  it('marks episodes airing now and released ones', () => {
    expect(keys({ now: airingAt * 1000 + 60_000 })).toEqual(['live']);
    expect(keys({ now: airingAt * 1000 + 25 * 60_000 })).toEqual(['released']);
    expect(keys({})).toEqual([]);
  });
});
