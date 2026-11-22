import { z } from 'zod';
import { APPLICATION_STATUSES } from './application.model.js';

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

/** A date as "2026-12-02" or a full ISO string. null clears it. */
const dateField = z
  .union([
    z.null(),
    z
      .string()
      .trim()
      .refine((s) => s !== '' && !Number.isNaN(Date.parse(s)), 'Enter a valid date'),
  ])
  .transform((v) => (v === null ? null : new Date(v)));

/** Only real web links, so nobody can save a "javascript:" link that runs code when clicked. */
const jobUrl = z
  .string()
  .trim()
  .max(2000, 'That link is too long')
  .refine(
    (s) => s === '' || (/^https?:\/\//i.test(s) && URL.canParse(s)),
    'Enter a full link starting with https://',
  );

const fields = z.object({
  company: text(120, 'Company').min(1, 'Enter the company name'),
  role: text(160, 'Job title').min(1, 'Enter the job title'),
  status: z.enum(APPLICATION_STATUSES, { error: 'Choose a valid status' }),
  location: text(120, 'Location'),
  jobUrl,
  salary: text(80, 'Salary'),
  notes: text(5000, 'Notes'),
  appliedAt: dateField,
  nextStep: text(160, 'Next step'),
  nextStepAt: dateField,
});

export const createApplicationSchema = fields.partial().extend({
  company: fields.shape.company,
  role: fields.shape.role,
  status: fields.shape.status.default('saved'),
});

export const updateApplicationSchema = fields
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
