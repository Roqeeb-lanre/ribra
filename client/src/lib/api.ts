import { useAuthStore, type User } from '@/stores/auth';

/**
 * Every request goes to /api on the SAME domain as the website:
 * - locally, Vite forwards /api to http://localhost:4000
 * - on Vercel, vercel.json forwards /api to the Render API
 * Same-domain requests let the login cookie work in every browser, including Safari.
 */
const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Array<{ field: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the access token (default true). */
  auth?: boolean;
};

export type AuthResponse = { user: User; accessToken: string };

async function send(path: string, { method = 'GET', body, auth = true }: RequestOptions) {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function toApiError(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => null);
  if (!data?.error && res.status >= 500) {
    return new ApiError(
      res.status,
      'SERVER_UNAVAILABLE',
      'Ribra is waking up. Please try again in a few seconds.',
    );
  }
  return new ApiError(
    res.status,
    data?.error?.code ?? 'UNKNOWN',
    data?.error?.message ?? 'Something went wrong. Please try again.',
    data?.error?.details ?? [],
  );
}

/** Calls the API. If the access token has expired, refreshes it once and retries. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);

  if (res.status === 401 && options.auth !== false && useAuthStore.getState().accessToken) {
    const newToken = await refreshSession();
    if (newToken) res = await send(path, options);
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// If several requests fail at once, they all wait for ONE refresh instead of racing.
let refreshing: Promise<string | null> | null = null;

/**
 * Uses the httpOnly refresh cookie to get a fresh access token.
 * Returns null (and signs the user out locally) if the session is gone.
 */
export function refreshSession(): Promise<string | null> {
  refreshing ??= send('/auth/refresh', { method: 'POST', auth: false })
    .then(async (res) => {
      if (!res.ok) {
        useAuthStore.getState().clearSession();
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      useAuthStore.getState().setSession(data.user, data.accessToken);
      return data.accessToken;
    })
    .catch(() => {
      useAuthStore.getState().clearSession();
      return null;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}
