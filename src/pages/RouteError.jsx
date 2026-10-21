import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import Error from './Error';
import { reportError } from '../services/monitoring';

// Error boundary of the router: shows the friendly page and reports the crash.
function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    if (!notFound) reportError(error, { source: 'route' });
  }, [error, notFound]);

  return <Error msg={notFound ? '404 Page Not Found' : 'Unexpected application error.'} />;
}

export default RouteError;
