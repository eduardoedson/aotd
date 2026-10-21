import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import Loading from './components/Loading';
import RedirectToToday from './pages/RedirectToToday';
import RouteError from './pages/RouteError';
import ErrorPage from './pages/Error';
import { registerServiceWorker } from './services/serviceWorker';
import { initMonitoring } from './services/monitoring';
import { initConsent } from './services/privacy';

// Self-hosted font: no request to Google Fonts, so no visitor IP is shared with Google.
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-700.css';
import './assets/styles/main.scss';

initMonitoring();
initConsent();

const Home = lazy(() => import('./pages/Home'));
const Detail = lazy(() => import('./pages/Detail'));
const Library = lazy(() => import('./pages/Library'));

const renderPage = (page) => <Suspense fallback={<Loading />}>{page}</Suspense>;

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <RedirectToToday /> },
      { path: ':date', element: renderPage(<Home />) },
      { path: ':date/:id', element: renderPage(<Detail />) },
      { path: 'library', element: renderPage(<Library />) },
      { path: '*', element: <ErrorPage msg='404 Page Not Found' /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

registerServiceWorker();
