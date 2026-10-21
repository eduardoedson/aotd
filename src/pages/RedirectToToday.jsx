import { Navigate, useLocation } from 'react-router-dom';
import { getToday } from '../services/globals';

// Replaces "/" with today's date so the back button does not bounce on the redirect.
function RedirectToToday() {
  const { search } = useLocation();
  return <Navigate to={`/${getToday()}${search}`} replace />;
}

export default RedirectToToday;
