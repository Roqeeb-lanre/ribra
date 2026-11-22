import { Router, type Request } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  createApplicationSchema,
  updateApplicationSchema,
  type CreateApplicationInput,
  type UpdateApplicationInput,
} from './applications.schema.js';
import * as service from './applications.service.js';

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

applicationsRouter.get('/', async (req, res) => {
  res.json({ applications: await service.listApplications(req.auth!.userId) });
});

applicationsRouter.post('/', validateBody(createApplicationSchema), async (req, res) => {
  const application = await service.createApplication(
    req.auth!.userId,
    req.body as CreateApplicationInput,
  );
  res.status(201).json({ application });
});

/** POST /api/v1/applications/from-match/:matchId: "Track this job" on a match report. */
applicationsRouter.post('/from-match/:matchId', async (req: Request<{ matchId: string }>, res) => {
  const { application, created } = await service.trackJobMatch(
    req.auth!.userId,
    req.params.matchId,
  );
  res.status(created ? 201 : 200).json({ application, created });
});

applicationsRouter.get('/:id', async (req: Request<{ id: string }>, res) => {
  res.json({ application: await service.getApplication(req.auth!.userId, req.params.id) });
});

applicationsRouter.patch(
  '/:id',
  validateBody(updateApplicationSchema),
  async (req: Request<{ id: string }>, res) => {
    const application = await service.updateApplication(
      req.auth!.userId,
      req.params.id,
      req.body as UpdateApplicationInput,
    );
    res.json({ application });
  },
);

applicationsRouter.delete('/:id', async (req: Request<{ id: string }>, res) => {
  await service.deleteApplication(req.auth!.userId, req.params.id);
  res.status(204).end();
});
