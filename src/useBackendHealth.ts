import { useEffect, useState } from 'react';

export type BackendStatus = 'checking' | 'online' | 'offline';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export function useBackendHealth(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then((res) => setStatus(res.ok ? 'online' : 'offline'))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  return status;
}
