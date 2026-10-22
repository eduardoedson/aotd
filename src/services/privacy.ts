// Cookie consent (GDPR). Google Analytics is only loaded after an explicit "accept".

import { createMemoryStore, createStorageStore } from './storage';

const GA_MEASUREMENT_ID = 'G-YW52CBSH4K';

export interface ConsentChoice {
  analytics: boolean;
  decidedAt: number;
}

export const consentStore = createStorageStore<ConsentChoice | null>('aotd:consent', null);

// Lets the footer reopen the banner after a choice was made.
export const consentDialogStore = createMemoryStore(false);

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

let analyticsLoaded = false;

function gtag(..._args: unknown[]) {
  const target = window as GtagWindow;
  target.dataLayer = target.dataLayer ?? [];
  // gtag.js expects the arguments object itself, not an array copy.
  // eslint-disable-next-line prefer-rest-params
  target.dataLayer.push(arguments);
}

function loadAnalytics() {
  if (analyticsLoaded || typeof document === 'undefined') return;
  analyticsLoaded = true;
  const target = window as GtagWindow;
  target.gtag = gtag;
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

// Removes the Google Analytics cookies after consent is withdrawn.
function clearAnalyticsCookies() {
  const hostParts = window.location.hostname.split('.');
  const domains = hostParts.map((_, index) => `.${hostParts.slice(index).join('.')}`);
  document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0].trim())
    .filter((name) => name === '_ga' || name.startsWith('_ga_') || name === '_gid')
    .forEach((name) => {
      const expired = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = expired;
      domains.forEach((domain) => {
        document.cookie = `${expired}; domain=${domain}`;
      });
    });
}

export function setConsent(analytics: boolean) {
  consentStore.set({ analytics, decidedAt: Date.now() });
  consentDialogStore.set(false);
  if (analytics) {
    loadAnalytics();
  } else {
    if (analyticsLoaded) gtag('consent', 'update', { analytics_storage: 'denied' });
    clearAnalyticsCookies();
  }
}

// Called once at startup: restores a previous "accept".
export function initConsent() {
  if (consentStore.get()?.analytics) loadAnalytics();
}

export const openConsentDialog = () => consentDialogStore.set(true);
