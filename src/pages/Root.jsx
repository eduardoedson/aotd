import { Outlet, ScrollRestoration } from 'react-router-dom';
import InfoBar from '../components/InfoBar';
import Footer from '../components/Footer';

function Root() {
  return (
    <div className='root-container'>
      <InfoBar />
      <main className='root-children-container'>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}

export default Root;
