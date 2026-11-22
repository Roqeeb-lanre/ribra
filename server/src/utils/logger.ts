import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Structured JSON logs in production (easy to search on Render),
 * pretty coloured logs while developing, silence during tests.
 * Tokens and cookies are never written to the logs.
 */
export const logger = pino({
  level: env.isTest ? 'silent' : env.isProduction ? 'info' : 'debug',
  transport: env.isProduction || env.isTest ? undefined : { target: 'pino-pretty' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
    ],
    censor: '[hidden]',
  },
});
