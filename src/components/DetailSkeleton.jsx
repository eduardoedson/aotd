// Placeholder layout for the detail page while the media loads.
function DetailSkeleton() {
  return (
    <div className='detail-container' aria-busy='true' aria-label='Loading details'>
      <div className='detail-content'>
        <div className='detail-layout detail-skeleton'>
          <div className='detail-column detail-column-left'>
            <div className='detail-block detail-block-cover'>
              <div className='detail-cover skeleton-block' />
            </div>
          </div>
          <div className='detail-column detail-column-right'>
            <div className='detail-block detail-block-header'>
              <div className='skeleton-line skeleton-line-short' />
              <div className='skeleton-line skeleton-line-heading' />
              <div className='skeleton-line' />
              <div className='skeleton-line' />
              <div className='skeleton-line skeleton-line-medium' />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailSkeleton;
