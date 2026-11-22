import { Types } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { generateStructured } from '../../ai/aiClient.js';
import { redactContactDetails } from '../../ai/redact.js';
import {
  CV_ANALYSIS_PROMPT_VERSION,
  buildCvAnalysisMessages,
  cvAnalysisSchema,
} from '../../ai/prompts/cvAnalysis.js';
import { UserModel } from '../users/user.model.js';
import * as usage from '../usage/usage.service.js';
import { ResumeModel, toPublicResume } from './resume.model.js';
import { AnalysisModel, toAnalysisSummary, toPublicAnalysis } from './analysis.model.js';
import { detectFileType, extractResumeText } from './extractText.js';

export const MAX_SAVED_RESUMES = 10;

const notFound = (what: string) => new AppError(404, `${what} not found.`, 'NOT_FOUND');

function objectId(id: string, what: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw notFound(what);
  return new Types.ObjectId(id);
}

const clampScore = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export async function uploadResume(
  userId: string,
  file: { buffer: Buffer; originalname: string; size: number } | undefined,
  title?: string,
) {
  if (!file) throw new AppError(400, 'Choose a CV file to upload.', 'FILE_REQUIRED');

  const fileType = detectFileType(file.buffer, file.originalname);
  if (!fileType) {
    throw new AppError(
      415,
      'Upload your CV as a PDF, Word (.docx) or text (.txt) file.',
      'UNSUPPORTED_FILE',
    );
  }

  const count = await ResumeModel.countDocuments({ userId });
  if (count >= MAX_SAVED_RESUMES) {
    throw new AppError(
      409,
      `You can keep up to ${MAX_SAVED_RESUMES} CVs. Delete an old one first.`,
      'RESUME_LIMIT',
    );
  }

  const text = await extractResumeText(file.buffer, fileType);
  const cleanName = file.originalname.replace(/[^\w.\- ()]/g, '').slice(0, 120) || `cv.${fileType}`;

  const resume = await ResumeModel.create({
    userId,
    title: title?.trim() || cleanName.replace(/\.(pdf|docx|txt)$/i, ''),
    fileName: cleanName,
    fileType,
    fileSize: file.size,
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  });

  return toPublicResume(resume);
}

export async function listResumes(userId: string) {
  const resumes = await ResumeModel.find({ userId }).select('-text').sort({ createdAt: -1 });

  // Latest score for each CV, in one query.
  const latest = await AnalysisModel.aggregate<{ _id: Types.ObjectId; score: number }>([
    { $match: { userId: new Types.ObjectId(userId) } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$resumeId', score: { $first: '$overallScore' } } },
  ]);
  const scores = new Map(latest.map((l) => [l._id.toString(), l.score]));

  return resumes.map((r) => toPublicResume(r, scores.get(r._id.toString()) ?? null));
}

export async function deleteResume(userId: string, resumeId: string) {
  const _id = objectId(resumeId, 'CV');
  const deleted = await ResumeModel.findOneAndDelete({ _id, userId });
  if (!deleted) throw notFound('CV');
  await AnalysisModel.deleteMany({ resumeId: _id, userId });
}

export async function analyzeResume(userId: string, resumeId: string, targetRole?: string) {
  const resume = await ResumeModel.findOne({ _id: objectId(resumeId, 'CV'), userId });
  if (!resume) throw notFound('CV');

  const user = await UserModel.findById(userId);
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');

  // Count this use up front (atomic), and give it back if the AI fails.
  await usage.reserveUse(userId, user.plan, 'cvAnalysis');

  let result;
  try {
    result = await generateStructured({
      name: 'cv_analysis',
      schema: cvAnalysisSchema,
      messages: buildCvAnalysisMessages(redactContactDetails(resume.text), targetRole),
      temperature: 0.2,
    });
  } catch (err) {
    await usage.releaseUse(userId, 'cvAnalysis');
    throw err;
  }

  await usage.recordTokens(userId, result.totalTokens);
  const ai = result.data;

  const analysis = await AnalysisModel.create({
    userId,
    resumeId: resume._id,
    resumeTitle: resume.title,
    targetRole: targetRole || undefined,
    overallScore: clampScore(ai.overallScore),
    scores: {
      ats: clampScore(ai.scores.ats),
      impact: clampScore(ai.scores.impact),
      skills: clampScore(ai.scores.skills),
      structure: clampScore(ai.scores.structure),
      clarity: clampScore(ai.scores.clarity),
    },
    detectedRole: ai.detectedRole,
    experienceLevel: ai.experienceLevel,
    summary: ai.summary,
    strengths: ai.strengths.slice(0, 6),
    improvements: ai.improvements.slice(0, 8),
    sections: ai.sections.slice(0, 10).map((s) => ({ ...s, score: clampScore(s.score) })),
    improvedBullets: ai.improvedBullets.slice(0, 6),
    skills: {
      technical: ai.skills.technical.slice(0, 30),
      soft: ai.skills.soft.slice(0, 15),
      missing: ai.skills.missing.slice(0, 10),
    },
    aiModel: result.model,
    promptVersion: CV_ANALYSIS_PROMPT_VERSION,
    totalTokens: result.totalTokens ?? undefined,
    durationMs: result.durationMs,
  });

  return toPublicAnalysis(analysis);
}

export async function listAnalyses(userId: string) {
  const analyses = await AnalysisModel.find({ userId }).sort({ createdAt: -1 }).limit(50);
  return analyses.map(toAnalysisSummary);
}

export async function getAnalysis(userId: string, analysisId: string) {
  const analysis = await AnalysisModel.findOne({ _id: objectId(analysisId, 'Analysis'), userId });
  if (!analysis) throw notFound('Analysis');
  return toPublicAnalysis(analysis);
}
