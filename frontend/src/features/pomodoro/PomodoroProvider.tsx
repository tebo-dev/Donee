import { useState, type ReactNode } from 'react';
import { PomodoroContext } from './pomodoro-context';
import { usePomodoroTimer } from './usePomodoroTimer';
import { useAuth } from '../auth/auth-context';

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const timer = usePomodoroTimer();
  const [workspaceId, setWorkspaceId] = useState('');
  const { session } = useAuth();
  const userId = session.user?.id;
  const [owner, setOwner] = useState(userId);
  // Clear account-scoped timer state without remounting Appearance or other UI.
  if (owner !== userId) {
    setOwner(userId);
    setWorkspaceId('');
    timer.dispatch({ type: 'clear' });
  }
  return (
    <PomodoroContext.Provider value={{ ...timer, workspaceId, setWorkspaceId }}>
      {children}
    </PomodoroContext.Provider>
  );
}
