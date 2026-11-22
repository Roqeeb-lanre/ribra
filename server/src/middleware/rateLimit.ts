import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ip = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

const common = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (_req: Request, _res: unknown, next: (err: unknown) => void) => {
    next(
      new AppError(
        429,
        'Too many attempts. Please wait a few minutes and try again.',
        'RATE_LIMITED',
      ),
    );
  },
};

/** 10 login attempts per 15 minutes for each IP + email pair (slows down password guessing). */
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `${ip(req)}:${String(req.body?.email ?? '').toLowerCase()}`,
});

/** 20 new accounts per hour from one IP. */
export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: ip,
});

/** Per logged-in user (falls back to IP). Use after requireAuth. */
const user = (req: Request) => req.auth?.userId ?? ip(req);

/** AI calls are slow and limited by the free tier: max 4 per minute per user. */
export const aiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 4,
  keyGenerator: user,
});

/** 20 CV uploads per hour per user. */
export const uploadLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: user,
});

/** Emails cost money and can be abused for spam: 5 per hour per IP (and per user when logged in). */
export const emailLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `${user(req)}:${String(req.body?.email ?? '').toLowerCase()}`,
});
