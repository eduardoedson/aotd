// Small status labels: premiere, finale, airing right now and released.
export interface Badge {
  key: string;
  label: string;
  tone: 'new' | 'finale' | 'live' | 'released';
}

interface BadgeInput {
  episode: number;
  totalEpisodes?: number | null;
  airingAt: number;
  duration?: number | null;
  now: number;
}

export function getBadges({ episode, totalEpisodes, airingAt, duration, now }: BadgeInput) {
  const badges: Badge[] = [];
  const start = airingAt * 1000;
  const end = start + (duration || 24) * 60 * 1000;

  if (episode === 1) badges.push({ key: 'new', label: 'New', tone: 'new' });
  if (totalEpisodes && episode === totalEpisodes) {
    badges.push({ key: 'finale', label: 'Finale', tone: 'finale' });
  }
  if (now >= start && now < end) badges.push({ key: 'live', label: 'Airing now', tone: 'live' });
  else if (now >= end) badges.push({ key: 'released', label: 'Released', tone: 'released' });

  return badges;
}
