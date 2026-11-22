import { Schema, model } from 'mongoose';

/**
 * One-time tokens sent by email (confirm email address, reset password).
 * Only a SHA-256 hash is stored, so a database leak can't be used to take over accounts.
 */
const emailTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['verify_email', 'reset_password'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// MongoDB deletes expired tokens automatically.
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailTokenModel = model('EmailToken', emailTokenSchema);
