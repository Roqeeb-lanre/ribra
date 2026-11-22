import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from './cookies.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

function clientMeta(req: Request): authService.ClientMeta {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}

function sendAuthResult(res: Response, status: number, result: authService.AuthResult) {
  setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
  res.status(status).json({ user: result.user, accessToken: result.accessToken });
}

function readRefreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export async function register(req: Request, res: Response) {
  const result = await authService.register(req.body as RegisterInput, clientMeta(req));
  sendAuthResult(res, 201, result);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body as LoginInput, clientMeta(req));
  sendAuthResult(res, 200, result);
}

export async function refresh(req: Request, res: Response) {
  try {
    const result = await authService.refresh(readRefreshCookie(req));
    sendAuthResult(res, 200, result);
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const user = await authService.getCurrentUser(req.auth!.userId);
  res.json({ user });
}

export async function verifyEmail(req: Request, res: Response) {
  const user = await authService.verifyEmail((req.body as { token: string }).token);
  res.json({ user });
}

export async function resendVerification(req: Request, res: Response) {
  res.json(await authService.resendVerification(req.auth!.userId));
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.requestPasswordReset((req.body as { email: string }).email);
  // Same answer whether or not the account exists.
  res.json({ message: 'If an account exists for that email, we have sent a reset link.' });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body as { token: string; password: string };
  await authService.resetPassword(token, password);
  clearRefreshCookie(res);
  res.json({ message: 'Your password has been changed. Please log in.' });
}

export async function google(req: Request, res: Response) {
  const { isNewUser, ...result } = await authService.googleSignIn(
    (req.body as { credential: string }).credential,
    clientMeta(req),
  );
  setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
  res
    .status(isNewUser ? 201 : 200)
    .json({ user: result.user, accessToken: result.accessToken, isNewUser });
}
