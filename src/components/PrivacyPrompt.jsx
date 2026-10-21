import { consentDialogStore, consentStore, setConsent } from '../services/privacy';

// GDPR banner: nothing is tracked until the visitor accepts analytics.
function PrivacyPrompt() {
  const choice = consentStore.useValue();
  const reopened = consentDialogStore.useValue();

  if (choice && !reopened) return null;

  return (
    <div
      className='privacy-prompt'
      role='dialog'
      aria-modal='false'
      aria-labelledby='privacy-prompt-title'
    >
      <div className='privacy-prompt-text'>
        <strong id='privacy-prompt-title'>Cookies and analytics</strong>
        <p>
          AOTD uses Google Analytics cookies to understand how the site is used, only if you allow
          it. Favorites and settings stay in your browser and are never shared.
        </p>
      </div>
      <div className='privacy-prompt-actions'>
        <button type='button' className='privacy-prompt-reject' onClick={() => setConsent(false)}>
          Reject
        </button>
        <button type='button' className='privacy-prompt-accept' onClick={() => setConsent(true)}>
          Accept analytics
        </button>
      </div>
    </div>
  );
}

export default PrivacyPrompt;
