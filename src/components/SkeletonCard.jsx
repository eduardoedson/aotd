// Placeholder with the same size as a schedule card, shown while data loads.
function SkeletonCard() {
  return (
    <div className='card-container' aria-hidden='true'>
      <div className='card card-skeleton'>
        <div className='skeleton-line skeleton-line-title' />
        <div className='skeleton-line skeleton-line-short' />
      </div>
    </div>
  );
}

export default SkeletonCard;
