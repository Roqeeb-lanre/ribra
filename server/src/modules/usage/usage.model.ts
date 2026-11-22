import { Schema, model } from 'mongoose';

/**
 * One document per user per month, counting AI feature use.
 * This is the single source of truth for plan limits and AI cost tracking.
 */
const usageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    period: { type: String, required: true }, // "2026-11"
    counts: {
      cvAnalysis: { type: Number },
      jobMatch: { type: Number },
    },
    tokens: { type: Number },
  },
  { timestamps: true },
);

usageSchema.index({ userId: 1, period: 1 }, { unique: true });

export const UsageModel = model('Usage', usageSchema);
