/**
 * Base URL of the Ribra API.
 * Empty in development (Vite proxies /api), the Render URL in production.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export type HealthResponse = {
  status: 'ok';
  service: string;
  version: string;
  database: 'connected' | 'connecting' | 'disconnected';
  uptimeSeconds: number;
  timestamp: string;
};

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/api/v1/health`, { signal });
  if (!res.ok) throw new Error(`API responded with ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}
