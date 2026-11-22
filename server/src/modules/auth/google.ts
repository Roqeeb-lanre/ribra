import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

// Google's public signing keys. jose downloads and caches them.
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export type GoogleProfile = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

/**
 * Checks the ID token that "Sign in with Google" gives the browser:
 * signed by Google, issued for OUR client ID, not expired. Only then do we trust the email in it.
 */
export async function verifyGoogleIdToken(credential: string): Promise<GoogleProfile> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, 'Google sign-in is not set up yet.', 'GOOGLE_NOT_CONFIGURED');
  }

  try {
    const { payload } = await jwtVerify(credential, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.GOOGLE_CLIENT_ID,
    });

    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string')
      throw new Error('Missing claims');

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name:
        typeof payload.name === 'string' && payload.name.trim()
          ? payload.name
          : payload.email.split('@')[0]!,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  } catch {
    throw new AppError(401, 'Google sign-in failed. Please try again.', 'GOOGLE_TOKEN_INVALID');
  }
}
