import crypto from 'node:crypto';
import type { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { sendEmailInBackground } from '../email/email.service.js';
import { resetPasswordMessage, verifyEmailMessage } from '../email/templates.js';
import { EmailTokenModel } from './emailToken.model.js';
import { hashToken } from './tokens.js';

type Purpose = 'verify_email' | 'reset_password';

const TTL_MS: Record<Purpose, number> = {
  verify_email: 24 * 60 * 60 * 1000, // 24 hours
  reset_password: 30 * 60 * 1000, // 30 minutes
};

/** Creates a fresh one-time token (and cancels any older one for the same purpose). */
export async function issueEmailToken(userId: Types.ObjectId, purpose: Purpose): Promise<string> {
  await EmailTokenModel.deleteMany({ userId, purpose });
  const token = crypto.randomBytes(32).toString('base64url');
  await EmailTokenModel.create({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TTL_MS[purpose]),
  });
  return token;
}

/**
 * Uses up a token: returns the user id it belongs to, or null if it is unknown, expired or already used.
 * findOneAndDelete makes this atomic, so the same link can't be used twice at the same moment.
 */
export async function consumeEmailToken(
  token: string,
  purpose: Purpose,
): Promise<Types.ObjectId | null> {
  if (!token || token.length > 200) return null;
  const doc = await EmailTokenModel.findOneAndDelete({
    tokenHash: hashToken(token),
    purpose,
    expiresAt: { $gt: new Date() },
  });
  return doc ? doc.userId : null;
}

type MailUser = { _id: Types.ObjectId; name: string; email: string };

export async function sendVerificationEmail(user: MailUser): Promise<void> {
  const token = await issueEmailToken(user._id, 'verify_email');
  sendEmailInBackground(verifyEmailMessage(user, `${env.appUrl}/verify-email?token=${token}`));
}

export async function sendPasswordResetEmail(user: MailUser): Promise<void> {
  const token = await issueEmailToken(user._id, 'reset_password');
  sendEmailInBackground(resetPasswordMessage(user, `${env.appUrl}/reset-password?token=${token}`));
}
