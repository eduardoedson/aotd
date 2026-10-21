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

const pad2 = (value) => String(value).padStart(2, '0');

// Formats a Date as YYYY-MM-DD using its UTC calendar day.
export const toIsoDate = (date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

export const getToday = () => toIsoDate(new Date());

export const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const isoToUtcDate = (isoDate) => new Date(`${isoDate}T00:00:00.000Z`);

export const shiftIsoDate = (isoDate, days) => {
  const date = isoToUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
};

// Converts YYYY-MM-DD to a local Date at midnight, which is what the date picker expects.
export const isoToLocalDate = (isoDate) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Converts a local Date picked in the date picker back to YYYY-MM-DD.
export const localDateToIso = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const formatLongDate = (isoDate) => {
  const [year, month, day] = isoDate.split('-');
  const weekDay = weekDays[isoToUtcDate(isoDate).getUTCDay()];
  return `${weekDay}, ${day} ${months[Number(month) - 1]} ${year}`;
};

export const formatFuzzyDate = ({ year, month, day } = {}) => {
  if (!year || !month || !day) return '???';
  return `${months[month - 1]} ${pad2(day)}, ${year}`;
};

// Returns the unix range (seconds) covering a whole UTC day for AniList filters.
export const getDayRange = (isoDate) => {
  const start = Math.floor(isoToUtcDate(isoDate).getTime() / 1000);
  // AniList uses strict greater/lesser filters, so the range is expanded by one second.
  return { start: start - 1, end: start + 86400 };
};

export const getSafeExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
};

export const capitalizeFirstLetter = (str) =>
  str.toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());

// Turns AniList enum values like NOT_YET_RELEASED into "Not Yet Released".
export const humanizeEnum = (value) => capitalizeFirstLetter(value.replace(/_/g, ' '));

// Extracts readable text from an HTML snippet without executing anything.
export const toPlainText = (html) => {
  if (!html) return '';
  const withSpaces = html.replace(/<br\s*\/?\s*>/gi, ' ');
  const doc = new DOMParser().parseFromString(withSpaces, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
};

// Cuts text at a word boundary so it never exceeds maxLength characters (ellipsis included).
export const truncateText = (text, maxLength) => {
  if (!text || text.length <= maxLength) return text ?? '';
  const slice = text.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
};

// Lowercases and strips accents so searches ignore diacritics.
export const normalizeSearch = (value) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Formats a countdown in seconds as "1d 02h 03m 04s" (days only when needed).
export function formatTime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => value.toString().padStart(2, '0');
  const clock = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

  return days > 0 ? `${days}d ${clock}` : clock;
}
