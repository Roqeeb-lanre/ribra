import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** Any route nobody matched ends up here. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
};

/** One place that turns every error into the same JSON shape: { error: { code, message, details? } } */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // Invalid request body (from validateBody)
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues[0]?.message ?? 'Some fields are invalid.',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // Upload problems (file too big, wrong field name...)
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooBig ? 413 : 400).json({
      error: {
        code: tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        message: tooBig
          ? 'That file is too large. The maximum size is 5 MB.'
          : 'The upload could not be processed.',
      },
    });
    return;
  }

  // Malformed JSON body
  if (err?.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } });
    return;
  }

  // MongoDB unique index clash (e.g. two sign-ups with the same email at the same moment)
  if (err?.code === 11000) {
    res.status(409).json({ error: { code: 'DUPLICATE', message: 'That record already exists.' } });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.isProduction ? 'Something went wrong. Please try again.' : String(err?.message),
    },
  });
};
