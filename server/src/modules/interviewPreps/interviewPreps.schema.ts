import { z } from 'zod';

export const createInterviewPrepSchema = z.object({
  jobMatchId: z.string().min(1, 'Choose a job match'),
});

export const answerSchema = z.object({
  answer: z
    .string()
    .trim()
    .min(40, 'Write a bit more: a real answer is at least a few sentences')
    .max(4000, 'Keep your answer under 4,000 characters'),
});

export type CreateInterviewPrepInput = z.infer<typeof createInterviewPrepSchema>;
export type AnswerInput = z.infer<typeof answerSchema>;
