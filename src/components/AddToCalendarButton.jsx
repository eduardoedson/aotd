import { useEffect, useId, useRef, useState } from 'react';
import { buildGoogleCalendarUrl, downloadEpisodeIcs } from '../services/calendarExport';

// Calendar button with a small menu: Google Calendar opens directly in the
// browser, the .ics file works with Apple Calendar, Outlook and others.
function AddToCalendarButton({
  mediaId,
  title,
  episode,
  airingAt,
  duration,
  url,
  className = '',
  showLabel = false,
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef(null);
  const event = { mediaId, title, episode, airingAt, duration, url };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (pointerEvent) => {
      if (!rootRef.current?.contains(pointerEvent.target)) setOpen(false);
    };
    const onKeyDown = (keyEvent) => {
      if (keyEvent.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const stop = (clickEvent) => {
    // The menu sits on top of the card link, so clicks must not navigate.
    clickEvent.stopPropagation();
  };

  return (
    <div className={`calendar-menu${open ? ' is-open' : ''}`} ref={rootRef} onClick={stop}>
      <button
        type='button'
        className={`calendar-add-button${className ? ` ${className}` : ''}`}
        aria-label={`Add episode ${episode} of ${title} to your calendar`}
        aria-haspopup='menu'
        aria-expanded={open}
        aria-controls={menuId}
        title='Add to calendar'
        onClick={(clickEvent) => {
          clickEvent.preventDefault();
          setOpen((value) => !value);
        }}
      >
        <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
          <path d='M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 7v10H5V9h14zm-8 2v2H9v2h2v2h2v-2h2v-2h-2v-2h-2z' />
        </svg>
        {showLabel ? <span>Add to calendar</span> : null}
      </button>
      {open ? (
        <div className='calendar-menu-list' id={menuId} role='menu'>
          <a
            role='menuitem'
            href={buildGoogleCalendarUrl(event)}
            target='_blank'
            rel='noopener noreferrer'
            onClick={() => setOpen(false)}
          >
            Google Calendar
          </a>
          <button
            type='button'
            role='menuitem'
            onClick={(clickEvent) => {
              clickEvent.preventDefault();
              downloadEpisodeIcs(event);
              setOpen(false);
            }}
          >
            Apple, Outlook (.ics)
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default AddToCalendarButton;
