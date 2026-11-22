import { z } from 'zod';
import { STATUSES } from './types';

/** Same rules as the server, so mistakes show up before saving. */
export const applicationFormSchema = z.object({
  company: z
    .string()
    .trim()
    .min(1, 'Enter the company name')
    .max(120, 'Keep it under 120 characters'),
  role: z.string().trim().min(1, 'Enter the job title').max(160, 'Keep it under 160 characters'),
  status: z.enum(STATUSES),
  location: z.string().trim().max(120, 'Keep it under 120 characters'),
  jobUrl: z
    .string()
    .trim()
    .max(2000, 'That link is too long')
    .refine(
      (s) => s === '' || (/^https?:\/\//i.test(s) && URL.canParse(s)),
      'Enter a full link starting with https://',
    ),
  salary: z.string().trim().max(80, 'Keep it under 80 characters'),
  notes: z.string().max(5000, 'Keep notes under 5,000 characters'),
  appliedAt: z.string(),
  nextStep: z.string().trim().max(160, 'Keep it under 160 characters'),
  nextStepAt: z.string(),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;
