import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { generateStructured } from '../../ai/aiClient.js';
import { redactContactDetails } from '../../ai/redact.js';
import {
  JOB_MATCH_PROMPT_VERSION,
  buildJobMatchMessages,
  jobMatchSchema,
} from '../../ai/prompts/jobMatch.js';
import { UserModel } from '../users/user.model.js';
import { ResumeModel } from '../resumes/resume.model.js';
import * as usage from '../usage/usage.service.js';
import { JobMatchModel, toJobMatchSummary, toPublicJobMatch } from './jobMatch.model.js';
import { combinedMatchScore, keywordCoverage, matchKeywords } from './matchKeywords.js';
import type { CreateJobMatchInput } from './jobMatches.schema.js';
import { unlinkJobMatches } from '../applications/applications.service.js';
import { deleteCoverLettersForMatches } from '../coverLetters/coverLetters.service.js';
import { deleteInterviewPrepsForMatches } from '../interviewPreps/interviewPreps.service.js';

/** Cleans up everything built from these job matches. Tracked applications are kept, unlinked. */
export async function cleanUpAfterMatches(userId: string, jobMatchIds: Types.ObjectId[]) {
  await Promise.all([
    unlinkJobMatches(userId, jobMatchIds),
    deleteCoverLettersForMatches(userId, jobMatchIds),
    deleteInterviewPrepsForMatches(userId, jobMatchIds),
  ]);
}

const notFound = (what: string) => new AppError(404, `${what} not found.`, 'NOT_FOUND');

function objectId(id: string, what: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw notFound(what);
  return new Types.ObjectId(id);
}

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Same CV + same job text (ignoring spacing and case) = same hash. */
function hashInput(resumeText: string, jobDescription: string): string {
  const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto
    .createHash('sha256')
    .update(`${normalise(resumeText)}\n---\n${normalise(jobDescription)}`)
    .digest('hex');
}

export async function createJobMatch(userId: string, input: CreateJobMatchInput) {
  const resume = await ResumeModel.findOne({ _id: objectId(input.resumeId, 'CV'), userId });
  if (!resume) throw notFound('CV');

  // Already compared this exact CV with this exact job? Return the saved result for free.
  const inputHash = hashInput(resume.text, input.jobDescription);
  const existing = await JobMatchModel.findOne({ userId, inputHash }).sort({ createdAt: -1 });
  if (existing) return { match: toPublicJobMatch(existing), cached: true };

  const user = await UserModel.findById(userId);
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');

  await usage.reserveUse(userId, user.plan, 'jobMatch');

  let result;
  try {
    result = await generateStructured({
      name: 'job_match',
      schema: jobMatchSchema,
      messages: buildJobMatchMessages(redactContactDetails(resume.text), input.jobDescription),
      temperature: 0.2,
    });
  } catch (err) {
    await usage.releaseUse(userId, 'jobMatch');
    throw err;
  }

  await usage.recordTokens(userId, result.totalTokens);
  const ai = result.data;

  // The AI lists the keywords; our own code decides which ones the CV actually contains.
  const keywords = matchKeywords(resume.text, ai.keywords.slice(0, 25));
  const coverage = keywordCoverage(keywords);
  const fitScore = clamp(ai.fitScore);

  const match = await JobMatchModel.create({
    userId,
    resumeId: resume._id,
    resumeTitle: resume.title,
    jobTitle: input.jobTitle || ai.jobTitle || 'Untitled role',
    company: input.company || ai.company || undefined,
    seniority: ai.seniority,
    jobDescription: input.jobDescription,
    inputHash,
    matchScore: combinedMatchScore(fitScore, coverage),
    fitScore,
    keywordCoverage: coverage,
    keywords,
    verdict: ai.verdict,
    strengths: ai.strengths.slice(0, 5),
    gaps: ai.gaps.slice(0, 5),
    tailoringTips: ai.tailoringTips.slice(0, 6),
    suggestedSummary: ai.suggestedSummary,
    aiModel: result.model,
    promptVersion: JOB_MATCH_PROMPT_VERSION,
    totalTokens: result.totalTokens ?? undefined,
    durationMs: result.durationMs,
  });

  return { match: toPublicJobMatch(match), cached: false };
}

export async function listJobMatches(userId: string) {
  const matches = await JobMatchModel.find({ userId }).sort({ createdAt: -1 }).limit(50);
  return matches.map(toJobMatchSummary);
}

export async function getJobMatch(userId: string, id: string) {
  const match = await JobMatchModel.findOne({ _id: objectId(id, 'Job match'), userId });
  if (!match) throw notFound('Job match');
  return toPublicJobMatch(match);
}

export async function deleteJobMatch(userId: string, id: string) {
  const deleted = await JobMatchModel.findOneAndDelete({ _id: objectId(id, 'Job match'), userId });
  if (!deleted) throw notFound('Job match');
  await cleanUpAfterMatches(userId, [deleted._id]);
}
