import { Router, type Request } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import {
  answerSchema,
  createInterviewPrepSchema,
  type AnswerInput,
  type CreateInterviewPrepInput,
} from './interviewPreps.schema.js';
import * as service from './interviewPreps.service.js';

export const interviewPrepsRouter = Router();
interviewPrepsRouter.use(requireAuth);

interviewPrepsRouter.get('/', async (req, res) => {
  res.json({ interviewPreps: await service.listInterviewPreps(req.auth!.userId) });
});

/** POST /api/v1/interview-preps: generate practice questions for a job match. */
interviewPrepsRouter.post(
  '/',
  aiLimiter,
  validateBody(createInterviewPrepSchema),
  async (req, res) => {
    const { jobMatchId } = req.body as CreateInterviewPrepInput;
    const interviewPrep = await service.prepareInterview(req.auth!.userId, jobMatchId);
    res.status(201).json({ interviewPrep });
  },
);

interviewPrepsRouter.get('/by-match/:matchId', async (req: Request<{ matchId: string }>, res) => {
  res.json({
    interviewPrep: await service.getInterviewPrepForMatch(req.auth!.userId, req.params.matchId),
  });
});

/** POST /api/v1/interview-preps/:id/questions/:questionId/feedback: review a practice answer. */
interviewPrepsRouter.post(
  '/:id/questions/:questionId/feedback',
  aiLimiter,
  validateBody(answerSchema),
  async (req: Request<{ id: string; questionId: string }>, res) => {
    const interviewPrep = await service.reviewAnswer(
      req.auth!.userId,
      req.params.id,
      req.params.questionId,
      req.body as AnswerInput,
    );
    res.json({ interviewPrep });
  },
);

interviewPrepsRouter.delete('/:id', async (req: Request<{ id: string }>, res) => {
  await service.deleteInterviewPrep(req.auth!.userId, req.params.id);
  res.status(204).end();
});
