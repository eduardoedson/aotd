import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import '../src/assets/styles/main.scss';

const ErrorPage = lazy(() => import('./pages/Error'));
const Home = lazy(() => import('./pages/Home'));
const Detail = lazy(() => import('./pages/Detail'));
const renderPage = (page) => <Suspense fallback={null}>{page}</Suspense>;

const root = ReactDOM.createRoot(document.getElementById('root'));
const router = createBrowserRouter([{
    path: '/',
    element: <App />,
    errorElement: renderPage(<ErrorPage msg={'Unexpected application error.'} />),
    children: [
      {
        index: true,
        element: renderPage(<Home />),
      },
      {
        path: ':date',
        element: renderPage(<Home />),
      },
      {
        path: ':date/:id',
        element: renderPage(<Detail />),
      },
      {
        path: '*',
        element: renderPage(<ErrorPage msg={'404 Page Not Found'} />),
      }
    ],
}]);

root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
