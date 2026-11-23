import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { BCRYPT_ROUNDS } from '../auth/auth.service.js';
import { SessionModel } from '../auth/session.model.js';
import { EmailTokenModel } from '../auth/emailToken.model.js';
import { hashToken, hashesMatch, parseRefreshToken } from '../auth/tokens.js';
import { sendEmailInBackground } from '../email/email.service.js';
import { passwordChangedMessage } from '../email/templates.js';
import { UserModel, toPublicUser } from '../users/user.model.js';
import { ResumeModel } from '../resumes/resume.model.js';
import { AnalysisModel, toPublicAnalysis } from '../resumes/analysis.model.js';
import { JobMatchModel, toPublicJobMatch } from '../jobMatches/jobMatch.model.js';
import { ApplicationModel, toPublicApplication } from '../applications/application.model.js';
import { CoverLetterModel, toPublicCoverLetter } from '../coverLetters/coverLetter.model.js';
import {
  InterviewPrepModel,
  toPublicInterviewPrep,
} from '../interviewPreps/interviewPrep.model.js';
import { UsageModel } from '../usage/usage.model.js';
import { PaymentModel } from '../billing/payment.model.js';
import { disableSubscription } from '../billing/paystack.js';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  UpdateProfileInput,
} from './account.schema.js';

async function loadUser(userId: string) {
  const user = await UserModel.findById(userId).select('+passwordHash +billing.emailToken');
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  return user;
}

/**
 * Which session is this browser? Read from the refresh cookie, and only trusted
 * if the cookie really matches that session.
 */
export async function currentSessionId(
  userId: string,
  refreshToken: string | undefined,
): Promise<string | null> {
  const parsed = refreshToken ? parseRefreshToken(refreshToken) : null;
  if (!parsed) return null;
  const session = await SessionModel.findOne({ _id: parsed.sessionId, userId });
  return session && hashesMatch(session.tokenHash, hashToken(refreshToken!)) ? session.id : null;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await loadUser(userId);
  if (input.name !== undefined) user.name = input.name;
  if (input.emailReminders !== undefined) user.emailReminders = input.emailReminders;
  await user.save();
  return toPublicUser(user);
}

/** Changes (or, for Google-only accounts, sets) the password and logs out every other device. */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  keepSessionId: string | null,
) {
  const user = await loadUser(userId);

  if (user.passwordHash) {
    const ok = await bcrypt.compare(input.currentPassword ?? '', user.passwordHash);
    if (!ok) {
      throw new AppError(400, 'Your current password is not correct.', 'WRONG_PASSWORD');
    }
    if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
      throw new AppError(400, 'Choose a password you are not already using.', 'SAME_PASSWORD');
    }
  }

  user.passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await user.save();

  await SessionModel.deleteMany({
    userId: user._id,
    ...(keepSessionId ? { _id: { $ne: new Types.ObjectId(keepSessionId) } } : {}),
  });
  // Any reset link sent before the change should no longer work.
  await EmailTokenModel.deleteMany({ userId: user._id, purpose: 'reset_password' });

  sendEmailInBackground(passwordChangedMessage(user, `${env.appUrl}/forgot-password`));
  return toPublicUser(user);
}

/** Every device the user is logged in on, newest first. */
export async function listSessions(userId: string, thisSessionId: string | null) {
  const sessions = await SessionModel.find({ userId, expiresAt: { $gt: new Date() } })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
  return sessions.map((s) => ({
    id: s._id.toString(),
    userAgent: s.userAgent ?? null,
    createdAt: s.createdAt,
    lastActiveAt: s.updatedAt,
    current: s._id.toString() === thisSessionId,
  }));
}

export async function signOutOtherSessions(userId: string, keepSessionId: string | null) {
  const { deletedCount } = await SessionModel.deleteMany({
    userId,
    ...(keepSessionId ? { _id: { $ne: new Types.ObjectId(keepSessionId) } } : {}),
  });
  return { signedOut: deletedCount };
}

/** Everything Ribra stores about the user, as one JSON document (Privacy Policy: "export your data"). */
export async function exportData(userId: string) {
  const user = await loadUser(userId);
  const [resumes, analyses, matches, applications, letters, preps, usage, payments] =
    await Promise.all([
      ResumeModel.find({ userId }).sort({ createdAt: 1 }),
      AnalysisModel.find({ userId }).sort({ createdAt: 1 }),
      JobMatchModel.find({ userId }).sort({ createdAt: 1 }),
      ApplicationModel.find({ userId }).sort({ createdAt: 1 }),
      CoverLetterModel.find({ userId }).sort({ createdAt: 1 }),
      InterviewPrepModel.find({ userId }).sort({ createdAt: 1 }),
      UsageModel.find({ userId }).sort({ period: 1 }).lean(),
      PaymentModel.find({ userId }).sort({ paidAt: 1 }).lean(),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    account: toPublicUser(user),
    cvs: resumes.map((r) => ({
      id: r.id,
      title: r.title,
      fileName: r.fileName,
      fileType: r.fileType,
      text: r.text,
      createdAt: r.createdAt,
    })),
    cvAnalyses: analyses.map(toPublicAnalysis),
    jobMatches: matches.map(toPublicJobMatch),
    applications: applications.map(toPublicApplication),
    coverLetters: letters.map(toPublicCoverLetter),
    interviewPrep: preps.map(toPublicInterviewPrep),
    monthlyUsage: usage.map((u) => ({ period: u.period, counts: u.counts })),
    payments: payments.map((p) => ({
      reference: p.reference,
      amountNgn: p.amount / 100,
      currency: p.currency,
      paidAt: p.paidAt,
    })),
  };
}

/**
 * Permanently deletes the account and everything in it.
 * An active Paystack subscription is cancelled first, so nobody is charged after leaving.
 * Payment records (amount, date, reference) are kept for accounting, without the account.
 */
export async function deleteAccount(userId: string, input: DeleteAccountInput) {
  const user = await loadUser(userId);

  if (user.passwordHash) {
    const ok = await bcrypt.compare(input.password ?? '', user.passwordHash);
    if (!ok) throw new AppError(400, 'Your password is not correct.', 'WRONG_PASSWORD');
  } else if (input.confirmEmail !== user.email) {
    throw new AppError(400, 'Type your email address exactly to confirm.', 'CONFIRMATION_MISMATCH');
  }

  const billing = user.billing;
  if (
    billing?.subscriptionCode &&
    billing.emailToken &&
    (billing.status === 'active' || billing.status === 'attention')
  ) {
    // If this fails, stop: deleting the account but still charging the card would be worse.
    await disableSubscription(billing.subscriptionCode, billing.emailToken);
  }

  const owned = { userId: user._id };
  await Promise.all([
    ResumeModel.deleteMany(owned),
    AnalysisModel.deleteMany(owned),
    JobMatchModel.deleteMany(owned),
    ApplicationModel.deleteMany(owned),
    CoverLetterModel.deleteMany(owned),
    InterviewPrepModel.deleteMany(owned),
    UsageModel.deleteMany(owned),
    SessionModel.deleteMany(owned),
    EmailTokenModel.deleteMany(owned),
  ]);
  await UserModel.deleteOne({ _id: user._id });
  logger.info({ userId }, 'Account deleted');
}
