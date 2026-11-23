import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';

/**
 * A tiny client for the few Paystack endpoints Ribra uses.
 * The secret key only ever lives on the server.
 */
const BASE_URL = 'https://api.paystack.co';

export function paystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY && env.PAYSTACK_PLAN_CODE);
}

function requireKey(): string {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new AppError(503, 'Payments are not set up yet.', 'PAYMENTS_NOT_CONFIGURED');
  }
  return env.PAYSTACK_SECRET_KEY;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${requireKey()}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err, path }, 'Paystack request failed');
    throw new AppError(
      502,
      "We couldn't reach Paystack. Please try again.",
      'PAYSTACK_UNREACHABLE',
    );
  }

  const json = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: T;
  } | null;
  if (!res.ok || !json?.status) {
    logger.warn(
      { path, status: res.status, message: json?.message },
      'Paystack rejected a request',
    );
    throw new AppError(
      502,
      json?.message ? `Paystack: ${json.message}` : 'Paystack returned an error.',
      'PAYSTACK_ERROR',
    );
  }
  return json.data as T;
}

export type PaystackPlan = { plan_code: string; name?: string; amount?: number; interval?: string };
export type PaystackCustomer = { customer_code: string; email: string };

/** The parts of a transaction Ribra reads (from verify, or a charge.success webhook). */
export type PaystackTransaction = {
  reference: string;
  status: string; // "success" when paid
  amount: number; // in kobo
  currency: string;
  paid_at?: string | null;
  paidAt?: string | null;
  customer: PaystackCustomer;
  plan?: PaystackPlan | string | null;
  metadata?: { userId?: string } | string | null;
};

export function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  planCode: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  return call<{ authorization_url: string; reference: string }>('POST', '/transaction/initialize', {
    email: input.email,
    amount: input.amountKobo,
    plan: input.planCode,
    callback_url: input.callbackUrl,
    metadata: input.metadata,
  });
}

export function verifyTransaction(reference: string) {
  return call<PaystackTransaction>('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
}

export function getSubscriptionManageLink(subscriptionCode: string) {
  return call<{ link: string }>(
    'GET',
    `/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`,
  );
}

export function disableSubscription(subscriptionCode: string, emailToken: string) {
  return call<unknown>('POST', '/subscription/disable', {
    code: subscriptionCode,
    token: emailToken,
  });
}

export function createPlan(input: { name: string; amountKobo: number }) {
  return call<PaystackPlan>('POST', '/plan', {
    name: input.name,
    amount: input.amountKobo,
    interval: 'monthly',
    currency: 'NGN',
  });
}

/**
 * Paystack signs every webhook with HMAC-SHA512 of the raw body, using our secret key.
 * Anything without a valid signature is rejected.
 */
export function isValidSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.PAYSTACK_SECRET_KEY || !signature) return false;
  const expected = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
