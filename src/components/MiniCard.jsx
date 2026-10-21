import { getSafeExternalUrl } from '../services/globals';

function MiniCard({ image, text }) {
  const src = getSafeExternalUrl(image);

  return (
    <div className='miniCard-container'>
      {src ? (
        <img src={src} alt={text} className='miniCard-image' loading='lazy' decoding='async' />
      ) : (
        <div className='miniCard-image miniCard-image-placeholder' aria-hidden='true' />
      )}
      <span className='miniCard-text'>{text}</span>
    </div>
  );
}

export default MiniCard;
