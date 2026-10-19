import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type ApiOptions } from '../../lib/api';
import type { ZodType } from 'zod';
import { userSchema } from './contracts';
import { AuthContext, type Session } from './auth-context';

const storageKey = 'donee-session-token';
function readToken() {
  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}
function saveToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(storageKey, token);
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* In-memory sign-in still works when storage is blocked. */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialToken] = useState(readToken);
  const token = useRef(initialToken);
  const generation = useRef(0);
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session>({
    status: initialToken ? 'loading' : 'anonymous',
    user: null,
  });
  const signOut = useCallback(() => {
    generation.current += 1;
    token.current = null;
    saveToken(null);
    queryClient.clear();
    setSession({ status: 'anonymous', user: null });
  }, [queryClient]);
  const restore = useCallback(async () => {
    if (!token.current) return;
    const version = generation.current;
    try {
      const user = await api('/auth/me', userSchema, { token: token.current });
      if (version === generation.current)
        setSession({ status: 'authenticated', user });
    } catch (error) {
      if (version !== generation.current) return;
      if (error instanceof ApiError && error.status === 401) signOut();
      else setSession({ status: 'unavailable', user: null });
    }
  }, [signOut]);
  useEffect(() => {
    void restore();
    const onFocus = () => {
      void restore();
    };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => {
      void restore();
    }, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [restore]);
  async function authenticate(accessToken: string) {
    const version = ++generation.current;
    const user = await api('/auth/me', userSchema, { token: accessToken });
    if (version !== generation.current) return;
    queryClient.clear();
    token.current = accessToken;
    saveToken(accessToken);
    setSession({ status: 'authenticated', user });
  }
  const request = useCallback(
    async <T,>(
      path: string,
      schema: ZodType<T>,
      options: Omit<ApiOptions, 'token'> = {},
    ) => {
      const version = generation.current;
      if (!token.current) throw new ApiError('Please sign in again.', 401);
      try {
        const result = await api(path, schema, {
          ...options,
          token: token.current,
        });
        if (version !== generation.current)
          throw new ApiError('Your session changed. Please try again.', 401);
        return result;
      } catch (error) {
        if (
          version === generation.current &&
          error instanceof ApiError &&
          error.status === 401
        )
          signOut();
        throw error;
      }
    },
    [signOut],
  );
  return (
    <AuthContext.Provider
      value={{
        session,
        authenticate,
        signOut,
        request,
        retry: () => {
          void restore();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
