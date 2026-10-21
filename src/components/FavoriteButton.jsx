import { useFavorites } from '../services/favorites';

function FavoriteButton({ id, title, image, className = '', showLabel = false }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(id);

  const handleClick = (event) => {
    // The button sits on top of the card link, so it must not trigger navigation.
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite({ id, title, image });
  };

  return (
    <button
      type='button'
      className={`favorite-button${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={active}
      aria-label={`Favorite ${title}`}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
      onClick={handleClick}
    >
      <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
        <path d='M12 20.5s-7.4-4.5-9.6-9.1C.8 8.1 2.6 4.4 6.2 4c2-.2 3.8.9 4.8 2.5.4.6 1.6.6 2 0 1-1.6 2.8-2.7 4.8-2.5 3.6.4 5.4 4.1 3.8 7.4-2.2 4.6-9.6 9.1-9.6 9.1z' />
      </svg>
      {showLabel ? <span>{active ? 'In your favorites' : 'Add to favorites'}</span> : null}
    </button>
  );
}

export default FavoriteButton;
