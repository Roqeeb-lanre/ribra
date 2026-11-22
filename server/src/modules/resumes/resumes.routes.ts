import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { aiLimiter, uploadLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './resumes.controller.js';
import { uploadCv } from './upload.js';

export const resumesRouter = Router();
resumesRouter.use(requireAuth);

resumesRouter.get('/', controller.list);
resumesRouter.post('/', uploadLimiter, uploadCv, controller.upload);
resumesRouter.delete('/:id', controller.remove);
resumesRouter.post(
  '/:id/analyze',
  aiLimiter,
  validateBody(controller.analyzeSchema),
  controller.analyze,
);

export const analysesRouter = Router();
analysesRouter.use(requireAuth);

analysesRouter.get('/', controller.listAnalyses);
analysesRouter.get('/:id', controller.getAnalysis);
