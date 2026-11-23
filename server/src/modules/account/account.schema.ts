import { z } from 'zod';
import { passwordSchema } from '../auth/auth.schema.js';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long'),
    emailReminders: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const changePasswordSchema = z.object({
  // Not needed when a Google-only account sets its first password.
  currentPassword: z.string().max(200).optional(),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  // Accounts with a password confirm with it; Google-only accounts type their email instead.
  password: z.string().max(200).optional(),
  confirmEmail: z.string().trim().toLowerCase().max(254).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
