import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One document per logged-in device. The refresh token itself is never stored,
 * only its SHA-256 hash, so a database leak does not leak usable tokens.
 */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String },
    ip: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// MongoDB deletes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Session = InferSchemaType<typeof sessionSchema>;

export const SessionModel = model('Session', sessionSchema);
