import { z } from 'zod';

/**
 * Every environment variable the API needs, validated once at startup.
 * If something is missing or wrong, the server refuses to start and says why,
 * instead of failing later in a confusing way.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().optional(),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  // Signs the short-lived access tokens. Use a long random string (48+ characters).
  JWT_ACCESS_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value), // an empty line in .env counts as "not set"
    z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters').optional(),
  ),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.treeifyError(parsed.error));
  process.exit(1);
}

const data = parsed.data;
const isProduction = data.NODE_ENV === 'production';

if (isProduction && !data.JWT_ACCESS_SECRET) {
  console.error('JWT_ACCESS_SECRET is required in production.');
  process.exit(1);
}

export const env = {
  ...data,
  isProduction,
  isTest: data.NODE_ENV === 'test',
  clientOrigins: data.CLIENT_URL.split(',').map((url) => url.trim()),
  // Local development falls back to a fixed secret so the app runs without extra setup.
  jwtAccessSecret:
    data.JWT_ACCESS_SECRET ?? 'ribra-local-development-secret-do-not-use-in-production',
};
