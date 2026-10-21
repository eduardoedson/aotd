import { useEffect, useRef, useState } from 'react';

// Calls onLoadMore whenever the returned ref's element gets close to the viewport.
// "version" should change after each load, so the observer re-checks a sentinel
// that is still visible (for example when filters hide most of the new items).
export function useInfiniteScroll({ onLoadMore, enabled, version, rootMargin = '800px 0px' }) {
  const [node, setNode] = useState(null);
  const callbackRef = useRef(onLoadMore);

  useEffect(() => {
    callbackRef.current = onLoadMore;
  });

  useEffect(() => {
    if (!node || !enabled || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callbackRef.current();
      },
      { rootMargin },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [node, enabled, version, rootMargin]);

  return setNode;
}
