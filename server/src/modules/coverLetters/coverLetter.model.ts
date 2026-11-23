import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { COVER_LETTER_LENGTHS, COVER_LETTER_TONES } from '../../ai/prompts/coverLetter.js';

/** One cover letter per job match. Writing it again replaces it. */
const coverLetterSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobMatchId: { type: Schema.Types.ObjectId, ref: 'JobMatch', required: true },
    jobTitle: { type: String, required: true },
    company: { type: String, default: null },

    tone: { type: String, enum: COVER_LETTER_TONES, required: true },
    length: { type: String, enum: COVER_LETTER_LENGTHS, required: true },
    notes: { type: String, default: '' },

    content: { type: String, required: true },
    // True once the user has changed the AI's text, so we can warn before replacing it.
    edited: { type: Boolean, default: false },

    aiModel: { type: String, required: true },
    promptVersion: { type: String, required: true },
    totalTokens: { type: Number },
    durationMs: { type: Number },
  },
  { timestamps: true },
);

coverLetterSchema.index({ userId: 1, jobMatchId: 1 }, { unique: true });
coverLetterSchema.index({ userId: 1, updatedAt: -1 });

export type CoverLetterDocument = HydratedDocument<InferSchemaType<typeof coverLetterSchema>>;

export const CoverLetterModel = model('CoverLetter', coverLetterSchema);

export function toPublicCoverLetter(c: CoverLetterDocument) {
  return {
    id: c._id.toString(),
    jobMatchId: c.jobMatchId.toString(),
    jobTitle: c.jobTitle,
    company: c.company ?? null,
    tone: c.tone,
    length: c.length,
    notes: c.notes ?? '',
    content: c.content,
    edited: c.edited,
    model: c.aiModel,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
