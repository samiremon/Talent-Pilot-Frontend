/**
 * The login screen: email + password form.
 *
 * On submit it calls login() from AuthContext. If that works, the app switches to the
 * home screen on its own (App.tsx watches the auth status). If it fails, the backend's
 * message ("Email or password is incorrect", "Too many login attempts...") is shown.
 */
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { BackendStatus } from '../components/BackendStatus';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <main className="page">
      <section className="card" aria-labelledby="login-title">
        <h1 id="login-title" className="brand">
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
        </form>

        <BackendStatus />
      </section>
    </main>
  );
}
