/**
 * Asks the backend "are you OK?" (GET /api/health) once, when the component appears.
 *
 *  online    backend and database are up
 *  degraded  backend is up but something it needs (the database) is down
 *  offline   backend can't be reached at all
 */
import { useEffect, useState } from 'react';
import { API_BASE } from './api';

export type BackendStatus = 'checking' | 'online' | 'degraded' | 'offline';

export function useBackendHealth(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/health`, { signal: controller.signal })
      // The backend answers 503 when the database is down.
      .then((res) => setStatus(res.ok ? 'online' : res.status === 503 ? 'degraded' : 'offline'))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  return status;
}
