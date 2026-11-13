/**
 * Profile (/profile): change your name and your password.
 *
 *   - Name: shown on everything you do (activity log, token usage).
 *   - Password: needs your current password. Accounts that only use Google have none
 *     yet and can SET one here (then they can also log in with email + password).
 *     Changing it logs you out on all OTHER devices; this one stays logged in.
 */
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { useAuth, type User } from '../auth/AuthContext';
import { PasswordInput } from '../auth/AuthParts';
import { PageHeader } from '../components/PageParts';

export function ProfilePage() {
  const { user, setUser } = useAuth();

  return (
    <>
      <PageHeader title="Profile" subtitle={user?.email} />
      <div className="profile-grid">
        {user && <NameForm user={user} onSaved={setUser} />}
        {user && <PasswordForm user={user} onSaved={(hasPassword) => setUser({ ...user, hasPassword })} />}
        <section className="card panel">
          <h2 className="panel__title">Sign-in methods</h2>
          <ul className="plain-list">
            <li>Email and password: {user?.hasPassword ? 'set' : 'not set yet'}</li>
            <li>Google: {user?.hasGoogle ? 'linked' : 'not linked'}</li>
          </ul>
        </section>
      </div>
    </>
  );
}

function NameForm({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const [name, setName] = useState(user.name);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await api<{ user: User }>('/auth/me', { method: 'PATCH', body: { name } });
      onSaved(res.user);
      setStatus({ ok: true, text: 'Name saved.' });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof ApiError ? err.message : 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card panel form-stack" onSubmit={handleSubmit}>
      <h2 className="panel__title">Your name</h2>
      <div className="form-row">
        <label htmlFor="profile-name">Name</label>
        <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} />
        <span className="form-hint">Shown on everything you do: the activity log and token usage.</span>
      </div>
      <StatusLine status={status} />
      <div className="form-actions">
        <button type="submit" className="button" disabled={saving || !name.trim() || name.trim() === user.name}>
          {saving ? 'Saving…' : 'Save name'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm({ user, onSaved }: { user: User; onSaved: (hasPassword: boolean) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    if (next.length < 8) return setStatus({ ok: false, text: 'The new password needs at least 8 characters.' });
    if (next !== repeat) return setStatus({ ok: false, text: 'The two new passwords are not the same.' });
    setSaving(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: user.hasPassword ? current : undefined, newPassword: next },
      });
      setCurrent('');
      setNext('');
      setRepeat('');
      onSaved(true);
      setStatus({ ok: true, text: 'Password changed. Other devices were logged out.' });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof ApiError ? err.message : 'Could not change it. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card panel form-stack" onSubmit={handleSubmit}>
      <h2 className="panel__title">{user.hasPassword ? 'Change password' : 'Set a password'}</h2>
      {!user.hasPassword && (
        <p className="muted small">You signed up with Google. Set a password to also log in with your email.</p>
      )}
      {user.hasPassword && (
        <div className="form-row">
          <label htmlFor="profile-current">Current password</label>
          <PasswordInput id="profile-current" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
      )}
      <div className="form-row">
        <label htmlFor="profile-new">New password</label>
        <PasswordInput id="profile-new" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <span className="form-hint">At least 8 characters.</span>
      </div>
      <div className="form-row">
        <label htmlFor="profile-repeat">Repeat new password</label>
        <PasswordInput id="profile-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
      </div>
      <StatusLine status={status} />
      <div className="form-actions">
        <button type="submit" className="button" disabled={saving || !next || !repeat || (user.hasPassword && !current)}>
          {saving ? 'Saving…' : user.hasPassword ? 'Change password' : 'Set password'}
        </button>
      </div>
    </form>
  );
}

/** Green "saved" or red error line under a form. */
function StatusLine({ status }: { status: { ok: boolean; text: string } | null }) {
  if (!status) return null;
  return (
    <p className={status.ok ? 'form-notice' : 'form-error'} role={status.ok ? 'status' : 'alert'}>
      {status.text}
    </p>
  );
}
