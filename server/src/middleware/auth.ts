import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';

/** Lets the request through only with a valid "Authorization: Bearer <token>" header. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  }

  req.auth = verifyAccessToken(token);
  next();
};

/** Use after requireAuth to restrict a route to certain roles, e.g. requireRole('admin'). */
export const requireRole =
  (...roles: Array<'user' | 'admin'>): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw new AppError(403, "You don't have permission to do that.", 'FORBIDDEN');
    }
    next();
  };
