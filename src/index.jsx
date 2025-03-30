import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorPage from './pages/Error';
import Home from './pages/Home';
import Detail from './pages/Detail';
import Search from './pages/Search';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import '../src/assets/styles/main.scss';

const root = ReactDOM.createRoot(document.getElementById('root'));
const router = createBrowserRouter([{
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        path: '/',
        element: <Home />,
      },
      {
        exact: true,
        path: ':id',
        element: <Detail />,
      },
      {
        path: 'search/:type?/:page?/:year?/:status?/:search?',
        element: <Search />,
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
