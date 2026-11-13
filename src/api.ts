/**
 * One small helper for every call to the backend.
 *
 *   const { user } = await api<{ user: User }>('/auth/me');
 *   await api('/auth/login', { method: 'POST', body: { email, password } });
 *
 * It always goes through `/api` (see vite.config.ts / nginx.conf), sends and reads JSON,
 * includes the login cookie, and turns the backend's error format
 * `{ error: { code, message } }` into an `ApiError` you can catch.
 */

/** All backend calls start with this. */
export const API_BASE = '/api';

/** An error the backend reported, e.g. status 401 with code "INVALID_CREDENTIALS". */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Extra info, e.g. which form fields were invalid: [{ path, message }]. */
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON. */
  body?: unknown;
  /** Lets a component cancel the request when it goes away. */
  signal?: AbortSignal;
}

export async function api<T = void>(path: string, { method = 'GET', body, signal }: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      // Send the login cookie. 'same-origin' is enough because /api is on our own address.
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    // A cancelled request isn't a real failure: let the caller ignore it.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // fetch() itself only fails when the server can't be reached at all.
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the backend running?');
  }

  // 204 No Content (e.g. logout) has no body to read.
  if (res.status === 204) return undefined as T;

  // Read the body as JSON if possible; a proxy error page might not be JSON.
  const data: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed (${res.status})`,
      error?.details,
    );
  }
  return data as T;
}
