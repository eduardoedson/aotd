import { consentDialogStore, consentStore, setConsent } from '../services/consent';

// GDPR banner: nothing is tracked until the visitor accepts analytics.
function CookieConsent() {
  const choice = consentStore.useValue();
  const reopened = consentDialogStore.useValue();

  if (choice && !reopened) return null;

  return (
    <div className='consent' role='dialog' aria-modal='false' aria-labelledby='consent-title'>
      <div className='consent-text'>
        <strong id='consent-title'>Cookies and analytics</strong>
        <p>
          AOTD uses Google Analytics cookies to understand how the site is used, only if you allow
          it. Favorites and settings stay in your browser and are never shared.
        </p>
      </div>
      <div className='consent-actions'>
        <button type='button' className='consent-reject' onClick={() => setConsent(false)}>
          Reject
        </button>
        <button type='button' className='consent-accept' onClick={() => setConsent(true)}>
          Accept analytics
        </button>
      </div>
    </div>
  );
}

export default CookieConsent;
