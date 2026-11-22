import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api';

/**
 * Puts the API's field errors (e.g. "email already taken") under the right inputs.
 * Returns a message for the banner at the top of the form, or null if every error
 * was attached to a field.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
): string | null {
  if (!(err instanceof ApiError)) {
    return "We couldn't reach Ribra. Check your connection and try again.";
  }

  if (err.code === 'EMAIL_TAKEN') {
    setError('email' as Path<T>, { message: err.message });
    return null;
  }

  if (err.code === 'VALIDATION_ERROR' && err.details.length > 0) {
    for (const detail of err.details) {
      setError(detail.field as Path<T>, { message: detail.message });
    }
    return null;
  }

  return err.message;
}
