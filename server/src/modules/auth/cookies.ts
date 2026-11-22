import type { Response } from 'express';
import { env } from '../../config/env.js';

export const REFRESH_COOKIE = 'ribra_rt';

// The cookie is only sent to /api/v1/auth, never to other routes.
const baseOptions = {
  httpOnly: true, // JavaScript in the browser can't read it (protects against XSS)
  secure: env.isProduction, // HTTPS only in production
  sameSite: 'lax' as const, // not sent on cross-site POSTs (protects against CSRF)
  path: '/api/v1/auth',
};

export function setRefreshCookie(res: Response, token: string, expires: Date): void {
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions, expires });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}
