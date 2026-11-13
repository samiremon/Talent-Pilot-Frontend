/**
 * Who is logged in, shared with the whole app.
 *
 * Wrap the app in <AuthProvider>, then any component can call `useAuth()` to get:
 *   status   'loading' (still asking the backend) | 'signed-out' | 'signed-in'
 *   user     the recruiter (when signed in)
 *   login(email, password) / logout()
 *   signup(name, email, password)  -> creates the account; usually it then needs the
 *                                      6-digit code from the email (verifyEmail)
 *   verifyEmail(email, code)       -> confirms the email and logs in
 *   setUser  update the user after a profile change (e.g. new name)
 *
 * On page load we ask the backend `GET /auth/me`. The browser sends the login cookie
 * automatically, so a refresh keeps you logged in. "Continue with Google" also lands
 * here: Google sends the browser back to the app already logged in.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api';

export interface User {
  id: string;
  email: string;
  name: string;
  /** Has a password (to change it, the current one is needed). */
  hasPassword: boolean;
  /** Linked to a Google account. */
  hasGoogle: boolean;
}

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<SignupResult>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

/** After sign-up: either logged in already, or waiting for the emailed code. */
export type SignupResult = { needsVerification: false } | { needsVerification: true; email: string; emailSent: boolean };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const signedIn = useCallback((next: User) => {
    setUserState(next);
    setStatus('signed-in');
  }, []);

  // On first load: are we already logged in (valid cookie from an earlier visit)?
  useEffect(() => {
    const controller = new AbortController();
    api<{ user: User }>('/auth/me', { signal: controller.signal })
      .then(({ user }) => signedIn(user))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // 401 = simply not logged in. Anything else (backend down) also shows the login page,
        // where the backend status indicator explains what's wrong.
        setUserState(null);
        setStatus('signed-out');
      });
    // If the component goes away before the answer arrives, cancel the request.
    return () => controller.abort();
  }, [signedIn]);

  // Errors (wrong password, email taken, ...) are thrown to the form to display.
  const login = useCallback(
    async (email: string, password: string) => {
      const { user } = await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
      signedIn(user);
    },
    [signedIn],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string): Promise<SignupResult> => {
      const res = await api<{ user?: User; needsVerification?: boolean; email?: string; emailSent?: boolean }>(
        '/auth/signup',
        { method: 'POST', body: { name, email, password } },
      );
      if (res.needsVerification && res.email) {
        return { needsVerification: true, email: res.email, emailSent: res.emailSent !== false };
      }
      if (res.user) signedIn(res.user);
      return { needsVerification: false };
    },
    [signedIn],
  );

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      const { user } = await api<{ user: User }>('/auth/verify-email', { method: 'POST', body: { email, code } });
      signedIn(user);
    },
    [signedIn],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (err) {
      // Even if the server call fails, forget the user locally so the UI logs out.
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setUserState(null);
      setStatus('signed-out');
    }
  }, []);

  // useMemo keeps the same object between renders unless something changed,
  // so components using useAuth() don't re-render for no reason.
  const value = useMemo(
    () => ({ status, user, login, signup, verifyEmail, logout, setUser: setUserState }),
    [status, user, login, signup, verifyEmail, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>');
  return value;
}
