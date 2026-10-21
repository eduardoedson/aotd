import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Day from './Day';
import WeekView from './WeekView';
import Error from './Error';
import ScheduleFilters from './ScheduleFilters';
import ActiveFilterChips from './ActiveFilterChips';
import LeftArrow from '../assets/images/left_arrow.svg';
import RightArrow from '../assets/images/right_arrow.svg';
import {
  formatLongDate,
  formatWeekRange,
  getToday,
  getWeekStart,
  isValidDate,
  shiftIsoDate,
} from '../services/globals';
import { useScheduleFilters } from '../services/filters';
import { useTimeZone } from '../services/timezone';

const isTypingTarget = (target) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// Everything is derived from the URL, so there is no duplicated state to keep in sync.
function Calendar() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { date } = useParams();
  const filters = useScheduleFilters();
  const timeZone = useTimeZone();
  const inputRef = useRef(null);
  const valid = isValidDate(date);
  const isWeek = filters.view === 'week';
  const step = isWeek ? 7 : 1;
  const today = getToday(timeZone);

  // Keyboard shortcuts: arrows move between days (or weeks), T jumps to today.
  const shortcutsRef = useRef(null);
  useEffect(() => {
    shortcutsRef.current = (event) => {
      if (!valid || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
        return;
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowLeft') navigate(`/${shiftIsoDate(date, -step)}${search}`);
      else if (event.key === 'ArrowRight') navigate(`/${shiftIsoDate(date, step)}${search}`);
      else if (event.key === 't' || event.key === 'T') navigate(`/${today}${search}`);
      else return;
      event.preventDefault();
    };
  });
  useEffect(() => {
    const onKeyDown = (event) => shortcutsRef.current?.(event);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!valid) {
    return <Error msg='Invalid date. Use the YYYY-MM-DD format.' />;
  }

  const goTo = (isoDate) => navigate(`/${isoDate}${search}`);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  const dateLabel = isWeek ? formatWeekRange(date) : formatLongDate(date);
  const isCurrent = isWeek ? getWeekStart(date) === getWeekStart(today) : date === today;

  return (
    <div className='calendar-container'>
      <div className='calendar-view-toggle' role='group' aria-label='Schedule view'>
        <button
          type='button'
          className={!isWeek ? 'is-active' : ''}
          aria-pressed={!isWeek}
          onClick={() => filters.setView('day')}
        >
          Day
        </button>
        <button
          type='button'
          className={isWeek ? 'is-active' : ''}
          aria-pressed={isWeek}
          onClick={() => filters.setView('week')}
        >
          Week
        </button>
      </div>

      <div className='calendar-controllers'>
        <button
          type='button'
          className='calendar-controller-button'
          onClick={() => goTo(shiftIsoDate(date, -step))}
          aria-label={isWeek ? 'Previous week' : 'Back one day'}
          title={isWeek ? 'Previous week (←)' : 'Previous day (←)'}
        >
          <img src={LeftArrow} alt='' className='calendar-controller-leftArrow' />
        </button>
        <div className='calendar-date-field'>
          <button
            type='button'
            className='calendar-controller-selected'
            onClick={openPicker}
            aria-label={`Choose a date, currently ${dateLabel}`}
          >
            {dateLabel}
          </button>
          <input
            ref={inputRef}
            className='calendar-date-input'
            type='date'
            tabIndex={-1}
            aria-hidden='true'
            value={date}
            onChange={(event) => isValidDate(event.target.value) && goTo(event.target.value)}
          />
        </div>
        <button
          type='button'
          className='calendar-controller-button'
          onClick={() => goTo(shiftIsoDate(date, step))}
          aria-label={isWeek ? 'Next week' : 'Advance one day'}
          title={isWeek ? 'Next week (→)' : 'Next day (→)'}
        >
          <img src={RightArrow} alt='' className='calendar-controller-rightArrow' />
        </button>
      </div>

      {!isCurrent ? (
        <button
          type='button'
          className='calendar-today'
          onClick={() => goTo(today)}
          title='Today (T)'
        >
          {isWeek ? 'Go to this week' : 'Go to today'}
        </button>
      ) : null}

      <ScheduleFilters filters={filters} />
      <ActiveFilterChips filters={filters} />

      {isWeek ? (
        <WeekView
          key={`${getWeekStart(date)}-${timeZone}`}
          date={date}
          timeZone={timeZone}
          filters={filters}
        />
      ) : (
        <Day key={`${date}-${timeZone}`} date={date} timeZone={timeZone} filters={filters} />
      )}
    </div>
  );
}

export default Calendar;
