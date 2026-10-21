import { downloadEpisodeIcs } from '../services/calendarExport';

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
  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    downloadEpisodeIcs({ mediaId, title, episode, airingAt, duration, url });
  };

  return (
    <button
      type='button'
      className={`calendar-add-button${className ? ` ${className}` : ''}`}
      aria-label={`Add episode ${episode} of ${title} to your calendar`}
      title='Add to calendar (.ics)'
      onClick={handleClick}
    >
      <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
        <path d='M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 7v10H5V9h14zm-8 2v2H9v2h2v2h2v-2h2v-2h-2v-2h-2z' />
      </svg>
      {showLabel ? <span>Add to calendar</span> : null}
    </button>
  );
}

export default AddToCalendarButton;
