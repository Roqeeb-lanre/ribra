import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { UserModel } from '../users/user.model.js';
import { ResumeModel } from '../resumes/resume.model.js';
import { JobMatchModel } from './jobMatch.model.js';

const notFound = (what: string) => new AppError(404, `${what} not found.`, 'NOT_FOUND');

export function toObjectId(id: string, what: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw notFound(what);
  return new Types.ObjectId(id);
}

/**
 * Everything the cover letter and interview prep features need:
 * the user (for their plan), the job match (job text) and the CV it was matched with.
 */
export async function loadMatchContext(userId: string, jobMatchId: string) {
  const match = await JobMatchModel.findOne({ _id: toObjectId(jobMatchId, 'Job match'), userId });
  if (!match) throw notFound('Job match');

  const [resume, user] = await Promise.all([
    ResumeModel.findOne({ _id: match.resumeId, userId }),
    UserModel.findById(userId),
  ]);
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  if (!resume) throw notFound('CV');

  return { match, resume, user };
}
