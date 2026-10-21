import DatePicker from 'react-datepicker';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Day from './Day';
import Error from './Error';
import ScheduleFilters from './ScheduleFilters';
import LeftArrow from '../assets/images/left_arrow.svg';
import RightArrow from '../assets/images/right_arrow.svg';
import {
  formatLongDate,
  isValidDate,
  isoToLocalDate,
  localDateToIso,
  months,
  shiftIsoDate,
} from '../services/globals';
import { useScheduleFilters } from '../services/filters';

import 'react-datepicker/dist/react-datepicker.css';

// Everything is derived from the URL, so there is no duplicated state to keep in sync.
function Calendar() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { date } = useParams();
  const filters = useScheduleFilters();

  if (!isValidDate(date)) {
    return <Error msg='Invalid date. Use the YYYY-MM-DD format.' />;
  }

  const goTo = (isoDate) => navigate(`/${isoDate}${search}`);

  return (
    <div className='calendar-container'>
      <div className='calendar-controllers'>
        <button
          type='button'
          className='calendar-controller-button'
          onClick={() => goTo(shiftIsoDate(date, -1))}
          aria-label='Back one day'
        >
          <img src={LeftArrow} alt='' className='calendar-controller-leftArrow' />
        </button>
        <DatePicker
          withPortal
          enableTabLoop={false}
          fixedHeight
          selected={isoToLocalDate(date)}
          todayButton='Go To Today'
          onSelect={(picked) => picked && goTo(localDateToIso(picked))}
          renderCustomHeader={({
            date: visibleMonth,
            decreaseMonth,
            increaseMonth,
            prevMonthButtonDisabled,
            nextMonthButtonDisabled,
          }) => (
            <div className='calendar-picker-header'>
              <button
                type='button'
                className='calendar-picker-navigation'
                onClick={decreaseMonth}
                disabled={prevMonthButtonDisabled}
                aria-label='Previous month'
              >
                <img src={LeftArrow} alt='' />
              </button>
              <div className='calendar-picker-heading'>
                <span>Choose a date</span>
                <strong>
                  {months[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
                </strong>
              </div>
              <button
                type='button'
                className='calendar-picker-navigation'
                onClick={increaseMonth}
                disabled={nextMonthButtonDisabled}
                aria-label='Next month'
              >
                <img src={RightArrow} alt='' />
              </button>
            </div>
          )}
          customInput={
            <button type='button' className='calendar-controller-selected'>
              {formatLongDate(date)}
            </button>
          }
        />
        <button
          type='button'
          className='calendar-controller-button'
          onClick={() => goTo(shiftIsoDate(date, 1))}
          aria-label='Advance one day'
        >
          <img src={RightArrow} alt='' className='calendar-controller-rightArrow' />
        </button>
      </div>
      <ScheduleFilters filters={filters} />
      <Day key={date} date={date} filters={filters} />
    </div>
  );
}

export default Calendar;
