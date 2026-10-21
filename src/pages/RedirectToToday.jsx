import { Navigate, useLocation } from 'react-router-dom';
import { getToday } from '../services/globals';
import { useTimeZone } from '../services/timezone';

// Replaces "/" with today's date so the back button does not bounce on the redirect.
function RedirectToToday() {
  const { search } = useLocation();
  const timeZone = useTimeZone();
  return <Navigate to={`/${getToday(timeZone)}${search}`} replace />;
}

export default RedirectToToday;
