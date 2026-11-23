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
    // Set when the user signs in with Google. Sparse: only users who did have one.
    googleId: { type: String, unique: true, sparse: true },
    plan: { type: String, enum: ['free', 'pro'], default: 'free', required: true },
    // Pro lasts until this moment (end of the paid month plus a few days' grace for renewals).
    proUntil: { type: Date, default: null },
    billing: {
      customerCode: { type: String },
      subscriptionCode: { type: String },
      // Paystack needs this together with the subscription code to cancel it.
      emailToken: { type: String, select: false },
      // active | non-renewing | attention | cancelled | completed (Paystack's subscription status)
      status: { type: String },
      nextPaymentAt: { type: Date },
    },
    // Daily email about tracker next steps due today or tomorrow. Users can switch it off.
    emailReminders: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;
export type UserRole = User['role'];

export const UserModel = model('User', userSchema);

export type Plan = 'free' | 'pro';

/** The plan the user really has right now: Pro only counts until it runs out. */
export function currentPlan(user: { plan?: string | null; proUntil?: Date | null }): Plan {
  return user.plan === 'pro' && user.proUntil && user.proUntil.getTime() > Date.now()
    ? 'pro'
    : 'free';
}

/** The only shape of a user that ever leaves the API. */
export function toPublicUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl ?? null,
    plan: currentPlan(user),
    proUntil: currentPlan(user) === 'pro' ? user.proUntil : null,
    hasPassword: Boolean(user.passwordHash),
    googleLinked: Boolean(user.googleId),
    emailReminders: user.emailReminders !== false,
    createdAt: user.createdAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
