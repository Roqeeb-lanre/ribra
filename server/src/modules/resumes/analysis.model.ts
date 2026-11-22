import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const scoreField = { type: Number, min: 0, max: 100, required: true };

/** One AI review of one CV. Kept forever so users can see their score improve over time. */
const analysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true, index: true },
    resumeTitle: { type: String, required: true },
    targetRole: { type: String },

    overallScore: scoreField,
    scores: {
      ats: scoreField,
      impact: scoreField,
      skills: scoreField,
      structure: scoreField,
      clarity: scoreField,
    },
    detectedRole: { type: String, required: true },
    experienceLevel: { type: String, required: true },
    summary: { type: String, required: true },
    strengths: { type: [String], default: [] },
    improvements: {
      type: [{ _id: false, priority: String, title: String, detail: String }],
      default: [],
    },
    sections: {
      type: [{ _id: false, name: String, score: Number, feedback: String }],
      default: [],
    },
    improvedBullets: {
      type: [{ _id: false, original: String, improved: String, reason: String }],
      default: [],
    },
    skills: {
      technical: { type: [String], default: [] },
      soft: { type: [String], default: [] },
      missing: { type: [String], default: [] },
    },

    // Bookkeeping: which model and prompt produced this, and what it cost.
    aiModel: { type: String, required: true },
    promptVersion: { type: String, required: true },
    totalTokens: { type: Number },
    durationMs: { type: Number },
  },
  { timestamps: true },
);

analysisSchema.index({ userId: 1, createdAt: -1 });

export type Analysis = InferSchemaType<typeof analysisSchema>;
export type AnalysisDocument = HydratedDocument<Analysis>;

export const AnalysisModel = model('Analysis', analysisSchema);

export function toPublicAnalysis(a: AnalysisDocument) {
  return {
    id: a._id.toString(),
    resumeId: a.resumeId.toString(),
    resumeTitle: a.resumeTitle,
    targetRole: a.targetRole ?? null,
    overallScore: a.overallScore,
    scores: a.scores,
    detectedRole: a.detectedRole,
    experienceLevel: a.experienceLevel,
    summary: a.summary,
    strengths: a.strengths,
    improvements: a.improvements,
    sections: a.sections,
    improvedBullets: a.improvedBullets,
    skills: a.skills,
    model: a.aiModel,
    createdAt: a.createdAt,
  };
}

export function toAnalysisSummary(a: AnalysisDocument) {
  return {
    id: a._id.toString(),
    resumeId: a.resumeId.toString(),
    resumeTitle: a.resumeTitle,
    targetRole: a.targetRole ?? null,
    overallScore: a.overallScore,
    detectedRole: a.detectedRole,
    createdAt: a.createdAt,
  };
}
