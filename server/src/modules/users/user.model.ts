import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never returned by queries unless explicitly asked for with .select('+passwordHash').
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    emailVerified: { type: Boolean, default: false, required: true },
    avatarUrl: { type: String },
    plan: { type: String, enum: ['free', 'pro'], default: 'free', required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;
export type UserRole = User['role'];

export const UserModel = model('User', userSchema);

/** The only shape of a user that ever leaves the API. */
export function toPublicUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl ?? null,
    plan: user.plan,
    createdAt: user.createdAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
