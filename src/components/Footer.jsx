import { useState } from 'react';

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
      </div>
    </footer>
  );
}

export default Footer;
