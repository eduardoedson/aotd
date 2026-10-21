export type TimeZoneMode = 'local' | 'utc';

export const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const weekDays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Genres offered by AniList (adult genres are intentionally left out).
export const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

export const DEFAULT_ACCENT = '#ff3d8d';

const pad2 = (value: number | string) => String(value).padStart(2, '0');

const parseIso = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day };
};

// Formats a Date as YYYY-MM-DD using its UTC calendar day.
export const toIsoDate = (date: Date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

// Formats a local Date (for example one picked in a date input) as YYYY-MM-DD.
export const localDateToIso = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// Converts YYYY-MM-DD to a local Date at midnight.
export const isoToLocalDate = (isoDate: string) => {
  const { year, month, day } = parseIso(isoDate);
  return new Date(year, month - 1, day);
};

// Calendar day of an instant, seen from the chosen time zone.
export const toIsoDateInZone = (date: Date, timeZone: TimeZoneMode) =>
  timeZone === 'utc' ? toIsoDate(date) : localDateToIso(date);

export const getToday = (timeZone: TimeZoneMode = 'utc') => toIsoDateInZone(new Date(), timeZone);

export const isValidDate = (value: string | null | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const { year, month, day } = parseIso(value);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const isoToUtcDate = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

// Pure calendar arithmetic on YYYY-MM-DD strings, independent of time zones.
export const shiftIsoDate = (isoDate: string, days: number) => {
  const date = isoToUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
};

// Monday of the week that contains the given date.
export const getWeekStart = (isoDate: string) => {
  const weekDay = isoToUtcDate(isoDate).getUTCDay();
  return shiftIsoDate(isoDate, weekDay === 0 ? -6 : 1 - weekDay);
};

export const getWeekDays = (isoDate: string) => {
  const start = getWeekStart(isoDate);
  return Array.from({ length: 7 }, (_, index) => shiftIsoDate(start, index));
};

export const formatLongDate = (isoDate: string) => {
  const { year, month, day } = parseIso(isoDate);
  const weekDay = weekDays[isoToUtcDate(isoDate).getUTCDay()];
  return `${weekDay}, ${pad2(day)} ${months[month - 1]} ${year}`;
};

export const formatShortDate = (isoDate: string) => {
  const { month, day } = parseIso(isoDate);
  return `${months[month - 1]} ${pad2(day)}`;
};

export const formatWeekRange = (isoDate: string) => {
  const days = getWeekDays(isoDate);
  const first = days[0];
  const last = days[6];
  return `${formatShortDate(first)} - ${formatShortDate(last)}, ${parseIso(last).year}`;
};

export const formatWeekDayShort = (isoDate: string) =>
  weekDays[isoToUtcDate(isoDate).getUTCDay()].slice(0, 3);

export interface FuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export const formatFuzzyDate = ({ year, month, day }: FuzzyDate = {}) => {
  if (!year || !month || !day) return '???';
  return `${months[month - 1]} ${pad2(day)}, ${year}`;
};

// Start of a calendar day as a unix timestamp, in UTC or in the browser's time zone.
const startOfDay = (isoDate: string, timeZone: TimeZoneMode) => {
  const { year, month, day } = parseIso(isoDate);
  const ms =
    timeZone === 'utc' ? Date.UTC(year, month - 1, day) : new Date(year, month - 1, day).getTime();
  return Math.floor(ms / 1000);
};

export interface UnixRange {
  start: number;
  end: number;
}

// Unix range (seconds) covering `days` calendar days for AniList filters.
// Local days are computed with Date, so daylight saving changes are respected.
export const getRange = (
  isoDate: string,
  days: number,
  timeZone: TimeZoneMode = 'utc',
): UnixRange => {
  // AniList uses strict greater/lesser filters, so the start is moved back one second.
  return {
    start: startOfDay(isoDate, timeZone) - 1,
    end: startOfDay(shiftIsoDate(isoDate, days), timeZone),
  };
};

export const getDayRange = (isoDate: string, timeZone: TimeZoneMode = 'utc') =>
  getRange(isoDate, 1, timeZone);

export const formatAiringTime = (airingAt: number, timeZone: TimeZoneMode) => {
  const date = new Date(airingAt * 1000);
  return timeZone === 'utc'
    ? `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`
    : `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

export const getSafeExternalUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
};

export const capitalizeFirstLetter = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());

// Turns AniList enum values like NOT_YET_RELEASED into "Not Yet Released".
export const humanizeEnum = (value: string) => capitalizeFirstLetter(value.replace(/_/g, ' '));

// Extracts readable text from an HTML snippet without executing anything.
export const toPlainText = (html: string | null | undefined) => {
  if (!html) return '';
  const withSpaces = html.replace(/<br\s*\/?\s*>/gi, ' ');
  const doc = new DOMParser().parseFromString(withSpaces, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
};

// Cuts text at a word boundary so it never exceeds maxLength characters (ellipsis included).
export const truncateText = (text: string | null | undefined, maxLength: number) => {
  if (!text || text.length <= maxLength) return text ?? '';
  const slice = text.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
};

// Lowercases and strips accents so searches ignore diacritics.
export const normalizeSearch = (value: string | null | undefined) =>
  (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Formats a countdown in seconds as "1d 02h 03m 04s" (days only when needed).
export function formatTime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;

  return days > 0 ? `${days}d ${clock}` : clock;
}

interface LinkLike {
  id?: number;
  site: string;
  url: string;
  icon?: string | null;
}

// Keeps one link per site with a safe URL and icon, so a card never shows the
// same platform twice. Icon URLs are normalized so the browser reuses its cache.
export function uniqueLinks<T extends LinkLike>(links: T[] | null | undefined, max = 6) {
  const seen = new Set<string>();
  const result: (T & { url: string; icon: string })[] = [];
  for (const link of links ?? []) {
    const url = getSafeExternalUrl(link.url);
    const icon = getSafeExternalUrl(link.icon);
    const site = link.site?.trim().toLowerCase();
    if (!url || !icon || !site || seen.has(site)) continue;
    seen.add(site);
    result.push({ ...link, url, icon: icon.replace(/[?#].*$/, '') });
    if (result.length >= max) break;
  }
  return result;
}
