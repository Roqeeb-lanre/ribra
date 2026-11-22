import { Router } from 'express';
import { databaseStatus } from '../../config/db.js';
import { env } from '../../config/env.js';

export const healthRouter = Router();

/** GET /api/v1/health: used by the frontend, Render and uptime monitors. */
healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ribra-api',
    version: process.env.npm_package_version ?? '0.1.0',
    database: databaseStatus(),
    ai: env.AI_API_KEY ? 'configured' : 'not configured',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
