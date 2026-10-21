const DEFAULT_DURATION_MINUTES = 24;

export interface EpisodeEvent {
  mediaId: number;
  title: string;
  episode: number;
  airingAt: number;
  duration?: number | null;
  url?: string | null;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

const toIcsDate = (date: Date) =>
  `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T` +
  `${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;

const escapeText = (value: unknown) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

// RFC 5545 asks for lines of at most 75 characters, continued with a leading space.
const foldLine = (line: string) => {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let index = 75; index < line.length; index += 74) {
    parts.push(` ${line.slice(index, index + 74)}`);
  }
  return parts.join('\r\n');
};

export const slugify = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'episode';

export function buildEpisodeIcs({
  mediaId,
  title,
  episode,
  airingAt,
  duration,
  url,
}: EpisodeEvent) {
  const start = new Date(airingAt * 1000);
  const end = new Date(start.getTime() + (duration || DEFAULT_DURATION_MINUTES) * 60 * 1000);
  const summary = `${title} - Episode ${episode}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AOTD//Anime of The Day//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:aotd-${mediaId}-${episode}@aotd.eduardoalves.tech`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(`Episode ${episode} of ${title} airs now.${url ? `\n${url}` : ''}`)}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT10M',
    `DESCRIPTION:${escapeText(summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

const googleDate = (date: Date) => toIcsDate(date);

// Link that opens Google Calendar with the event already filled in.
export function buildGoogleCalendarUrl({ title, episode, airingAt, duration, url }: EpisodeEvent) {
  const start = new Date(airingAt * 1000);
  const end = new Date(start.getTime() + (duration || DEFAULT_DURATION_MINUTES) * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${title} - Episode ${episode}`,
    dates: `${googleDate(start)}/${googleDate(end)}`,
    details: `Episode ${episode} of ${title} airs now.${url ? `\n${url}` : ''}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadEpisodeIcs(event: EpisodeEvent) {
  const blob = new Blob([buildEpisodeIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${slugify(event.title)}-ep${event.episode}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
