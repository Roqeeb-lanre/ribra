import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../utils/AppError.js';
import { UserModel } from '../users/user.model.js';
import { getUsageSummary } from './usage.service.js';

export const usageRouter = Router();

/** GET /api/v1/usage: how many AI uses are left this month. */
usageRouter.get('/', requireAuth, async (req, res) => {
  const user = await UserModel.findById(req.auth!.userId);
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  res.json({ usage: await getUsageSummary(user.id, user.plan) });
});
