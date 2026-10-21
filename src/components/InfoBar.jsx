import Clock from './Clock';
import { setTimeZone, useTimeZone } from '../services/timezone';

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
  return (
    <div className='infoBar-container'>
      <TimeZoneToggle />
      <Clock />
    </div>
  );
}

export default InfoBar;
