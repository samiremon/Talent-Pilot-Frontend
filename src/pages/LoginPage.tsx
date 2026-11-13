/**
 * The login screen: email + password form.
 *
 * On submit it calls login() from AuthContext. If that works, the app switches to the
 * home screen on its own (App.tsx watches the auth status). If it fails, the backend's
 * message ("Email or password is incorrect", "Too many login attempts...") is shown.
 *
 * Demo helper: if the backend has DEMO_LOGIN_ENABLED=true, a "Use demo account" button
 * appears and fills in the recruiter's email and password from the backend's .env.
 */
import { Send } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { BackendStatus } from '../components/BackendStatus';

/** What GET /api/auth/demo returns when demo login is on. */
interface DemoCredentials {
  email: string;
  password: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The demo account, if the backend offers one (DEMO_LOGIN_ENABLED=true in its .env).
  const [demo, setDemo] = useState<DemoCredentials | null>(null);

  // Ask the backend once whether there's a demo account. If it answers 404 (switched off)
  // or fails for any reason, we just don't show the button.
  useEffect(() => {
    const controller = new AbortController();
    api<DemoCredentials>('/auth/demo', { signal: controller.signal })
      .then(setDemo)
      .catch(() => setDemo(null));
    return () => controller.abort();
  }, []);

  // Fills the form with the demo account; the user still clicks "Sign in" themselves.
  function fillDemoAccount() {
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Stop the browser's default "reload the page with the form data" behavior.
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // Success: nothing else to do here, App.tsx shows the home page.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="card auth-card" aria-labelledby="login-title">
        <span className="logo-tile auth-logo" aria-hidden="true">
          <Send size={16} />
        </span>
        <h1 id="login-title" className="auth-title">
          TalentPilot
        </h1>
        <p className="tagline">Your AI recruiting co-worker, from job description to hire.</p>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {/* role="alert" makes screen readers read the error out immediately. */}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="button" disabled={submitting || !email || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          {/* Only shown when the backend has demo login switched on. */}
          {demo && (
            <button type="button" className="button button--ghost" onClick={fillDemoAccount} disabled={submitting}>
              Use demo account
            </button>
          )}
        </form>

        <BackendStatus />
      </section>
    </main>
  );
}
