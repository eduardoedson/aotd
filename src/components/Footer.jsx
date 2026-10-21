import { useState } from 'react';
import { openConsentDialog } from '../services/consent';

function Footer() {
  const [year] = useState(() => new Date().getUTCFullYear());

  return (
    <footer className='footer-container'>
      <div className='footer-content'>
        <span className='footer-rights'>
          © {year}「AOTD :: Anime of The Day」・ All Rights Reserved
        </span>
        <span className='footer-data-provider'>
          Data provided by{' '}
          <a href='https://anilist.co/' target='_blank' rel='noopener noreferrer'>
            AniList
          </a>
        </span>
        <button type='button' className='footer-link-button' onClick={openConsentDialog}>
          Cookie settings
        </button>
      </div>
    </footer>
  );
}

export default Footer;
