// Selective preloading: data is fetched ahead of time only when the visitor
// shows intent (hover or focus) and the connection is not slow or metered.

import { cachedRequest } from './useAnilistQuery';
import { DETAIL_QUERY } from './queries';

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

export function canPrefetch() {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !/(^|-)2g$/.test(connection.effectiveType ?? '');
}

const prefetched = new Set<number>();

export function prefetchDetail(mediaId: number) {
  if (prefetched.has(mediaId) || !canPrefetch()) return;
  prefetched.add(mediaId);
  cachedRequest(DETAIL_QUERY, { id: mediaId }).catch(() => prefetched.delete(mediaId));
}

const INTENT_DELAY_MS = 150;

// Props for a link: starts the prefetch after a short hover or on keyboard focus.
export function prefetchIntent(mediaId: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    onMouseEnter: () => {
      cancel();
      timer = setTimeout(() => prefetchDetail(mediaId), INTENT_DELAY_MS);
    },
    onMouseLeave: cancel,
    onFocus: () => prefetchDetail(mediaId),
    onTouchStart: () => prefetchDetail(mediaId),
  };
}

export const resetPrefetch = () => prefetched.clear();
