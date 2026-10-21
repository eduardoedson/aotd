import { useWatched } from '../services/watched';

function WatchButton({ mediaId, episode, showLabel = false, className = '' }) {
  const { isWatched, toggleWatched } = useWatched();
  const active = isWatched(mediaId, episode);
  return (
    <button
      type='button'
      className={`watch-button ${active ? 'is-active' : ''} ${className}`.trim()}
      aria-pressed={active}
      aria-label={`${active ? 'Mark' : 'Mark'} episode ${episode} as ${active ? 'unwatched' : 'watched'}`}
      onClick={() => toggleWatched(mediaId, episode)}
      title={active ? 'Mark as unwatched' : 'Mark as watched'}
    >
      <span aria-hidden='true'>{active ? '✓' : '○'}</span>
      {showLabel ? (active ? ' Watched' : ' Mark watched') : null}
    </button>
  );
}

export default WatchButton;
