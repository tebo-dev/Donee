export type Preset = 25 | 50;
export type Phase = 'focus' | 'break';
export type TimerState = {
  preset: Preset;
  phase: Phase;
  remainingMs: number;
  deadline: number | null;
  announcement: string;
};
export type TimerAction =
  | { type: 'start' | 'pause' | 'tick'; now: number }
  | { type: 'reset' | 'clear' }
  | { type: 'preset'; preset: Preset };

export function duration(preset: Preset, phase: Phase) {
  return (phase === 'focus' ? preset : preset / 5) * 60_000;
}
export function initialTimer(preset: Preset = 25): TimerState {
  return {
    preset,
    phase: 'focus',
    remainingMs: duration(preset, 'focus'),
    deadline: null,
    announcement: '',
  };
}
function advance(state: TimerState, now: number): TimerState {
  if (state.deadline === null) return state;
  const remainingMs = Math.max(0, state.deadline - now);
  if (remainingMs > 0) return { ...state, remainingMs };
  const phase = state.phase === 'focus' ? 'break' : 'focus';
  return {
    ...state,
    phase,
    remainingMs: duration(state.preset, phase),
    deadline: null,
    announcement:
      state.phase === 'focus'
        ? `Focus complete. Start your ${state.preset / 5}-minute break when you are ready.`
        : 'Break complete. Start your next focus session when you are ready.',
  };
}
export function timerReducer(
  state: TimerState,
  action: TimerAction,
): TimerState {
  switch (action.type) {
    case 'tick':
      return advance(state, action.now);
    case 'start':
      return state.deadline !== null
        ? state
        : {
            ...state,
            deadline: action.now + state.remainingMs,
            announcement: '',
          };
    case 'pause': {
      const current = advance(state, action.now);
      return { ...current, deadline: null };
    }
    case 'clear':
      return initialTimer();
    case 'reset':
      return initialTimer(state.preset);
    case 'preset':
      return state.deadline === null ? initialTimer(action.preset) : state;
  }
}
export function formatTime(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
