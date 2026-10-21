import { useEffect } from 'react';

export const APP_TITLE = 'AOTD :: Anime of The Day';

// Sets the browser tab title while the calling component is mounted.
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} :: AOTD` : APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [title]);
}
