import Image from '../assets/images/error.webp';

function Error({ msg, children }) {
  return (
    <div className='errorCmp-container' role='alert'>
      <img src={Image} alt='' />
      <span className='errorCmp-msg'>{msg || 'Oops, something went wrong...'}</span>
      {children ? <div className='errorCmp-actions'>{children}</div> : null}
    </div>
  );
}

export default Error;
