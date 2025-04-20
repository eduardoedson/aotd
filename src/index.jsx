import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorPage from './pages/Error';
import Home from './pages/Home';
import Detail from './pages/Detail';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import '../src/assets/styles/main.scss';

const root = ReactDOM.createRoot(document.getElementById('root'));
const router = createBrowserRouter([{
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        path: '/:date?',
        element: <Home />,
      },
      {
        exact: true,
        path: '/:date/:id',
        element: <Detail />,
      },
      {
        path: '*',
        element: <ErrorPage msg={'404 Page Not Found'} />,
      }
    ],
}]);

root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
