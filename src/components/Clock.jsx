import { weekDays, months } from '../services/globals';
import { useNow } from '../services/useNow';

const pad = (value) => value.toString().padStart(2, '0');

const formatClock = (date) => {
  const weekDay = weekDays[date.getUTCDay()];
  const month = months[date.getUTCMonth()];
  return `${weekDay}, ${month} ${pad(date.getUTCDate())}, ${pad(date.getUTCHours())}:${pad(
    date.getUTCMinutes(),
  )}:${pad(date.getUTCSeconds())} UTC`;
};

function Clock() {
  const now = useNow();
  return (
    <div className='clock-container' aria-live='off'>
      {formatClock(new Date(now))}
    </div>
  );
}

export default Clock;
