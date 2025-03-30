import { Link } from 'react-router-dom';
import Logo from '../assets/images/logo_navbar.png';
import { getToday } from '../services/globals';
function Navbar () {
    const year = getToday().split('-')[0];

    return (
        <div className='navbar-container'>
            <img src={Logo} alt='Menu Logo AOTD' onClick={() => window.open('/', '_self')} />

            <div className='navbar-menu-items'>
                <div className='navbar-menu-item'><Link to={'/'}>Home</Link></div>
                <div className='navbar-menu-item'><Link to={`/search/ANIME/1/${year}`}>Anime</Link></div>
                <div className='navbar-menu-item'><Link to={`/search/MANGA/1/${year}`}>Manga</Link></div>
            </div>
        </div>
    )
}

export default Navbar;