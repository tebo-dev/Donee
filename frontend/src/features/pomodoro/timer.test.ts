import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatTime, initialTimer, timerReducer } from './timer';
import { usePomodoroTimer } from './usePomodoroTimer';

afterEach(() => vi.useRealTimers());

describe('Pomodoro timer', () => {
  it.each([25, 50] as const)(
    'finishes %i-minute focus and its break without starting unattended sessions',
    (preset) => {
      const running = timerReducer(initialTimer(preset), {
        type: 'start',
        now: 1000,
      });
      const ready = timerReducer(running, {
        type: 'tick',
        now: 1000 + preset * 60_000 + 90_000,
      });
      expect(ready.phase).toBe('break');
      expect(ready.remainingMs).toBe((preset / 5) * 60_000);
      expect(ready.deadline).toBeNull();
      expect(ready.announcement).toContain('Focus complete');
      const rest = timerReducer(ready, { type: 'start', now: 2_000_000 });
      const next = timerReducer(rest, {
        type: 'tick',
        now: 2_000_000 + (preset / 5) * 60_000,
      });
      expect(next.phase).toBe('focus');
      expect(next.remainingMs).toBe(preset * 60_000);
      expect(next.deadline).toBeNull();
      expect(next.announcement).toContain('Break complete');
    },
  );
  it('pauses using elapsed wall time, resumes the remainder and resets the chosen preset', () => {
    const running = timerReducer(initialTimer(50), {
      type: 'start',
      now: 1000,
    });
    const paused = timerReducer(running, { type: 'pause', now: 65_500 });
    expect(paused.remainingMs).toBe(2_935_500);
    expect(formatTime(paused.remainingMs)).toBe('48:56');
    expect(timerReducer(paused, { type: 'tick', now: 1_000_000 })).toEqual(
      paused,
    );
    const resumed = timerReducer(paused, { type: 'start', now: 1_000_000 });
    expect(resumed.deadline).toBe(3_935_500);
    expect(timerReducer(resumed, { type: 'reset' })).toEqual(initialTimer(50));
  });
  it('handles pausing just after expiry and ignores preset changes while running', () => {
    const running = timerReducer(initialTimer(), { type: 'start', now: 0 });
    expect(timerReducer(running, { type: 'preset', preset: 50 })).toEqual(
      running,
    );
    const next = timerReducer(running, { type: 'pause', now: 1_500_001 });
    expect(next.phase).toBe('break');
    expect(next.remainingMs).toBe(300_000);
    expect(timerReducer(next, { type: 'preset', preset: 50 })).toEqual(
      initialTimer(50),
    );
  });
  it('catches up after a sleeping tab and releases its interval on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { result, unmount } = renderHook(() => usePomodoroTimer());
    act(() => result.current.dispatch({ type: 'start', now: Date.now() }));
    act(() => vi.advanceTimersByTime(1000));
    expect(formatTime(result.current.state.remainingMs)).toBe('24:59');
    act(() => {
      vi.setSystemTime(1_600_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.state.phase).toBe('break');
    expect(result.current.state.deadline).toBeNull();
    act(() => result.current.dispatch({ type: 'start', now: Date.now() }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
