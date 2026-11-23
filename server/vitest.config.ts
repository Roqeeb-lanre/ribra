import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-validation-123',
      AI_API_KEY: 'test-key',
      AI_MODELS: 'model-a,model-b',
      FREE_CV_ANALYSES_PER_MONTH: '5',
      FREE_JOB_MATCHES_PER_MONTH: '5',
      FREE_COVER_LETTERS_PER_MONTH: '5',
      FREE_INTERVIEW_PREPS_PER_MONTH: '5',
      FREE_ANSWER_FEEDBACK_PER_MONTH: '30',
      PAYSTACK_SECRET_KEY: 'sk_test_ribra_tests',
      PAYSTACK_PLAN_CODE: 'PLN_test',
      PRO_PRICE_NGN: '5000',
      CRON_SECRET: 'test-cron-secret-that-is-long-enough',
    },
    // The first run downloads a MongoDB binary for the in-memory test database.
    hookTimeout: 120_000,
    testTimeout: 20_000,
  },
});
