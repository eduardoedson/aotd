import { weekDays, months } from '../services/globals';
import { useNow } from '../services/useNow';
import { getLocalZoneLabel, useTimeZone } from '../services/timezone';

const pad = (value) => value.toString().padStart(2, '0');

const formatClock = (date, timeZone) => {
  const utc = timeZone === 'utc';
  const weekDay = weekDays[utc ? date.getUTCDay() : date.getDay()];
  const month = months[utc ? date.getUTCMonth() : date.getMonth()];
  const day = pad(utc ? date.getUTCDate() : date.getDate());
  const hours = pad(utc ? date.getUTCHours() : date.getHours());
  const minutes = pad(utc ? date.getUTCMinutes() : date.getMinutes());
  const seconds = pad(utc ? date.getUTCSeconds() : date.getSeconds());
  const zone = utc ? 'UTC' : getLocalZoneLabel(date);
  return `${weekDay}, ${month} ${day}, ${hours}:${minutes}:${seconds} ${zone}`;
};

function Clock() {
  const now = useNow();
  const timeZone = useTimeZone();
  return (
    <div className='clock-container' aria-live='off'>
      {formatClock(new Date(now), timeZone)}
    </div>
  );
}

export default Clock;
