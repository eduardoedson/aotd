import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Calendar from './Calendar';

vi.mock('./Day', () => ({
  default: ({ date }) => <div>Schedule for {date}</div>,
}));

describe('Calendar', () => {
  it('renders the date picker and navigation controls', () => {
    render(
      <MemoryRouter initialEntries={['/2026-10-20']}>
        <Routes>
          <Route path='/:date' element={<Calendar />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Back one day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advance one day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tuesday, 20 Oct 2026/i })).toBeInTheDocument();
  });
});
