import type { AccessTokenPayload } from '../modules/auth/tokens.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth once the access token has been verified. */
      auth?: AccessTokenPayload;
    }
  }
}

export {};
