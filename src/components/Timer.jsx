import { useNow } from '../services/useNow';
import { formatTime } from '../services/globals';

// Counts down to an absolute unix timestamp, so cached data never shows a stale timer.
function Timer({ airingAt }) {
  const now = useNow();
  const secondsLeft = Math.max(0, Math.floor(airingAt - now / 1000));

  return (
    <time dateTime={new Date(airingAt * 1000).toISOString()}>
      {secondsLeft <= 0 ? 'Released!' : formatTime(secondsLeft)}
    </time>
  );
}

export default Timer;
