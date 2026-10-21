import { useNow } from '../services/useNow';
import { getBadges } from '../services/badges';

function CardBadges({ episode, totalEpisodes, airingAt, duration, className = '' }) {
  const now = useNow();
  const badges = getBadges({ episode, totalEpisodes, airingAt, duration, now });

  if (badges.length === 0) return null;

  return (
    <div className={`badges${className ? ` ${className}` : ''}`}>
      {badges.map((badge) => (
        <span key={badge.key} className={`badge badge-${badge.tone}`}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

export default CardBadges;
