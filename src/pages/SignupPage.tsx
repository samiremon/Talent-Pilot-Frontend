/**
 * Sign up (/signup): name, email, password, or "Continue with Google".
 *
 * Email is checked twice:
 *   - here in the browser, for the format, as you leave the box
 *   - by the server, which also checks the email's domain really exists
 *     ("rahim@gmial.com" -> "Did you mean gmail.com?")
 * Server problems are shown under the field they belong to.
 * On success we email a 6-digit code and go to /verify-email: the account only works once
 * the code is entered, so made-up addresses can never be used.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout, Divider, GoogleButton, PasswordInput, looksLikeEmail, useProviders } from '../auth/AuthParts';

type Field = 'name' | 'email' | 'password';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const providers = useProviders();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(field: Field, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors(({ [field]: _removed, ...rest }) => rest);
  }

  /** Checks we can do in the browser, before bothering the server. */
  function localProblems(): Partial<Record<Field, string>> {
    const problems: Partial<Record<Field, string>> = {};
    if (!form.name.trim()) problems.name = 'Please enter your name.';
    if (!looksLikeEmail(form.email)) problems.email = 'This email address is not valid. Please check it.';
    if (form.password.length < 8) problems.password = 'Use at least 8 characters.';
    return problems;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const problems = localProblems();
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setSubmitting(true);
    try {
      const result = await signup(form.name.trim(), form.email.trim(), form.password);
      if (result.needsVerification) {
        const query = new URLSearchParams({ email: result.email, ...(result.emailSent ? {} : { unsent: '1' }) });
        navigate(`/verify-email?${query.toString()}`);
      }
      // Otherwise we're logged in and App.tsx switches to the dashboard.
    } catch (err) {
      if (err instanceof ApiError) {
        // e.g. INVALID_EMAIL / EMAIL_TAKEN come with the field they belong to.
        const details = (Array.isArray(err.details) ? err.details : []) as { path: Field; message: string }[];
        const byField: Partial<Record<Field, string>> = {};
        for (const d of details) {
          // Our email check sends a full sentence; zod sends "must be ..." fragments.
          byField[d.path] = /^[A-Z]/.test(d.message) ? d.message : `${d.path[0]!.toUpperCase()}${d.path.slice(1)} ${d.message}.`;
        }
        if (err.code === 'EMAIL_TAKEN') byField.email = err.message;
        setErrors(byField);
        if (Object.keys(byField).length === 0) setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  if (providers && !providers.signup) {
    return (
      <AuthLayout title="Sign-up is closed" subtitle="Ask your team's admin for an account.">
        <p className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start hiring with your AI co-worker.">
      {providers?.google && (
        <>
          <GoogleButton label="Sign up with Google" />
          <Divider />
        </>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>Name</span>
          <input
            name="name"
            autoComplete="name"
            required
            autoFocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'signup-name-error' : undefined}
          />
          {errors.name && (
            <span className="field__error" id="signup-name-error">
              {errors.name}
            </span>
          )}
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            // Check the format as soon as the user leaves the box.
            onBlur={() =>
              form.email && !looksLikeEmail(form.email)
                ? setErrors((e) => ({ ...e, email: 'This email address is not valid. Please check it.' }))
                : undefined
            }
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
          />
          {errors.email && (
            <span className="field__error" id="signup-email-error" role="alert">
              {errors.email}
            </span>
          )}
        </label>

        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <PasswordInput
            id="signup-password"
            name="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby="signup-password-hint"
          />
          <span className={errors.password ? 'field__error' : 'field__hint'} id="signup-password-hint">
            {errors.password ?? 'At least 8 characters.'}
          </span>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
