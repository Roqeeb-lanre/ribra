import { z } from 'zod';

// Same rules as the API (server/src/modules/auth/auth.schema.ts), so users see errors instantly.

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email')
  .pipe(z.email('Enter a valid email address'));

export const passwordRules = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'At least one letter', test: (v: string) => /[A-Za-z]/.test(v) },
  { label: 'At least one number', test: (v: string) => /[0-9]/.test(v) },
] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long'),
  email,
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(72, 'Use 72 characters or fewer')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export type RegisterValues = z.infer<typeof registerSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
