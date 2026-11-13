/**
 * What a logged-in recruiter sees. For now just a welcome and a logout button;
 * the chat and the job screens will be built here in later steps.
 */
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function HomePage() {
  const { user, logout } = useAuth();
  const [leaving, setLeaving] = useState(false);

  async function handleLogout() {
    setLeaving(true);
    await logout();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand brand--small">TalentPilot</span>
        <div className="topbar__user">
          <span className="muted">{user?.email}</span>
          <button type="button" className="button button--ghost" onClick={handleLogout} disabled={leaving}>
            {leaving ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="page">
        <section className="card">
          <h1>Welcome, {user?.name}</h1>
          <p className="muted">You're signed in. The AI chat will appear here soon.</p>
        </section>
      </main>
    </div>
  );
}
