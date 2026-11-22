import { z } from 'zod';

export const createJobMatchSchema = z.object({
  resumeId: z.string().min(1, 'Choose a CV'),
  jobDescription: z
    .string()
    .trim()
    .min(150, 'Paste the full job description (at least a few paragraphs)')
    .max(15_000, 'That job description is too long. Keep it under 15,000 characters.'),
  jobTitle: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
});

export type CreateJobMatchInput = z.infer<typeof createJobMatchSchema>;
