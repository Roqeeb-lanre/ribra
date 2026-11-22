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
