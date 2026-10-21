import { useEffect, useState } from 'react';
import { shareLink } from '../services/share';

const LABELS = {
  idle: 'Share',
  copied: 'Link copied',
  failed: 'Could not share',
};

// Shares the given URL (default: the current page) with the native share sheet,
// or copies it. "compact" renders an icon only button for cards.
function ShareButton({ title, url, label, className = '', compact = false }) {
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (status === 'idle') return undefined;
    const timer = setTimeout(() => setStatus('idle'), 2200);
    return () => clearTimeout(timer);
  }, [status]);

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const result = await shareLink(`${title} :: AOTD`, url ?? window.location.href);
    if (result === 'copied' || result === 'failed') setStatus(result);
  };

  const text = status === 'idle' ? (label ?? LABELS.idle) : LABELS[status];

  return (
    <button
      type='button'
      className={`share-button${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      aria-label={compact ? text : undefined}
      title={compact ? text : undefined}
    >
      <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
        <path d='M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z' />
      </svg>
      {compact ? null : <span aria-live='polite'>{text}</span>}
    </button>
  );
}

export default ShareButton;
