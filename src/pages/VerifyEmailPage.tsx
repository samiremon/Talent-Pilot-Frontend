/**
 * "Check your email" (/verify-email?email=...): enter the 6-digit code we emailed.
 *
 * Why: a sign-up only becomes a working account once the person proves the mailbox is
 * theirs. A made-up address never receives the code, so it can never be used (and the
 * unverified account deletes itself after 24 hours).
 *
 * - The code box accepts only digits and fills from the phone's "from Messages/Mail" hint.
 * - "Send a new code" is limited to once a minute (the server also limits it).
 * - In the demo, emails arrive in Mailpit (http://localhost:8025), not a real inbox.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from '../auth/AuthParts';

const RESEND_SECONDS = 60;

export function VerifyEmailPage() {
  const { verifyEmail } = useAuth();
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() =>
    params.get('unsent')
      ? "We couldn't send the email just now. Wait a moment, then press \"Send a new code\"."
      : params.get('from') === 'login'
        ? 'Your email is not verified yet. Enter the code we sent, or ask for a new one.'
        : null,
  );
  const [submitting, setSubmitting] = useState(false);
  // Seconds until "Send a new code" can be pressed again.
  const [wait, setWait] = useState(params.get('unsent') || params.get('from') === 'login' ? 0 : RESEND_SECONDS);

  // Count the resend timer down once a second.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6 digits from the email.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyEmail(email, code);
      // Verified and logged in: App.tsx switches to the dashboard.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    try {
      await api('/auth/resend-verification', { method: 'POST', body: { email } });
      setNotice('We sent a new code. It replaces the old one.');
      setCode('');
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a new code. Please try again.');
    }
  }

  if (!email) {
    return (
      <AuthLayout title="Verify your email" subtitle="Something's missing from this link.">
        <Link to="/signup" className="button">
          Back to sign up
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Check your email" subtitle={`We sent a 6-digit code to ${email}.`}>
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}
      <form className="form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>Verification code</span>
          <input
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            // Keep digits only (so pasting "123 456" works).
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-invalid={Boolean(error)}
            aria-describedby="code-hint"
          />
          <span className="field__hint" id="code-hint">
            The code works for 15 minutes. Running the demo? It's in Mailpit:{' '}
            <a href="http://localhost:8025" target="_blank" rel="noreferrer noopener">
              localhost:8025
            </a>
          </span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button" disabled={submitting || code.length !== 6}>
          {submitting ? 'Checking…' : 'Verify and continue'}
        </button>
        <button type="button" className="button button--ghost" onClick={resend} disabled={wait > 0}>
          {wait > 0 ? `Send a new code (${wait}s)` : 'Send a new code'}
        </button>
      </form>
      <p className="auth-switch">
        Wrong email? <Link to="/signup">Sign up again</Link> · <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
