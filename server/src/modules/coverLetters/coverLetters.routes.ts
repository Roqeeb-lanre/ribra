import { Router, type Request } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import {
  createCoverLetterSchema,
  updateCoverLetterSchema,
  type CreateCoverLetterInput,
  type UpdateCoverLetterInput,
} from './coverLetters.schema.js';
import * as service from './coverLetters.service.js';

export const coverLettersRouter = Router();
coverLettersRouter.use(requireAuth);

coverLettersRouter.get('/', async (req, res) => {
  res.json({ coverLetters: await service.listCoverLetters(req.auth!.userId) });
});

/** POST /api/v1/cover-letters: write (or rewrite) the letter for a job match. */
coverLettersRouter.post('/', aiLimiter, validateBody(createCoverLetterSchema), async (req, res) => {
  const coverLetter = await service.writeCoverLetter(
    req.auth!.userId,
    req.body as CreateCoverLetterInput,
  );
  res.status(201).json({ coverLetter });
});

coverLettersRouter.get('/by-match/:matchId', async (req: Request<{ matchId: string }>, res) => {
  res.json({
    coverLetter: await service.getCoverLetterForMatch(req.auth!.userId, req.params.matchId),
  });
});

coverLettersRouter.patch(
  '/:id',
  validateBody(updateCoverLetterSchema),
  async (req: Request<{ id: string }>, res) => {
    const coverLetter = await service.updateCoverLetter(
      req.auth!.userId,
      req.params.id,
      req.body as UpdateCoverLetterInput,
    );
    res.json({ coverLetter });
  },
);

coverLettersRouter.delete('/:id', async (req: Request<{ id: string }>, res) => {
  await service.deleteCoverLetter(req.auth!.userId, req.params.id);
  res.status(204).end();
});
