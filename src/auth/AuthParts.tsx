/**
 * Pieces shared by the signed-out pages (login, sign up, forgot/reset password):
 *   <AuthLayout>     the centred card with the logo
 *   useProviders()   which options the server has on (Google? sign-up? reset by email?)
 *   <GoogleButton>   "Continue with Google" (only shown when the server has it set up)
 *   <PasswordInput>  password box with a Show/Hide button
 *   friendlyAuthError()  turns ?error=google_... in the address into a readable sentence
 */
import { Eye, EyeOff, Send } from 'lucide-react';
import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { api, API_BASE } from '../api';
import { BackendStatus } from '../components/BackendStatus';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="card auth-card" aria-labelledby="auth-title">
        <span className="logo-tile auth-logo" aria-hidden="true">
          <Send size={16} />
        </span>
        <h1 id="auth-title" className="auth-title">
          {title}
        </h1>
        {subtitle && <p className="tagline">{subtitle}</p>}
        {children}
        <BackendStatus />
      </section>
    </main>
  );
}

export interface Providers {
  google: boolean;
  signup: boolean;
  passwordReset: boolean;
}

export function useProviders(): Providers | null {
  const [providers, setProviders] = useState<Providers | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<Providers>('/auth/providers', { signal: controller.signal })
      .then(setProviders)
      .catch(() => setProviders(null));
    return () => controller.abort();
  }, []);
  return providers;
}

/** The official multi-colour "G", drawn inline (no external image). */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * A plain link (not a fetch): the browser must really GO to Google's page and come back.
 * The backend handles the whole sign-in and returns the browser to the app, logged in.
 */
export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  return (
    <a className="button button--ghost button--google" href={`${API_BASE}/auth/google`}>
      <GoogleLogo /> {label}
    </a>
  );
}

/** "or" between the Google button and the email form. */
export function Divider() {
  return (
    <div className="divider" role="separator">
      <span>or</span>
    </div>
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </span>
  );
}

const AUTH_ERRORS: Record<string, string> = {
  google_off: 'Google sign-in is not set up on this server.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_state: 'Google sign-in expired or was interrupted. Please try again.',
  google_unverified: 'Your Google email address is not verified, so we can\'t use it.',
  google_failed: 'Google sign-in failed. Please try again.',
};

export function friendlyAuthError(code: string | null): string | null {
  if (!code) return null;
  return AUTH_ERRORS[code] ?? 'Sign-in failed. Please try again.';
}

/** Quick format check in the browser (the server also checks the domain really exists). */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
