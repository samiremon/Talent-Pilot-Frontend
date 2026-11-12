import { useBackendHealth, type BackendStatus } from './useBackendHealth';

const statusLabel: Record<BackendStatus, string> = {
  checking: 'Checking backend…',
  online: 'Backend online',
  offline: 'Backend offline',
};

export function App() {
  const status = useBackendHealth();

  return (
    <main className="page">
      <h1>TalentPilot</h1>
      <p className="tagline">Your AI recruiting co-worker, from job description to hire.</p>
      <p className={`status status--${status}`} role="status">
        <span className="dot" aria-hidden="true" />
        {statusLabel[status]}
      </p>
    </main>
  );
}
