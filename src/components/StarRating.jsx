const STARS = '★★★★★';

// Pure CSS star rating: a dim row of stars with a clipped, coloured copy on top.
function StarRating({ score }) {
  const value = Math.round((score / 20) * 10) / 10;
  const label = `Rated ${value.toFixed(1)} out of 5 (${score}% average score)`;

  return (
    <div className='star-rating' role='img' aria-label={label} title={label}>
      <span className='star-rating-stars' aria-hidden='true'>
        <span className='star-rating-base'>{STARS}</span>
        <span
          className='star-rating-fill'
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        >
          {STARS}
        </span>
      </span>
      <span className='star-rating-value' aria-hidden='true'>
        {value.toFixed(1)}
        <small> / 5</small>
      </span>
    </div>
  );
}

export default StarRating;
