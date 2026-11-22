import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import type { UserRole } from '../users/user.model.js';

const ISSUER = 'ribra';

export type AccessTokenPayload = { userId: string; role: UserRole };

/** Short-lived token (15 min) sent in the Authorization header. */
export function signAccessToken({ userId, role }: AccessTokenPayload): string {
  return jwt.sign({ role }, env.jwtAccessSecret, {
    subject: userId,
    issuer: ISSUER,
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret, { issuer: ISSUER }) as jwt.JwtPayload;
    return { userId: String(decoded.sub), role: decoded.role as UserRole };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'Your session has expired.', 'TOKEN_EXPIRED');
    }
    throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  }
}

/**
 * Long-lived refresh token kept in an httpOnly cookie.
 * Format: "<sessionId>.<random secret>". It is opaque (not a JWT): the server looks it up.
 */
export function createRefreshToken(sessionId: string): string {
  return `${sessionId}.${crypto.randomBytes(32).toString('base64url')}`;
}

export function parseRefreshToken(token: string): { sessionId: string } | null {
  const [sessionId, secret] = token.split('.');
  if (!sessionId || !secret || !/^[a-f0-9]{24}$/.test(sessionId)) return null;
  return { sessionId };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison so attackers can't guess a hash byte by byte. */
export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
