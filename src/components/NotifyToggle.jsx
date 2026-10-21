import { useFavorites } from '../services/favorites';
import { enableNotifications, useNotificationStatus } from '../services/notifications';

// Per anime switch for release notifications. Only shown for favorites.
function NotifyToggle({ id, title, className = '' }) {
  const { isFavorite, notifiesFor, setFavoriteNotify } = useFavorites();
  const { supported, permission, enabled } = useNotificationStatus();

  if (!supported || !isFavorite(id)) return null;

  const active = notifiesFor(id);
  const blocked = permission === 'denied';

  const handleClick = async () => {
    const next = !active;
    setFavoriteNotify(id, next);
    // Turning one anime on also asks for permission when notifications are off.
    if (next && !enabled && !blocked) await enableNotifications();
  };

  const hint = blocked
    ? 'Notifications are blocked in your browser settings'
    : active
      ? enabled
        ? `You will be notified about new episodes of ${title}`
        : `Turn on notifications to be told about ${title}`
      : `Notifications for ${title} are off`;

  return (
    <button
      type='button'
      className={`notify-toggle${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={active}
      onClick={handleClick}
      disabled={blocked}
      title={hint}
    >
      <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
        {active ? (
          <path d='M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z' />
        ) : (
          <path d='M20.8 19.4 4.6 3.2 3.2 4.6l3.3 3.3A6.9 6.9 0 0 0 5 11v5l-2 2v1h14.6l1.8 1.8 1.4-1.4zM12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6.8V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16c-.7.15-1.37.42-1.97.78L19 15.2z' />
        )}
      </svg>
      <span>{active ? 'Notifications on' : 'Notifications off'}</span>
    </button>
  );
}

export default NotifyToggle;
