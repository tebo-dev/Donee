import { useEffect, useReducer } from 'react';
import { initialTimer, timerReducer } from './timer';

export function usePomodoroTimer() {
  const [state, dispatch] = useReducer(timerReducer, undefined, () =>
    initialTimer(),
  );
  useEffect(() => {
    if (state.deadline === null) return;
    const tick = () => dispatch({ type: 'tick', now: Date.now() });
    const interval = window.setInterval(tick, 250);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [state.deadline]);
  return { state, dispatch };
}
