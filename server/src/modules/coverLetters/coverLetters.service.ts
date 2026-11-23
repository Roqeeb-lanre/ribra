import type { Types } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { generateStructured } from '../../ai/aiClient.js';
import { redactContactDetails } from '../../ai/redact.js';
import {
  COVER_LETTER_PROMPT_VERSION,
  buildCoverLetterMessages,
  coverLetterSchema,
  type CoverLetterResult,
} from '../../ai/prompts/coverLetter.js';
import * as usage from '../usage/usage.service.js';
import { loadMatchContext, toObjectId } from '../jobMatches/matchContext.js';
import { CoverLetterModel, toPublicCoverLetter } from './coverLetter.model.js';
import type { CreateCoverLetterInput, UpdateCoverLetterInput } from './coverLetters.schema.js';

const notFound = () => new AppError(404, 'Cover letter not found.', 'NOT_FOUND');

/** Turns the AI's parts into the finished letter, signed with the user's own name. */
export function composeLetter(ai: CoverLetterResult, name: string): string {
  const paragraphs = ai.paragraphs.map((p) => p.trim()).filter(Boolean);
  return [ai.greeting.trim(), ...paragraphs, `${ai.closing.trim()}\n${name}`].join('\n\n');
}

export async function writeCoverLetter(userId: string, input: CreateCoverLetterInput) {
  const { match, resume, user } = await loadMatchContext(userId, input.jobMatchId);

  await usage.reserveUse(userId, user.plan, 'coverLetter');
  let result;
  try {
    result = await generateStructured({
      name: 'cover_letter',
      schema: coverLetterSchema,
      messages: buildCoverLetterMessages({
        cvText: redactContactDetails(resume.text),
        jobDescription: match.jobDescription,
        jobTitle: match.jobTitle,
        company: match.company || null,
        tone: input.tone,
        length: input.length,
        notes: input.notes,
      }),
      temperature: 0.6,
    });
  } catch (err) {
    await usage.releaseUse(userId, 'coverLetter');
    throw err;
  }
  await usage.recordTokens(userId, result.totalTokens);

  const fields = {
    jobTitle: match.jobTitle,
    company: match.company || null,
    tone: input.tone,
    length: input.length,
    notes: input.notes,
    content: composeLetter(result.data, user.name),
    edited: false,
    aiModel: result.model,
    promptVersion: COVER_LETTER_PROMPT_VERSION,
    totalTokens: result.totalTokens ?? undefined,
    durationMs: result.durationMs,
  };

  // One letter per job match: create it, or replace the previous one.
  const letter = await CoverLetterModel.findOneAndUpdate(
    { userId, jobMatchId: match._id },
    { $set: fields, $setOnInsert: { userId, jobMatchId: match._id } },
    { upsert: true, new: true, runValidators: true },
  );
  return toPublicCoverLetter(letter!);
}

export async function listCoverLetters(userId: string) {
  const letters = await CoverLetterModel.find({ userId }).sort({ updatedAt: -1 }).limit(100);
  return letters.map(toPublicCoverLetter);
}

export async function getCoverLetterForMatch(userId: string, jobMatchId: string) {
  const letter = await CoverLetterModel.findOne({
    userId,
    jobMatchId: toObjectId(jobMatchId, 'Cover letter'),
  });
  if (!letter) throw notFound();
  return toPublicCoverLetter(letter);
}

export async function updateCoverLetter(userId: string, id: string, input: UpdateCoverLetterInput) {
  const letter = await CoverLetterModel.findOneAndUpdate(
    { _id: toObjectId(id, 'Cover letter'), userId },
    { $set: { content: input.content, edited: true } },
    { new: true },
  );
  if (!letter) throw notFound();
  return toPublicCoverLetter(letter);
}

export async function deleteCoverLetter(userId: string, id: string) {
  const deleted = await CoverLetterModel.findOneAndDelete({
    _id: toObjectId(id, 'Cover letter'),
    userId,
  });
  if (!deleted) throw notFound();
}

export async function deleteCoverLettersForMatches(userId: string, jobMatchIds: Types.ObjectId[]) {
  if (jobMatchIds.length === 0) return;
  await CoverLetterModel.deleteMany({ userId, jobMatchId: { $in: jobMatchIds } });
}
