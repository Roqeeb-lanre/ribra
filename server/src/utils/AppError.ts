/**
 * An error we expect and want to show to the user (bad input, not found, no permission...).
 * Anything that is NOT an AppError is treated as a bug and hidden behind a generic 500.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = 'APP_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}
