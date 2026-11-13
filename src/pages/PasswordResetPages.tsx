/**
 * "Forgot password" flow:
 *
 *   /forgot-password           type your email -> we email a reset link
 *   /reset-password?token=...  (the link in the email) choose a new password
 *
 * In the demo, emails arrive in Mailpit (http://localhost:8025), not a real inbox.
 * The server answers the same way whether or not the email has an account, so this page
 * can't be used to find out who's registered.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { AuthLayout, PasswordInput, looksLikeEmail } from '../auth/AuthParts';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!looksLikeEmail(email)) {
      setError('This email address is not valid. Please check it.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one.">
      {sent ? (
        <div className="form-notice" role="status">
          <p>{sent}</p>
          <p className="muted small">
            Running the demo? The email is in the Mailpit inbox:{' '}
            <a href="http://localhost:8025" target="_blank" rel="noreferrer noopener">
              localhost:8025
            </a>
            . The link works once, for 30 minutes.
          </p>
        </div>
      ) : (
        <form className="form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button" disabled={submitting || !email}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="auth-switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  // 'checking' while we ask the server if the link is still good.
  const [linkState, setLinkState] = useState<'checking' | 'valid' | 'invalid'>(token ? 'checking' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<{ valid: boolean }>(`/auth/reset-password/${encodeURIComponent(token)}`)
      .then((res) => setLinkState(res.valid ? 'valid' : 'invalid'))
      .catch(() => setLinkState('invalid'));
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords are not the same.');
    setSubmitting(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      navigate('/login?reset=done', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (linkState === 'checking') {
    return (
      <AuthLayout title="Reset password">
        <p className="muted" role="status">
          Checking your link…
        </p>
      </AuthLayout>
    );
  }

  if (linkState === 'invalid') {
    return (
      <AuthLayout title="This link doesn't work" subtitle="It may have expired (links last 30 minutes) or already been used.">
        <Link to="/forgot-password" className="button">
          Send a new link
        </Link>
        <p className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="After this, you'll be logged out on every device.">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="reset-password">New password</label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="field__hint">At least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="reset-confirm">Repeat new password</label>
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button" disabled={submitting || !password || !confirm}>
          {submitting ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthLayout>
  );
}
