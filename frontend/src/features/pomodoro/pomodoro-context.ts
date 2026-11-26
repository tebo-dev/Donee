import { createContext, useContext } from 'react';
import type { usePomodoroTimer } from './usePomodoroTimer';

export const PomodoroContext = createContext<
  | (ReturnType<typeof usePomodoroTimer> & {
      workspaceId: string;
      setWorkspaceId: (id: string) => void;
    })
  | null
>(null);
export function usePomodoro() {
  const value = useContext(PomodoroContext);
  if (!value) throw new Error('Pomodoro requires its provider');
  return value;
}
