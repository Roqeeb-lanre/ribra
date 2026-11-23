import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { generateStructured } from '../../ai/aiClient.js';
import { redactContactDetails } from '../../ai/redact.js';
import {
  ANSWER_FEEDBACK_PROMPT_VERSION,
  INTERVIEW_PREP_PROMPT_VERSION,
  answerFeedbackSchema,
  buildAnswerFeedbackMessages,
  buildInterviewPrepMessages,
  interviewPrepSchema,
} from '../../ai/prompts/interviewPrep.js';
import * as usage from '../usage/usage.service.js';
import { UserModel } from '../users/user.model.js';
import { ResumeModel } from '../resumes/resume.model.js';
import { JobMatchModel } from '../jobMatches/jobMatch.model.js';
import { loadMatchContext, toObjectId } from '../jobMatches/matchContext.js';
import {
  InterviewPrepModel,
  toInterviewPrepSummary,
  toPublicInterviewPrep,
} from './interviewPrep.model.js';
import type { AnswerInput } from './interviewPreps.schema.js';

const notFound = (what = 'Interview prep') => new AppError(404, `${what} not found.`, 'NOT_FOUND');

/** Generates (or regenerates) the practice questions for a job match. */
export async function prepareInterview(userId: string, jobMatchId: string) {
  const { match, resume, user } = await loadMatchContext(userId, jobMatchId);

  await usage.reserveUse(userId, user.plan, 'interviewPrep');
  let result;
  try {
    result = await generateStructured({
      name: 'interview_prep',
      schema: interviewPrepSchema,
      messages: buildInterviewPrepMessages({
        cvText: redactContactDetails(resume.text),
        jobDescription: match.jobDescription,
        jobTitle: match.jobTitle,
        company: match.company || null,
        gaps: match.gaps,
      }),
      temperature: 0.4,
    });
  } catch (err) {
    await usage.releaseUse(userId, 'interviewPrep');
    throw err;
  }
  await usage.recordTokens(userId, result.totalTokens);

  const questions = result.data.questions.slice(0, 10).map((q) => ({
    ...q,
    cvPoints: q.cvPoints.slice(0, 3),
    answer: '',
    feedback: null,
  }));
  if (questions.length === 0) {
    throw new AppError(502, 'The AI did not return any questions. Please try again.', 'AI_EMPTY');
  }

  const prep = await InterviewPrepModel.findOneAndUpdate(
    { userId, jobMatchId: match._id },
    {
      $set: {
        jobTitle: match.jobTitle,
        company: match.company || null,
        questions,
        aiModel: result.model,
        promptVersion: INTERVIEW_PREP_PROMPT_VERSION,
        totalTokens: result.totalTokens ?? undefined,
        durationMs: result.durationMs,
      },
      $setOnInsert: { userId, jobMatchId: match._id },
    },
    { upsert: true, new: true, runValidators: true },
  );
  return toPublicInterviewPrep(prep!);
}

export async function listInterviewPreps(userId: string) {
  const preps = await InterviewPrepModel.find({ userId }).sort({ updatedAt: -1 }).limit(100);
  return preps.map(toInterviewPrepSummary);
}

export async function getInterviewPrepForMatch(userId: string, jobMatchId: string) {
  const prep = await InterviewPrepModel.findOne({
    userId,
    jobMatchId: toObjectId(jobMatchId, 'Interview prep'),
  });
  if (!prep) throw notFound();
  return toPublicInterviewPrep(prep);
}

/** Reviews the user's practice answer to one question. */
export async function reviewAnswer(
  userId: string,
  prepId: string,
  questionId: string,
  input: AnswerInput,
) {
  const prep = await InterviewPrepModel.findOne({
    _id: toObjectId(prepId, 'Interview prep'),
    userId,
  });
  if (!prep) throw notFound();
  if (!Types.ObjectId.isValid(questionId)) throw notFound('Question');
  const question = prep.questions.id(questionId);
  if (!question) throw notFound('Question');

  const match = await JobMatchModel.findOne({ _id: prep.jobMatchId, userId });
  const [resume, user] = await Promise.all([
    match ? ResumeModel.findOne({ _id: match.resumeId, userId }) : null,
    UserModel.findById(userId),
  ]);
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');

  await usage.reserveUse(userId, user.plan, 'answerFeedback');
  let result;
  try {
    result = await generateStructured({
      name: 'answer_feedback',
      schema: answerFeedbackSchema,
      messages: buildAnswerFeedbackMessages({
        cvText: resume ? redactContactDetails(resume.text) : '(CV not available)',
        jobTitle: prep.jobTitle,
        question: question.question,
        whyTheyAsk: question.whyTheyAsk,
        answer: input.answer,
      }),
      temperature: 0.3,
      maxTokens: 4096,
    });
  } catch (err) {
    await usage.releaseUse(userId, 'answerFeedback');
    throw err;
  }
  await usage.recordTokens(userId, result.totalTokens);

  const ai = result.data;
  question.answer = input.answer;
  question.feedback = {
    score: Math.min(10, Math.max(1, Math.round(ai.score))),
    summary: ai.summary,
    strengths: ai.strengths.slice(0, 3),
    improvements: ai.improvements.slice(0, 3),
    improvedAnswer: ai.improvedAnswer,
    aiModel: result.model,
    promptVersion: ANSWER_FEEDBACK_PROMPT_VERSION,
    at: new Date(),
  };
  prep.markModified('questions');
  await prep.save();
  return toPublicInterviewPrep(prep);
}

export async function deleteInterviewPrep(userId: string, id: string) {
  const deleted = await InterviewPrepModel.findOneAndDelete({
    _id: toObjectId(id, 'Interview prep'),
    userId,
  });
  if (!deleted) throw notFound();
}

export async function deleteInterviewPrepsForMatches(
  userId: string,
  jobMatchIds: Types.ObjectId[],
) {
  if (jobMatchIds.length === 0) return;
  await InterviewPrepModel.deleteMany({ userId, jobMatchId: { $in: jobMatchIds } });
}
