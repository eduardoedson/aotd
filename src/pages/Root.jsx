import { Outlet, ScrollRestoration } from 'react-router-dom';
import InfoBar from '../components/InfoBar';
import Footer from '../components/Footer';
import CookieConsent from '../components/CookieConsent';

function Root() {
  return (
    <div className='root-container'>
      <a className='skip-link' href='#main-content'>
        Skip to content
      </a>
      <InfoBar />
      <main id='main-content' className='root-children-container'>
        <Outlet />
      </main>
      <Footer />
      <CookieConsent />
      <ScrollRestoration />
    </div>
  );
}

export default Root;
