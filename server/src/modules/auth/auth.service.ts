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

async function startSession(user: UserDocument, meta: ClientMeta): Promise<AuthResult> {
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
  return startSession(user, meta);
}

export async function login(input: LoginInput, meta: ClientMeta): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');

  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
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

  const user = await UserModel.findById(session.userId);
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
  const user = Types.ObjectId.isValid(userId) ? await UserModel.findById(userId) : null;
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  return toPublicUser(user);
}
