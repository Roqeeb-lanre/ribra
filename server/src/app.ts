import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { analysesRouter, resumesRouter } from './modules/resumes/resumes.routes.js';
import { usageRouter } from './modules/usage/usage.routes.js';
import { jobMatchesRouter } from './modules/jobMatches/jobMatches.routes.js';
import { applicationsRouter } from './modules/applications/applications.routes.js';
import { coverLettersRouter } from './modules/coverLetters/coverLetters.routes.js';
import { interviewPrepsRouter } from './modules/interviewPreps/interviewPreps.routes.js';
import { errorHandler, notFound } from './middleware/error.js';

/**
 * Builds the Express app without starting it, so tests can use it directly.
 */
export function createApp() {
  const app = express();

  // In production requests pass through two proxies (Vercel, then Render),
  // so we trust two hops to read the visitor's real IP for rate limiting.
  app.set('trust proxy', env.isProduction ? 2 : 1);

  // Security and parsing
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      // Don't log Render's health checks (every few seconds) or anything during tests.
      autoLogging: env.isTest
        ? false
        : { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
    }),
  );

  // Routes (every feature module plugs in here as we build it)
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/resumes', resumesRouter);
  app.use('/api/v1/analyses', analysesRouter);
  app.use('/api/v1/job-matches', jobMatchesRouter);
  app.use('/api/v1/applications', applicationsRouter);
  app.use('/api/v1/cover-letters', coverLettersRouter);
  app.use('/api/v1/interview-preps', interviewPrepsRouter);
  app.use('/api/v1/usage', usageRouter);

  // Errors
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
