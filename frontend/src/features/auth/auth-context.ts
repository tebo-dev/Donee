import { createContext, useContext } from 'react';
import type { User } from './contracts';

export type Session = {
  status: 'loading' | 'anonymous' | 'authenticated' | 'unavailable';
  user: User | null;
};
export const AuthContext = createContext<{
  session: Session;
  authenticate: (token: string) => Promise<void>;
  signOut: () => void;
  retry: () => void;
} | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required.');
  return context;
}
