import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** The columns of the tracker board, in order. */
export const APPLICATION_STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** One job the user is tracking, from "saved" to an offer or a rejection. */
const applicationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    company: { type: String, required: true },
    role: { type: String, required: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'saved', required: true },
    location: { type: String, default: '' },
    jobUrl: { type: String, default: '' },
    salary: { type: String, default: '' },
    notes: { type: String, default: '' },

    appliedAt: { type: Date, default: null },
    // The next thing to do and when, e.g. "Technical interview" on 2 Dec.
    nextStep: { type: String, default: '' },
    nextStepAt: { type: Date, default: null },

    // Set when the job was added from a Job Match report.
    jobMatchId: { type: Schema.Types.ObjectId, ref: 'JobMatch', default: null },
    matchScore: { type: Number, min: 0, max: 100, default: null },

    // Every status change, so the timeline can be shown later.
    history: {
      type: [{ _id: false, status: { type: String, enum: APPLICATION_STATUSES }, at: Date }],
      default: [],
    },
  },
  { timestamps: true },
);

applicationSchema.index({ userId: 1, updatedAt: -1 });
// A job match can be tracked only once per user.
applicationSchema.index(
  { userId: 1, jobMatchId: 1 },
  { unique: true, partialFilterExpression: { jobMatchId: { $type: 'objectId' } } },
);

export type Application = InferSchemaType<typeof applicationSchema>;
export type ApplicationDocument = HydratedDocument<Application>;

export const ApplicationModel = model('Application', applicationSchema);

export function toPublicApplication(a: ApplicationDocument) {
  return {
    id: a._id.toString(),
    company: a.company,
    role: a.role,
    status: a.status as ApplicationStatus,
    location: a.location ?? '',
    jobUrl: a.jobUrl ?? '',
    salary: a.salary ?? '',
    notes: a.notes ?? '',
    appliedAt: a.appliedAt ?? null,
    nextStep: a.nextStep ?? '',
    nextStepAt: a.nextStepAt ?? null,
    jobMatchId: a.jobMatchId ? a.jobMatchId.toString() : null,
    matchScore: a.matchScore ?? null,
    history: a.history.map((h) => ({ status: h.status as ApplicationStatus, at: h.at })),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
