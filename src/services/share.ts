export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

// Uses the native share sheet when available, otherwise copies the link.
export async function shareLink(title: string, url: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
