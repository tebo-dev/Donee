import {
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { messageSchema, userSchema, type TokenPair } from './contracts';
import { AuthContext, type Session } from './auth-context';
import { SessionClient } from './session-client';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new SessionClient());
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const logoutPending = useRef(false);
  const [session, setSession] = useState<Session>({
    status: client.snapshot() ? 'loading' : 'anonymous',
    user: null,
  });
  useEffect(() => {
    return client.subscribe((message) => {
      queryClient.clear();
      setSession({ status: 'anonymous', user: null });
      setNotice(message);
    });
  }, [client, queryClient]);
  const request = useMemo(() => client.request.bind(client), [client]);
  const restore = useCallback(async () => {
    if (!client.snapshot() || logoutPending.current) return;
    const id = client.snapshot()?.id;
    try {
      const user = await request('/auth/me', userSchema);
      if (client.snapshot()?.id === id && !logoutPending.current)
        setSession({ status: 'authenticated', user });
    } catch {
      if (client.snapshot()?.id === id && !logoutPending.current)
        setSession({ status: 'unavailable', user: null });
    }
  }, [client, request]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void restore();
    });
    const onFocus = () => {
      void restore();
    };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 30_000);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [restore]);
  async function authenticate(pair: TokenPair) {
    await client.install(pair);
    const id = client.snapshot()?.id;
    try {
      const user = await request('/auth/me', userSchema);
      queryClient.clear();
      setNotice('');
      setSession({ status: 'authenticated', user });
    } catch (error) {
      if (client.snapshot()?.id === id) client.clear();
      throw error;
    }
  }
  const signOut = useCallback(async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setSigningOut(true);
    let message = '';
    try {
      if (client.snapshot())
        await request('/auth/logout', messageSchema, { method: 'POST' });
    } catch {
      message =
        'Signed out on this device. Server sign-out could not be confirmed; other copies of this session may remain active.';
    } finally {
      client.clear(message);
      setSigningOut(false);
      logoutPending.current = false;
    }
  }, [client, request]);

  return (
    <AuthContext.Provider
      value={{
        session,
        authenticate,
        signOut,
        signingOut,
        notice,
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
