// Registers the offline service worker in production builds only, so it never
// caches stale modules while developing with the Vite dev server.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app works without the service worker, so failures are ignored.
    });
  });
}
