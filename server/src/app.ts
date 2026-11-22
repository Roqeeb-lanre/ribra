import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { healthRouter } from './modules/health/health.routes.js';
import { errorHandler, notFound } from './middleware/error.js';

/**
 * Builds the Express app without starting it, so tests can use it directly.
 */
export function createApp() {
  const app = express();

  // Render sits behind a proxy; this makes req.ip and secure cookies work correctly.
  app.set('trust proxy', 1);

  // Security and parsing
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger, autoLogging: !env.isTest }));

  // Routes (every feature module plugs in here as we build it)
  app.use('/api/v1/health', healthRouter);

  // Errors
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
