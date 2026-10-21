import Image from '../assets/images/error.webp';

// Friendly error card: illustration, short title, optional detail and actions.
// Without a title, the message itself is shown as the title.
function Error({ title, msg, children }) {
  const heading = title || msg || 'Oops, something went wrong...';
  const detail = title ? msg : null;

  return (
    <div className='errorCmp-container' role='alert'>
      <div className='errorCmp-art' aria-hidden='true'>
        <img src={Image} alt='' />
      </div>
      <h2 className='errorCmp-title'>{heading}</h2>
      {detail ? <p className='errorCmp-msg'>{detail}</p> : null}
      {children ? <div className='errorCmp-actions'>{children}</div> : null}
    </div>
  );
}

export default Error;
