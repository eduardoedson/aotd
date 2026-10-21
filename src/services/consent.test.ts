import { afterEach, describe, expect, it } from 'vitest';
import { consentStore, initConsent, setConsent } from './consent';

const gaScript = () => document.querySelector('script[src*="googletagmanager"]');

afterEach(() => consentStore.reset());

describe('consent', () => {
  it('does not load analytics without consent', () => {
    initConsent();
    expect(gaScript()).toBeNull();
  });

  it('remembers a rejection and clears analytics cookies', () => {
    document.cookie = '_ga=GA1.1.123; path=/';
    setConsent(false);
    expect(consentStore.get()?.analytics).toBe(false);
    expect(document.cookie).not.toContain('_ga=');
    expect(gaScript()).toBeNull();
  });

  it('loads Google Analytics after an accept', () => {
    setConsent(true);
    expect(consentStore.get()?.analytics).toBe(true);
    expect(gaScript()).not.toBeNull();
  });
});
