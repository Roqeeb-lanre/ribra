import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', registerLimiter, validateBody(registerSchema), controller.register);
authRouter.post('/login', loginLimiter, validateBody(loginSchema), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);
