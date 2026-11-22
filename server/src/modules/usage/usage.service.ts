import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { UsageModel } from './usage.model.js';

export type Feature = 'cvAnalysis' | 'jobMatch';
type Plan = 'free' | 'pro';

export function currentPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7); // "2026-11"
}

/** Monthly limit per plan. null = unlimited. */
export function limitFor(feature: Feature, plan: Plan): number | null {
  if (plan === 'pro') return null;
  const limits: Record<Feature, number> = {
    cvAnalysis: env.FREE_CV_ANALYSES_PER_MONTH,
    jobMatch: env.FREE_JOB_MATCHES_PER_MONTH,
  };
  return limits[feature];
}

/**
 * Reserves one use BEFORE calling the AI, in a single atomic database operation,
 * so two requests at the same moment can't both slip past the limit.
 * Call releaseUse() if the AI call then fails, so the user isn't charged.
 */
export async function reserveUse(userId: string, plan: Plan, feature: Feature): Promise<void> {
  const limit = limitFor(feature, plan);
  const path = `counts.${feature}`;
  const userObjectId = new Types.ObjectId(userId);
  const period = currentPeriod();

  if (limit === null) {
    await UsageModel.updateOne(
      { userId: userObjectId, period },
      { $inc: { [path]: 1 } },
      { upsert: true },
    );
    return;
  }

  try {
    // Matches only if the user is still under the limit. If not, the upsert tries to insert
    // a second document for the same user+month, which the unique index rejects (code 11000).
    await UsageModel.findOneAndUpdate(
      {
        userId: userObjectId,
        period,
        $or: [{ [path]: { $lt: limit } }, { [path]: { $exists: false } }],
      },
      { $inc: { [path]: 1 } },
      { upsert: true },
    );
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const what = feature === 'cvAnalysis' ? 'CV analyses' : 'job matches';
      throw new AppError(
        403,
        `You've used all ${limit} free ${what} for this month. They reset on the 1st.`,
        'PLAN_LIMIT_REACHED',
      );
    }
    throw err;
  }
}

/** Gives a reserved use back (e.g. the AI call failed). */
export async function releaseUse(userId: string, feature: Feature): Promise<void> {
  await UsageModel.updateOne(
    { userId: new Types.ObjectId(userId), period: currentPeriod() },
    { $inc: { [`counts.${feature}`]: -1 } },
  );
}

export async function recordTokens(userId: string, tokens: number | null): Promise<void> {
  if (!tokens) return;
  await UsageModel.updateOne(
    { userId: new Types.ObjectId(userId), period: currentPeriod() },
    { $inc: { tokens } },
  );
}

export async function getUsageSummary(userId: string, plan: Plan) {
  const period = currentPeriod();
  const doc = await UsageModel.findOne({ userId: new Types.ObjectId(userId), period }).lean();
  const summarise = (feature: Feature) => {
    const used = doc?.counts?.[feature] ?? 0;
    const limit = limitFor(feature, plan);
    return { used, limit, remaining: limit === null ? null : Math.max(limit - used, 0) };
  };

  return { period, plan, cvAnalysis: summarise('cvAnalysis'), jobMatch: summarise('jobMatch') };
}
