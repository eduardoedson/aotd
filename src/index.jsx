import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import Loading from './components/Loading';
import RedirectToToday from './pages/RedirectToToday';
import { registerServiceWorker } from './services/serviceWorker';

import './assets/styles/main.scss';

const ErrorPage = lazy(() => import('./pages/Error'));
const Home = lazy(() => import('./pages/Home'));
const Detail = lazy(() => import('./pages/Detail'));

const renderPage = (page) => <Suspense fallback={<Loading />}>{page}</Suspense>;

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: renderPage(<ErrorPage msg='Unexpected application error.' />),
    children: [
      { index: true, element: <RedirectToToday /> },
      { path: ':date', element: renderPage(<Home />) },
      { path: ':date/:id', element: renderPage(<Detail />) },
      { path: '*', element: renderPage(<ErrorPage msg='404 Page Not Found' />) },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

registerServiceWorker();
