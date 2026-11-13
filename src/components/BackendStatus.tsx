/**
 * A small colored dot + text showing whether the backend is reachable.
 * Handy on the login page: if login fails, you can see at a glance whether the
 * problem is your password or a stopped server.
 */
import { useBackendHealth, type BackendStatus as Status } from '../useBackendHealth';

const label: Record<Status, string> = {
  checking: 'Checking server…',
  online: 'Server online',
  degraded: 'Server up, database down',
  offline: 'Server offline',
};

export function BackendStatus() {
  const status = useBackendHealth();
  return (
    // role="status" makes screen readers announce changes politely.
    <p className={`status status--${status}`} role="status">
      <span className="dot" aria-hidden="true" />
      {label[status]}
    </p>
  );
}
