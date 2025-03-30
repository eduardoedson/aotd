import { Link } from 'react-router-dom';
import { getToday } from '../services/globals';

function Footer () {
    return (
        <footer className='footer-container'>
            <div className='footer-content'>
                <span className='footer-rights'>© {getToday().split('-')[0]}「AOTD :: Anime of The Day」・ All Rights Reserved</span>
                <span className='footer-data-proveider'>Data provided by <Link to={'https://anilist.co/'} target='_blank'>anilist</Link></span>
            </div>
        </footer>
    );
}

export default Footer;