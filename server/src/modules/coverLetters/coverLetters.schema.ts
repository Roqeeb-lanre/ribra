import { z } from 'zod';
import { COVER_LETTER_LENGTHS, COVER_LETTER_TONES } from '../../ai/prompts/coverLetter.js';

export const createCoverLetterSchema = z.object({
  jobMatchId: z.string().min(1, 'Choose a job match'),
  tone: z.enum(COVER_LETTER_TONES).default('professional'),
  length: z.enum(COVER_LETTER_LENGTHS).default('standard'),
  notes: z.string().trim().max(600, 'Keep your notes under 600 characters').optional().default(''),
});

export const updateCoverLetterSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Your letter can't be empty")
    .max(10_000, 'Keep your letter under 10,000 characters'),
});

export type CreateCoverLetterInput = z.infer<typeof createCoverLetterSchema>;
export type UpdateCoverLetterInput = z.infer<typeof updateCoverLetterSchema>;
