import type { Request, Response } from 'express';
import { REFRESH_COOKIE, clearRefreshCookie } from '../auth/cookies.js';
import * as service from './account.service.js';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  UpdateProfileInput,
} from './account.schema.js';

/*
 * These handlers are mounted on the /api/v1/auth router (see auth.routes.ts),
 * because that is the only path the login cookie is sent to, and they need to know
 * which session is "this device".
 */

function refreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

const thisSession = (req: Request) =>
  service.currentSessionId(req.auth!.userId, refreshCookie(req));

export async function updateProfile(req: Request, res: Response) {
  res.json({ user: await service.updateProfile(req.auth!.userId, req.body as UpdateProfileInput) });
}

export async function changePassword(req: Request, res: Response) {
  const user = await service.changePassword(
    req.auth!.userId,
    req.body as ChangePasswordInput,
    await thisSession(req),
  );
  res.json({ user });
}

export async function listSessions(req: Request, res: Response) {
  res.json({ sessions: await service.listSessions(req.auth!.userId, await thisSession(req)) });
}

export async function signOutOthers(req: Request, res: Response) {
  res.json(await service.signOutOtherSessions(req.auth!.userId, await thisSession(req)));
}

export async function exportData(req: Request, res: Response) {
  const data = await service.exportData(req.auth!.userId);
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="ribra-data-${date}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.json(data);
}

export async function deleteAccount(req: Request, res: Response) {
  await service.deleteAccount(req.auth!.userId, req.body as DeleteAccountInput);
  clearRefreshCookie(res);
  res.status(204).end();
}
