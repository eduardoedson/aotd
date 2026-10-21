import { useNow } from '../services/useNow';

// Renders its children only while the given unix timestamp is still in the future.
function UpcomingOnly({ airingAt, children }) {
  const now = useNow();
  return airingAt * 1000 > now ? children : null;
}

export default UpcomingOnly;
