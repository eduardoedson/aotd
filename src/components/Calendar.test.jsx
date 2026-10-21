import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Calendar from './Calendar';

vi.mock('./Day', () => ({
  default: ({ date }) => <div>Schedule for {date}</div>,
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
  it('renders the date picker and navigation controls', () => {
    renderCalendar();

    expect(screen.getByRole('button', { name: 'Back one day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advance one day' })).toBeInTheDocument();
    const dateButton = screen.getByRole('button', { name: /Tuesday, 20 Oct 2026/i });
    expect(screen.getByText('Schedule for 2026-10-20')).toBeInTheDocument();

    fireEvent.click(dateButton);
    expect(document.querySelector('.react-datepicker__tab-loop')).not.toBeInTheDocument();
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
