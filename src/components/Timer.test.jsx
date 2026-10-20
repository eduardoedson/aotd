import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Timer, { formatTime } from './Timer';

afterEach(() => {
  vi.useRealTimers();
});

describe('Timer', () => {
  it('formats durations longer than one hour', () => {
    expect(formatTime(3661)).toBe('01h 01m 01s');
  });

  it('stops at zero and displays the released state', () => {
    vi.useFakeTimers();
    render(<Timer timeLeft={1} />);

    expect(screen.getByText('00h 00m 01s')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Released!')).toBeInTheDocument();
  });
});
