import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Day from './Day';
import WeekView from './WeekView';
import Error from './Error';
import ScheduleFilters from './ScheduleFilters';
import ActiveFilterChips from './ActiveFilterChips';
import TitleSearchResults from './TitleSearchResults';
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

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const monthKeyFor = (isoDate) => isoDate.slice(0, 7);

function DatePicker({ value, today, onSelect, onClose }) {
  const [monthKey, setMonthKey] = useState(() => monthKeyFor(value));
  const panelRef = useRef(null);
  const [year, month] = monthKey.split('-').map(Number);
  const monthStart = `${monthKey}-01`;
  const firstWeekday = new Date(`${monthStart}T00:00:00Z`).getUTCDay();
  const leadingDays = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const days = useMemo(
    () => Array.from({ length: 42 }, (_, index) => shiftIsoDate(monthStart, index - leadingDays)),
    [monthStart, leadingDays],
  );

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) onClose();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const moveMonth = (amount) => {
    const next = new Date(Date.UTC(year, month - 1 + amount, 1));
    setMonthKey(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div ref={panelRef} className='calendar-picker' role='dialog' aria-label='Choose date'>
      <div className='calendar-picker-header'>
        <button type='button' onClick={() => moveMonth(-1)} aria-label='Previous month'>
          <span aria-hidden='true'>←</span>
        </button>
        <strong>{MONTH_LABELS[month - 1]} {year}</strong>
        <button type='button' onClick={() => moveMonth(1)} aria-label='Next month'>
          <span aria-hidden='true'>→</span>
        </button>
      </div>
      <div className='calendar-picker-weekdays' aria-hidden='true'>
        {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className='calendar-picker-grid'>
        {days.map((day) => {
          const inMonth = day.startsWith(monthKey);
          return (
            <button
              key={day}
              type='button'
              className={`${inMonth ? '' : 'is-outside'}${day === today ? ' is-today' : ''}${day === value ? ' is-selected' : ''}`}
              aria-label={formatLongDate(day)}
              aria-pressed={day === value}
              onClick={() => onSelect(day)}
            >
              {Number(day.slice(-2))}
            </button>
          );
        })}
      </div>
      <div className='calendar-picker-footer'>
        <button type='button' onClick={() => onSelect(today)}>Today</button>
        <span>Use ← → to browse the schedule</span>
      </div>
    </div>
  );
}

// Everything is derived from the URL, so there is no duplicated state to keep in sync.
function Calendar() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { date } = useParams();
  const filters = useScheduleFilters();
  const timeZone = useTimeZone();
  const inputRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const closePicker = () => setPickerOpen(false);

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
            onClick={() => setPickerOpen((open) => !open)}
            aria-label={`Choose a date, currently ${dateLabel}`}
            aria-expanded={pickerOpen}
            aria-haspopup='dialog'
          >
            <span className='calendar-date-icon' aria-hidden='true'>
              <span>{date.slice(-2)}</span>
            </span>
            <span className='calendar-date-copy'>
              <small>{isWeek ? 'Selected week' : isCurrent ? 'Today' : 'Selected date'}</small>
              <strong>{dateLabel}</strong>
            </span>
            <span className={`calendar-date-chevron${pickerOpen ? ' is-open' : ''}`} aria-hidden='true'>⌄</span>
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
          {pickerOpen ? (
            <DatePicker
              value={date}
              today={today}
              onClose={closePicker}
              onSelect={(selected) => {
                closePicker();
                goTo(selected);
              }}
            />
          ) : null}
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
      {filters.query ? (
        <TitleSearchResults query={filters.query} date={date} timeZone={timeZone} />
      ) : null}

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
