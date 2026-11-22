import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import {
  UserModel,
  toPublicUser,
  type PublicUser,
  type UserDocument,
} from '../users/user.model.js';
import { SessionModel } from './session.model.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';
import {
  consumeEmailToken,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from './accountEmails.js';
import { verifyGoogleIdToken } from './google.js';
import {
  createRefreshToken,
  hashToken,
  hashesMatch,
  parseRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from './tokens.js';

// Fewer hashing rounds in tests keeps the test suite fast; 12 is the secure default.
const BCRYPT_ROUNDS = env.isTest ? 4 : 12;

// Used to spend the same time on unknown emails as on real ones (stops "does this email exist?" probing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export type ClientMeta = { userAgent?: string; ip?: string };

export type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

export async function startSession(user: UserDocument, meta: ClientMeta): Promise<AuthResult> {
  const sessionId = new Types.ObjectId();
  const refreshToken = createRefreshToken(sessionId.toString());
  const expiresAt = refreshTokenExpiry();

  await SessionModel.create({
    _id: sessionId,
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    userAgent: meta.userAgent?.slice(0, 300),
    ip: meta.ip,
    expiresAt,
  });

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({ userId: user._id.toString(), role: user.role }),
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

export async function register(input: RegisterInput, meta: ClientMeta): Promise<AuthResult> {
  const exists = await UserModel.exists({ email: input.email });
  if (exists) {
    throw new AppError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
  }

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    lastLoginAt: new Date(),
  });

  logger.info({ userId: user.id }, 'User registered');
  await sendVerificationEmail(user);
  return startSession(user, meta);
}

export async function login(input: LoginInput, meta: ClientMeta): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');

  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (user && !user.passwordHash && user.googleId) {
    throw new AppError(
      401,
      'This account uses Google sign-in. Click "Continue with Google".',
      'USE_GOOGLE_SIGN_IN',
    );
  }
  if (!user || !user.passwordHash || !passwordOk) {
    throw new AppError(401, 'Incorrect email or password.', 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return startSession(user, meta);
}

/**
 * Swaps a valid refresh token for a new access token AND a new refresh token (rotation).
 * If an old, already-used refresh token shows up again, someone may have stolen it,
 * so every session for that user is ended.
 */
export async function refresh(refreshToken: string | undefined): Promise<AuthResult> {
  const invalid = new AppError(
    401,
    'Your session has ended. Please log in again.',
    'INVALID_SESSION',
  );

  const parsed = refreshToken ? parseRefreshToken(refreshToken) : null;
  if (!refreshToken || !parsed) throw invalid;

  const session = await SessionModel.findById(parsed.sessionId);
  if (!session) throw invalid;

  if (!hashesMatch(session.tokenHash, hashToken(refreshToken))) {
    await SessionModel.deleteMany({ userId: session.userId });
    logger.warn(
      { userId: session.userId.toString() },
      'Refresh token reuse detected; all sessions revoked',
    );
    throw invalid;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await session.deleteOne();
    throw invalid;
  }

  const user = await UserModel.findById(session.userId).select('+passwordHash');
  if (!user) {
    await session.deleteOne();
    throw invalid;
  }

  const newRefreshToken = createRefreshToken(session._id.toString());
  session.tokenHash = hashToken(newRefreshToken);
  session.expiresAt = refreshTokenExpiry();
  await session.save();

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({ userId: user._id.toString(), role: user.role }),
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt: session.expiresAt,
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  const parsed = refreshToken ? parseRefreshToken(refreshToken) : null;
  if (!refreshToken || !parsed) return;

  const session = await SessionModel.findById(parsed.sessionId);
  if (session && hashesMatch(session.tokenHash, hashToken(refreshToken))) {
    await session.deleteOne();
  }
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = Types.ObjectId.isValid(userId)
    ? await UserModel.findById(userId).select('+passwordHash')
    : null;
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  return toPublicUser(user);
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function verifyEmail(token: string): Promise<PublicUser> {
  const userId = await consumeEmailToken(token, 'verify_email');
  if (!userId) {
    throw new AppError(
      400,
      'This confirmation link is invalid or has expired. Request a new one.',
      'TOKEN_INVALID',
    );
  }
  const user = await UserModel.findByIdAndUpdate(
    userId,
    { emailVerified: true },
    { new: true },
  ).select('+passwordHash');
  if (!user) throw new AppError(400, 'This confirmation link is invalid.', 'TOKEN_INVALID');
  return toPublicUser(user);
}

export async function resendVerification(userId: string): Promise<{ alreadyVerified: boolean }> {
  const user = await UserModel.findById(userId);
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  if (user.emailVerified) return { alreadyVerified: true };
  await sendVerificationEmail(user);
  return { alreadyVerified: false };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Always "succeeds" from the caller's point of view, so nobody can use this form
 * to find out which emails have Ribra accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await UserModel.findOne({ email });
  if (user) await sendPasswordResetEmail(user);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await consumeEmailToken(token, 'reset_password');
  if (!userId) {
    throw new AppError(
      400,
      'This reset link is invalid or has expired. Request a new one.',
      'TOKEN_INVALID',
    );
  }
  await UserModel.updateOne(
    { _id: userId },
    // Clicking the emailed link also proves they own the address.
    { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), emailVerified: true },
  );
  // Log out every device: if someone else knew the old password, they're out now.
  await SessionModel.deleteMany({ userId });
  logger.info({ userId: userId.toString() }, 'Password reset');
}

// ---------------------------------------------------------------------------
// Google sign-in
// ---------------------------------------------------------------------------

/**
 * Signs in (or signs up) with a Google ID token.
 * If an account with the same verified email already exists, Google is linked to it.
 */
export async function googleSignIn(
  credential: string,
  meta: ClientMeta,
): Promise<AuthResult & { isNewUser: boolean }> {
  const profile = await verifyGoogleIdToken(credential);
  if (!profile.emailVerified) {
    throw new AppError(
      401,
      'Your Google email address is not verified.',
      'GOOGLE_EMAIL_UNVERIFIED',
    );
  }

  // passwordHash is hidden by default; load it so the profile can say whether a password is set.
  let user = await UserModel.findOne({ googleId: profile.googleId }).select('+passwordHash');
  let isNewUser = false;

  if (!user) {
    user = await UserModel.findOne({ email: profile.email }).select('+passwordHash');
    if (user) {
      // Existing email/password account: link Google to it.
      user.googleId = profile.googleId;
      user.emailVerified = true;
      if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
    } else {
      user = new UserModel({
        name: profile.name.slice(0, 80),
        email: profile.email,
        googleId: profile.googleId,
        avatarUrl: profile.picture,
        emailVerified: true,
      });
      isNewUser = true;
    }
  }

  user.lastLoginAt = new Date();
  await user.save();
  logger.info({ userId: user.id, isNewUser }, 'Google sign-in');

  return { ...(await startSession(user, meta)), isNewUser };
}
