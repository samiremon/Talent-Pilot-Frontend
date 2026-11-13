/**
 * Loads data from the backend for a component, and keeps track of the three states every
 * screen has to handle:
 *
 *   const { data, error, loading, reload } = useApi<{ jobs: Job[] }>('/jobs');
 *
 *   loading  true until the first answer arrives
 *   data     the answer (stays visible while reloading, so the screen doesn't flash)
 *   error    a message to show if it failed
 *   reload   ask again (e.g. after creating something)
 *
 * Changing `path` loads the new address. Leaving the page cancels the request.
 */
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';

export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumping this number makes the effect below run again = reload.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api<T>(path, { signal: controller.signal })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof ApiError ? err.message : 'Could not load this page.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}
