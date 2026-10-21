import Clock from './Clock';
import { Link } from 'react-router-dom';
import { setTimeZone, useTimeZone } from '../services/timezone';
import { usePreferences } from '../services/preferences';

function TimeZoneToggle() {
  const timeZone = useTimeZone();

  return (
    <div className='timezone-toggle' role='group' aria-label='Time zone'>
      <button
        type='button'
        className={timeZone === 'local' ? 'is-active' : ''}
        aria-pressed={timeZone === 'local'}
        onClick={() => setTimeZone('local')}
        title='Show days and times in your time zone'
      >
        Local
      </button>
      <button
        type='button'
        className={timeZone === 'utc' ? 'is-active' : ''}
        aria-pressed={timeZone === 'utc'}
        onClick={() => setTimeZone('utc')}
        title='Show days and times in UTC'
      >
        UTC
      </button>
    </div>
  );
}

function InfoBar() {
  const preferences = usePreferences();
  return (
    <div className='infoBar-container'>
      <Link className='infoBar-library' to='/library'>
        My library
      </Link>
      <div className='preferences-controls' aria-label='Display preferences'>
        <button
          type='button'
          onClick={() =>
            preferences.update({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })
          }
          title='Toggle color theme'
          aria-label='Toggle color theme'
        >
          {preferences.theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          type='button'
          onClick={() =>
            preferences.update({
              density: preferences.density === 'comfortable' ? 'compact' : 'comfortable',
            })
          }
          title='Toggle card density'
          aria-label='Toggle card density'
        >
          ▦
        </button>
      </div>
      <TimeZoneToggle />
      <Clock />
    </div>
  );
}

export default InfoBar;
