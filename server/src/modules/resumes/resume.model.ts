import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * A CV the user uploaded. We keep only the extracted text (not the original file):
 * that's all the AI needs, and it means no file storage service is required.
 */
const resumeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'docx', 'txt'], required: true },
    fileSize: { type: Number, required: true },
    text: { type: String, required: true },
    wordCount: { type: Number, required: true },
  },
  { timestamps: true },
);

export type Resume = InferSchemaType<typeof resumeSchema>;
export type ResumeDocument = HydratedDocument<Resume>;

export const ResumeModel = model('Resume', resumeSchema);

export function toPublicResume(resume: ResumeDocument, latestScore: number | null = null) {
  return {
    id: resume._id.toString(),
    title: resume.title,
    fileName: resume.fileName,
    fileType: resume.fileType,
    fileSize: resume.fileSize,
    wordCount: resume.wordCount,
    latestScore,
    createdAt: resume.createdAt,
  };
}
