/**
 * Who is logged in, shared with the whole app.
 *
 * Wrap the app in <AuthProvider>, then any component can call `useAuth()` to get:
 *   status  'loading' (still asking the backend) | 'signed-out' | 'signed-in'
 *   user    the recruiter (when signed in)
 *   login(email, password) / logout()
 *
 * On page load we ask the backend `GET /auth/me`. The browser sends the login cookie
 * automatically, so a refresh keeps you logged in.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api';

export interface User {
  id: string;
  email: string;
  name: string;
}

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // On first load: are we already logged in (valid cookie from an earlier visit)?
  useEffect(() => {
    const controller = new AbortController();
    api<{ user: User }>('/auth/me', { signal: controller.signal })
      .then(({ user }) => {
        setUser(user);
        setStatus('signed-in');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // 401 = simply not logged in. Anything else (backend down) also shows the login page,
        // where the backend status indicator explains what's wrong.
        setUser(null);
        setStatus('signed-out');
      });
    // If the component goes away before the answer arrives, cancel the request.
    return () => controller.abort();
  }, []);

  // Errors (wrong password, too many attempts...) are thrown to the login form to display.
  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
    setUser(user);
    setStatus('signed-in');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (err) {
      // Even if the server call fails, forget the user locally so the UI logs out.
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setUser(null);
      setStatus('signed-out');
    }
  }, []);

  // useMemo keeps the same object between renders unless something changed,
  // so components using useAuth() don't re-render for no reason.
  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>');
  return value;
}
