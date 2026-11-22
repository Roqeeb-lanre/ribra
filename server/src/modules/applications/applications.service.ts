import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { JobMatchModel } from '../jobMatches/jobMatch.model.js';
import {
  ApplicationModel,
  toPublicApplication,
  type ApplicationDocument,
  type ApplicationStatus,
} from './application.model.js';
import type { CreateApplicationInput, UpdateApplicationInput } from './applications.schema.js';

/** Plenty for one job search, and stops a script from filling the database. */
export const MAX_APPLICATIONS = 500;

const notFound = (what: string) => new AppError(404, `${what} not found.`, 'NOT_FOUND');

function objectId(id: string, what: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw notFound(what);
  return new Types.ObjectId(id);
}

async function ensureRoom(userId: string) {
  const count = await ApplicationModel.countDocuments({ userId });
  if (count >= MAX_APPLICATIONS) {
    throw new AppError(
      409,
      `You can track up to ${MAX_APPLICATIONS} jobs. Delete some old ones to add more.`,
      'LIMIT_REACHED',
    );
  }
}

/** Moving past "saved" means the user applied, so fill in the date if they didn't. */
function applyStatus(app: ApplicationDocument, status: ApplicationStatus, now: Date) {
  if (app.status === status && app.history.length > 0) return;
  app.status = status;
  app.history.push({ status, at: now });
  if (status !== 'saved' && !app.appliedAt) app.appliedAt = now;
}

export async function listApplications(userId: string) {
  const apps = await ApplicationModel.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(MAX_APPLICATIONS);
  return apps.map(toPublicApplication);
}

export async function getApplication(userId: string, id: string) {
  const app = await ApplicationModel.findOne({ _id: objectId(id, 'Application'), userId });
  if (!app) throw notFound('Application');
  return toPublicApplication(app);
}

export async function createApplication(userId: string, input: CreateApplicationInput) {
  await ensureRoom(userId);
  const { status, ...rest } = input;
  const app = new ApplicationModel({ ...rest, userId });
  applyStatus(app, status, new Date());
  await app.save();
  return toPublicApplication(app);
}

/**
 * "Track this job" on a Job Match report. Tracking the same match twice
 * returns the existing application instead of making a copy.
 */
export async function trackJobMatch(userId: string, jobMatchId: string) {
  const matchId = objectId(jobMatchId, 'Job match');
  const existing = await ApplicationModel.findOne({ userId, jobMatchId: matchId });
  if (existing) return { application: toPublicApplication(existing), created: false };

  const match = await JobMatchModel.findOne({ _id: matchId, userId });
  if (!match) throw notFound('Job match');
  await ensureRoom(userId);

  const app = new ApplicationModel({
    userId,
    company: match.company || 'Unknown company',
    role: match.jobTitle,
    jobMatchId: matchId,
    matchScore: match.matchScore,
  });
  applyStatus(app, 'saved', new Date());

  try {
    await app.save();
  } catch (err) {
    // Two clicks at once: the unique index let only one through, so return that one.
    if ((err as { code?: number }).code === 11000) {
      const winner = await ApplicationModel.findOne({ userId, jobMatchId: matchId });
      if (winner) return { application: toPublicApplication(winner), created: false };
    }
    throw err;
  }
  return { application: toPublicApplication(app), created: true };
}

export async function updateApplication(userId: string, id: string, input: UpdateApplicationInput) {
  const app = await ApplicationModel.findOne({ _id: objectId(id, 'Application'), userId });
  if (!app) throw notFound('Application');

  const { status, ...rest } = input;
  app.set(rest);
  if (status) applyStatus(app, status, new Date());
  await app.save();
  return toPublicApplication(app);
}

export async function deleteApplication(userId: string, id: string) {
  const deleted = await ApplicationModel.findOneAndDelete({
    _id: objectId(id, 'Application'),
    userId,
  });
  if (!deleted) throw notFound('Application');
}

/** When job matches are deleted, keep the applications but drop the broken link. */
export async function unlinkJobMatches(userId: string, jobMatchIds: Types.ObjectId[]) {
  if (jobMatchIds.length === 0) return;
  await ApplicationModel.updateMany(
    { userId, jobMatchId: { $in: jobMatchIds } },
    { $set: { jobMatchId: null } },
  );
}
