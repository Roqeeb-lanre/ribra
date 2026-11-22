import { Router, type Request } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import { createJobMatchSchema, type CreateJobMatchInput } from './jobMatches.schema.js';
import * as service from './jobMatches.service.js';

export const jobMatchesRouter = Router();
jobMatchesRouter.use(requireAuth);

/** POST /api/v1/job-matches: compare a saved CV with a pasted job description. */
jobMatchesRouter.post('/', aiLimiter, validateBody(createJobMatchSchema), async (req, res) => {
  const { match, cached } = await service.createJobMatch(
    req.auth!.userId,
    req.body as CreateJobMatchInput,
  );
  res.status(cached ? 200 : 201).json({ match, cached });
});

jobMatchesRouter.get('/', async (req, res) => {
  res.json({ matches: await service.listJobMatches(req.auth!.userId) });
});

jobMatchesRouter.get('/:id', async (req: Request<{ id: string }>, res) => {
  res.json({ match: await service.getJobMatch(req.auth!.userId, req.params.id) });
});

jobMatchesRouter.delete('/:id', async (req: Request<{ id: string }>, res) => {
  await service.deleteJobMatch(req.auth!.userId, req.params.id);
  res.status(204).end();
});
