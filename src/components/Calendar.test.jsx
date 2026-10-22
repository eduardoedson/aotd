import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Calendar from './Calendar';

vi.mock('./Day', () => ({
  default: ({ date }) => <div>Schedule for {date}</div>,
}));

vi.mock('./WeekView', () => ({
  default: ({ date }) => <div>Week of {date}</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid='location'>{`${location.pathname}${location.search}`}</div>;
}

const renderCalendar = (entry = '/2026-10-20') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path='/:date'
          element={
            <>
              <Calendar />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('Calendar', () => {
  it('renders the date field and navigation controls', () => {
    renderCalendar();

    expect(screen.getByRole('button', { name: 'Back one day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advance one day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tuesday, 20 Oct 2026/ })).toBeInTheDocument();
    expect(screen.getByText('Schedule for 2026-10-20')).toBeInTheDocument();
  });

  it('navigates with the native date input', () => {
    renderCalendar();
    const input = document.querySelector('input[type="date"]');
    fireEvent.change(input, { target: { value: '2026-12-25' } });
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-12-25');
  });

  it('opens the styled date picker and selects a day', () => {
    renderCalendar();

    fireEvent.click(screen.getByRole('button', { name: /Choose a date/ }));
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeInTheDocument();
    expect(screen.getByText('October 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Friday, 23 Oct 2026' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-23');
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).not.toBeInTheDocument();
  });

  it('moves between days and keeps the active filters', () => {
    renderCalendar('/2026-10-20?genre=Action');

    fireEvent.click(screen.getByRole('button', { name: 'Advance one day' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-21?genre=Action');
    expect(screen.getByText('Schedule for 2026-10-21')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back one day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back one day' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-19?genre=Action');
  });

  it('supports keyboard shortcuts outside text fields', () => {
    renderCalendar();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-21');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-20');

    const search = screen.getByRole('searchbox', { name: 'Search titles' });
    fireEvent.keyDown(search, { key: 'ArrowRight' });
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-20');
  });

  it('switches to the week view and moves by whole weeks', () => {
    renderCalendar();

    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-20?view=week');
    expect(screen.getByText('Week of 2026-10-20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Oct 19 - Oct 25, 2026/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-27?view=week');
  });

  it('stores filters in the URL', () => {
    renderCalendar();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search titles' }), {
      target: { value: 'frieren' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Only my favorites' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/2026-10-20?q=frieren&fav=1');

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/2026-10-20$/);
  });

  it('shows an error for invalid dates', () => {
    renderCalendar('/2026-02-30');
    expect(screen.getByText('Invalid date. Use the YYYY-MM-DD format.')).toBeInTheDocument();
  });
});
