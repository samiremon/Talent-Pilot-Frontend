/**
 * The login screen (/login).
 *
 * - Email + password, with a Show/Hide button on the password
 * - "Continue with Google" (only when the server has Google set up)
 * - "Forgot password?" and "Create an account" links
 * - Demo helper: if the backend has DEMO_LOGIN_ENABLED=true, a "Use demo account" button
 *   fills in the demo recruiter's email and password.
 * - If Google sends the user back with an error (?error=...), it's shown here.
 *
 * On success the app switches to the dashboard by itself (App.tsx watches the login status).
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout, Divider, GoogleButton, PasswordInput, friendlyAuthError, useProviders } from '../auth/AuthParts';

/** What GET /api/auth/demo returns when demo login is on. */
interface DemoCredentials {
  email: string;
  password: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const providers = useProviders();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Errors from the Google redirect (?error=google_...) or from a failed login.
  const [error, setError] = useState<string | null>(() => friendlyAuthError(params.get('error')));
  const [submitting, setSubmitting] = useState(false);
  // Shown after a password reset: "Your password was changed".
  const notice = params.get('reset') === 'done' ? 'Your password was changed. Please log in with the new one.' : null;
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
      // Success: nothing else to do here, App.tsx shows the dashboard.
    } catch (err) {
      // Right password but the email was never confirmed: go enter the code.
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        const unverified = (err.details as { email?: string } | undefined)?.email ?? email;
        navigate(`/verify-email?${new URLSearchParams({ email: unverified, from: 'login' }).toString()}`);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="TalentPilot" subtitle="Your AI recruiting co-worker, from job description to hire.">
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}

      {providers?.google && (
        <>
          <GoogleButton />
          <Divider />
        </>
      )}

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

        <div className="field">
          <span className="field__row">
            <label htmlFor="login-password">Password</label>
            {providers?.passwordReset !== false && (
              <Link to="/forgot-password" className="field__link">
                Forgot password?
              </Link>
            )}
          </span>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

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

      {providers?.signup !== false && (
        <p className="auth-switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      )}
    </AuthLayout>
  );
}
