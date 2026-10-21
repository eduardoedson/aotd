// Error monitoring with Sentry. It is only loaded in production builds and only
// when VITE_SENTRY_DSN is set, so it costs nothing otherwise.

type SentryModule = typeof import('@sentry/react');

let sentry: Promise<SentryModule> | null = null;

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || !import.meta.env.PROD) return;

  sentry = import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION as string | undefined,
      tracesSampleRate: 0,
    });
    return Sentry;
  });
  sentry.catch(() => {
    sentry = null;
  });
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!sentry) {
    if (import.meta.env.DEV) console.error(error);
    return;
  }
  sentry.then((Sentry) => Sentry.captureException(error, { extra: context })).catch(() => {});
}
