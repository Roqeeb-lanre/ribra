import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { validateBody } from '../../middleware/validate.js';
import { AppError } from '../../utils/AppError.js';
import * as service from './reminders.service.js';

/** Called by the scheduled GitHub Action, never by browsers. */
export const internalRouter = Router();

function hasCronSecret(given: string | undefined): boolean {
  if (!env.CRON_SECRET || !given) return false;
  const a = Buffer.from(env.CRON_SECRET);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** POST /api/v1/internal/reminders: send today's reminder emails. */
internalRouter.post('/reminders', async (req, res) => {
  if (!env.CRON_SECRET) {
    throw new AppError(503, 'Reminders are not set up (no CRON_SECRET).', 'NOT_CONFIGURED');
  }
  if (!hasCronSecret(req.get('x-cron-secret'))) {
    throw new AppError(401, 'Not allowed.', 'UNAUTHORIZED');
  }
  res.json(await service.sendDueReminders());
});

/** Public: the "turn off reminder emails" link in every reminder. */
export const remindersRouter = Router();

remindersRouter.post(
  '/unsubscribe',
  validateBody(z.object({ token: z.string().min(10).max(200) })),
  async (req, res) => {
    const ok = await service.unsubscribe((req.body as { token: string }).token);
    if (!ok) throw new AppError(400, 'This unsubscribe link is not valid.', 'INVALID_TOKEN');
    res.json({ ok: true });
  },
);
