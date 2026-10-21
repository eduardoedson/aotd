import { useNow } from '../services/useNow';
import { formatTime } from '../services/globals';

// Shows the next episode to air today and scrolls to its card on click.
function NextEpisodeJump({ items }) {
  const now = useNow() / 1000;
  const next = items.find((item) => item.airingAt > now);

  if (!next) return null;

  const jump = () => {
    const card = document.getElementById(`airing-${next.id}`);
    if (!card) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    card.classList.add('is-highlighted');
    card.querySelector('.card-content')?.focus({ preventScroll: true });
    setTimeout(() => card.classList.remove('is-highlighted'), 2400);
  };

  return (
    <button type='button' className='day-next' onClick={jump}>
      <span className='day-next-label'>Next up</span>
      <span className='day-next-title'>{next.media.title?.userPreferred ?? 'Untitled'}</span>
      <span className='day-next-time'>in {formatTime(Math.floor(next.airingAt - now))}</span>
      <span aria-hidden='true'>↓</span>
    </button>
  );
}

export default NextEpisodeJump;
