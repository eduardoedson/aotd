import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Timer from './Timer';
import { formatTime } from '../services/globals';

afterEach(() => {
  vi.useRealTimers();
});

describe('Timer', () => {
  it('formats durations longer than one hour and one day', () => {
    expect(formatTime(3661)).toBe('01h 01m 01s');
    expect(formatTime(90061)).toBe('1d 01h 01m 01s');
  });

  it('counts down to an absolute timestamp and shows the released state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T00:00:00.000Z'));
    const airingAt = Date.parse('2026-10-21T00:00:02.000Z') / 1000;

    render(<Timer airingAt={airingAt} />);

    expect(screen.getByText('00h 00m 02s')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('00h 00m 01s')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Released!')).toBeInTheDocument();
  });
});
