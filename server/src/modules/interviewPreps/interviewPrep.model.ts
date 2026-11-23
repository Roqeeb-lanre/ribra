import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { QUESTION_CATEGORIES } from '../../ai/prompts/interviewPrep.js';

const feedbackSchema = new Schema(
  {
    score: { type: Number, min: 1, max: 10, required: true },
    summary: { type: String, required: true },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    improvedAnswer: { type: String, required: true },
    aiModel: { type: String },
    promptVersion: { type: String },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const questionSchema = new Schema({
  category: { type: String, enum: QUESTION_CATEGORIES, required: true },
  question: { type: String, required: true },
  whyTheyAsk: { type: String, required: true },
  howToAnswer: { type: String, required: true },
  cvPoints: { type: [String], default: [] },
  // The user's latest practice answer and the AI's review of it.
  answer: { type: String, default: '' },
  feedback: { type: feedbackSchema, default: null },
});

/** Practice questions for one job match. Generating again replaces them. */
const interviewPrepSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobMatchId: { type: Schema.Types.ObjectId, ref: 'JobMatch', required: true },
    jobTitle: { type: String, required: true },
    company: { type: String, default: null },
    questions: { type: [questionSchema], default: [] },

    aiModel: { type: String, required: true },
    promptVersion: { type: String, required: true },
    totalTokens: { type: Number },
    durationMs: { type: Number },
  },
  { timestamps: true },
);

interviewPrepSchema.index({ userId: 1, jobMatchId: 1 }, { unique: true });
interviewPrepSchema.index({ userId: 1, updatedAt: -1 });

export type InterviewPrepDocument = HydratedDocument<InferSchemaType<typeof interviewPrepSchema>>;

export const InterviewPrepModel = model('InterviewPrep', interviewPrepSchema);

export function toPublicInterviewPrep(p: InterviewPrepDocument) {
  return {
    id: p._id.toString(),
    jobMatchId: p.jobMatchId.toString(),
    jobTitle: p.jobTitle,
    company: p.company ?? null,
    questions: p.questions.map((q) => ({
      id: q._id.toString(),
      category: q.category,
      question: q.question,
      whyTheyAsk: q.whyTheyAsk,
      howToAnswer: q.howToAnswer,
      cvPoints: q.cvPoints,
      answer: q.answer ?? '',
      feedback: q.feedback
        ? {
            score: q.feedback.score,
            summary: q.feedback.summary,
            strengths: q.feedback.strengths,
            improvements: q.feedback.improvements,
            improvedAnswer: q.feedback.improvedAnswer,
            at: q.feedback.at,
          }
        : null,
    })),
    model: p.aiModel,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function toInterviewPrepSummary(p: InterviewPrepDocument) {
  return {
    id: p._id.toString(),
    jobMatchId: p.jobMatchId.toString(),
    jobTitle: p.jobTitle,
    company: p.company ?? null,
    questionCount: p.questions.length,
    practisedCount: p.questions.filter((q) => q.feedback).length,
    updatedAt: p.updatedAt,
  };
}
