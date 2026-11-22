import type { RequestHandler } from 'express';
import type { z } from 'zod';

/**
 * Checks req.body against a Zod schema and replaces it with the cleaned value
 * (trimmed, lower-cased email, etc.). Invalid input becomes a 400 in the error handler.
 */
export const validateBody =
  (schema: z.ZodType): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
