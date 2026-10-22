// Tells the visitor that AniList could not be reached and the data on screen is a
// copy saved earlier, so countdowns and episode numbers may be out of date.
function StaleNotice({ since }) {
  if (!since) return null;
  const savedAt = new Date(since);
  const label = savedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <p className='stale-notice' role='status'>
      AniList could not be reached. Showing data saved on{' '}
      <time dateTime={savedAt.toISOString()}>{label}</time>, which may be out of date.
    </p>
  );
}

export default StaleNotice;
