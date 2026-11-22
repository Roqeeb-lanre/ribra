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

  // AI provider (any OpenAI-compatible API). Defaults to Google Gemini's free tier.
  AI_API_KEY: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  AI_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta/openai/'),
  // Tried in order: if one model is busy or out of free quota, the next one is used.
  AI_MODELS: z
    .string()
    .default(
      'gemini-3-flash-preview,gemini-3.1-flash-lite,gemini-flash-lite-latest,gemini-flash-latest',
    ),
  AI_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(90),

  // The website's public address, used in email links. Defaults to the first CLIENT_URL.
  APP_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),

  // Emails are sent with Brevo's HTTP API (Render's free plan blocks SMTP ports).
  // Without BREVO_API_KEY, emails are printed to the server log instead (fine for local development).
  BREVO_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  EMAIL_FROM_ADDRESS: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().email().optional(),
  ),
  EMAIL_FROM_NAME: z.string().default('Ribra'),

  // "Sign in with Google" (OAuth client ID from Google Cloud). Optional: the button is hidden without it.
  GOOGLE_CLIENT_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),

  // Plan limits
  FREE_CV_ANALYSES_PER_MONTH: z.coerce.number().int().nonnegative().default(5),
  FREE_JOB_MATCHES_PER_MONTH: z.coerce.number().int().nonnegative().default(5),
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
  appUrl: (data.APP_URL ?? data.CLIENT_URL.split(',')[0]!.trim()).replace(/\/$/, ''),
  aiModels: data.AI_MODELS.split(',')
    .map((m) => m.trim())
    .filter(Boolean),
  aiBaseUrl: data.AI_BASE_URL.endsWith('/') ? data.AI_BASE_URL : `${data.AI_BASE_URL}/`,
  jwtAccessSecret:
    data.JWT_ACCESS_SECRET ?? 'ribra-local-development-secret-do-not-use-in-production',
};
