import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** One comparison of one CV against one job description. */
const jobMatchSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true },
    resumeTitle: { type: String, required: true },

    jobTitle: { type: String, required: true },
    company: { type: String },
    seniority: { type: String },
    jobDescription: { type: String, required: true },
    // Hash of CV + job text: the same comparison is reused instead of calling the AI again.
    inputHash: { type: String, required: true },

    matchScore: { type: Number, min: 0, max: 100, required: true },
    fitScore: { type: Number, min: 0, max: 100, required: true },
    keywordCoverage: { type: Number, min: 0, max: 100, required: true },
    keywords: {
      type: [{ _id: false, keyword: String, importance: String, found: Boolean }],
      default: [],
    },
    verdict: { type: String, required: true },
    strengths: { type: [String], default: [] },
    gaps: { type: [String], default: [] },
    tailoringTips: { type: [{ _id: false, section: String, tip: String }], default: [] },
    suggestedSummary: { type: String },

    aiModel: { type: String, required: true },
    promptVersion: { type: String, required: true },
    totalTokens: { type: Number },
    durationMs: { type: Number },
  },
  { timestamps: true },
);

jobMatchSchema.index({ userId: 1, createdAt: -1 });
jobMatchSchema.index({ userId: 1, inputHash: 1 });

export type JobMatch = InferSchemaType<typeof jobMatchSchema>;
export type JobMatchDocument = HydratedDocument<JobMatch>;

export const JobMatchModel = model('JobMatch', jobMatchSchema);

export function toPublicJobMatch(m: JobMatchDocument) {
  return {
    id: m._id.toString(),
    resumeId: m.resumeId.toString(),
    resumeTitle: m.resumeTitle,
    jobTitle: m.jobTitle,
    company: m.company || null,
    seniority: m.seniority ?? null,
    jobDescription: m.jobDescription,
    matchScore: m.matchScore,
    fitScore: m.fitScore,
    keywordCoverage: m.keywordCoverage,
    keywords: m.keywords,
    verdict: m.verdict,
    strengths: m.strengths,
    gaps: m.gaps,
    tailoringTips: m.tailoringTips,
    suggestedSummary: m.suggestedSummary ?? '',
    model: m.aiModel,
    createdAt: m.createdAt,
  };
}

export function toJobMatchSummary(m: JobMatchDocument) {
  return {
    id: m._id.toString(),
    resumeId: m.resumeId.toString(),
    resumeTitle: m.resumeTitle,
    jobTitle: m.jobTitle,
    company: m.company || null,
    matchScore: m.matchScore,
    createdAt: m.createdAt,
  };
}
