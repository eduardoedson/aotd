import ImgLogo from '../assets/images/logo_home.webp';

function Logo() {
  return (
    <div className='logo-container'>
      <img src={ImgLogo} alt='AOTD Logo' width='600' height='600' fetchPriority='high' />
    </div>
  );
}

export default Logo;
