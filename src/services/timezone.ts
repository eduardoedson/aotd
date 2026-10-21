import { createStorageStore } from './storage';
import type { TimeZoneMode } from './globals';

// Local time by default; UTC is still one click away in the top bar.
export const timeZoneStore = createStorageStore<TimeZoneMode>('aotd:timezone', 'local');

const sanitize = (value: unknown): TimeZoneMode => (value === 'utc' ? 'utc' : 'local');

export const getTimeZone = () => sanitize(timeZoneStore.get());

export const setTimeZone = (value: TimeZoneMode) => timeZoneStore.set(value);

export function useTimeZone() {
  return sanitize(timeZoneStore.useValue());
}

// Short name of the browser's zone, for example "WEST" or "GMT+1".
export const getLocalZoneLabel = (date = new Date()) => {
  try {
    const part = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(date)
      .find((item) => item.type === 'timeZoneName');
    return part?.value ?? 'Local';
  } catch {
    return 'Local';
  }
};
