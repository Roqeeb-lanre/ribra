export type HealthResponse = {
  status: 'ok';
  service: string;
  version: string;
  database: 'connected' | 'connecting' | 'disconnected';
  uptimeSeconds: number;
  timestamp: string;
};

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/v1/health', { signal });
  if (!res.ok) throw new Error(`API responded with ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}
