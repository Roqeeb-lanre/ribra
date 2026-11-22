import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { emailLimiter, loginLimiter, registerLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import {
  emailOnlySchema,
  googleSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', registerLimiter, validateBody(registerSchema), controller.register);
authRouter.post('/login', loginLimiter, validateBody(loginSchema), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);

// Email verification
authRouter.post('/verify-email', validateBody(tokenSchema), controller.verifyEmail);
authRouter.post('/resend-verification', requireAuth, emailLimiter, controller.resendVerification);

// Password reset
authRouter.post(
  '/forgot-password',
  emailLimiter,
  validateBody(emailOnlySchema),
  controller.forgotPassword,
);
authRouter.post('/reset-password', validateBody(resetPasswordSchema), controller.resetPassword);

// Google sign-in
authRouter.post('/google', loginLimiter, validateBody(googleSchema), controller.google);
