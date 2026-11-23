import crypto from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { PaymentModel } from '../src/modules/billing/payment.model.js';
import { useTestDatabase } from './helpers/db.js';

// Fake Paystack API calls, but keep the real signature check.
const paystack = vi.hoisted(() => ({
  initializeTransaction: vi.fn(),
  verifyTransaction: vi.fn(),
  disableSubscription: vi.fn(),
  getSubscriptionManageLink: vi.fn(),
}));
vi.mock('../src/modules/billing/paystack.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/modules/billing/paystack.js')>()),
  ...paystack,
}));

useTestDatabase();

const app = createApp();
const SECRET = 'sk_test_ribra_tests'; // from vitest.config.ts
const PLAN = 'PLN_test';

beforeEach(() => {
  Object.values(paystack).forEach((fn) => fn.mockReset());
});

async function signUp() {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Ada Okafor',
      email: `ada${Math.random()}@example.com`,
      password: 'analytical1',
    });
  return {
    auth: `Bearer ${res.body.accessToken}`,
    userId: res.body.user.id as string,
    email: res.body.user.email as string,
  };
}

function sendWebhook(payload: object, signature?: string) {
  const body = JSON.stringify(payload);
  const sig = signature ?? crypto.createHmac('sha512', SECRET).update(body).digest('hex');
  return request(app)
    .post('/api/v1/billing/paystack/webhook')
    .set('Content-Type', 'application/json')
    .set('x-paystack-signature', sig)
    .send(body);
}

const charge = (userId: string, email: string, overrides: object = {}) => ({
  reference: `ref_${Math.random().toString(36).slice(2)}`,
  status: 'success',
  amount: 500_000,
  currency: 'NGN',
  paid_at: new Date().toISOString(),
  customer: { customer_code: `CUS_${userId}`, email },
  plan: { plan_code: PLAN },
  metadata: { userId },
  ...overrides,
});

describe('Paystack webhook', () => {
  it('rejects requests without a valid signature', async () => {
    const res = await sendWebhook({ event: 'charge.success', data: {} }, 'not-a-real-signature');
    expect(res.status).toBe(401);
  });

  it('upgrades the user to Pro once per payment, even if the event arrives twice', async () => {
    const { auth, userId, email } = await signUp();
    const data = charge(userId, email);

    expect((await sendWebhook({ event: 'charge.success', data })).status).toBe(200);
    expect((await sendWebhook({ event: 'charge.success', data })).status).toBe(200);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', auth);
    expect(me.body.user.plan).toBe('pro');
    expect(await PaymentModel.countDocuments({ userId })).toBe(1);

    // About one month plus the grace days.
    const days = (Date.parse(me.body.user.proUntil) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(30);
    expect(days).toBeLessThan(35);

    const usage = await request(app).get('/api/v1/usage').set('Authorization', auth);
    expect(usage.body.usage.plan).toBe('pro');
    expect(usage.body.usage.cvAnalysis.limit).toBe(50);
    expect(usage.body.usage.answerFeedback.limit).toBe(300);
  });

  it('ignores payments for another plan or a smaller amount', async () => {
    const { auth, userId, email } = await signUp();
    await sendWebhook({
      event: 'charge.success',
      data: charge(userId, email, { plan: { plan_code: 'PLN_other' } }),
    });
    await sendWebhook({ event: 'charge.success', data: charge(userId, email, { amount: 100 }) });

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', auth);
    expect(me.body.user.plan).toBe('free');
  });

  it('stores the subscription, then cancels it through Paystack', async () => {
    const { auth, userId, email } = await signUp();
    await sendWebhook({ event: 'charge.success', data: charge(userId, email) });
    const nextPayment = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await sendWebhook({
      event: 'subscription.create',
      data: {
        subscription_code: 'SUB_123',
        email_token: 'tok_secret',
        status: 'active',
        next_payment_date: nextPayment,
        customer: { customer_code: `CUS_${userId}`, email },
        plan: { plan_code: PLAN },
      },
    });

    const before = await request(app).get('/api/v1/billing').set('Authorization', auth);
    expect(before.body.billing).toMatchObject({ plan: 'pro', status: 'active', canCancel: true });
    // The token Paystack needs to cancel is never sent to the browser.
    expect(JSON.stringify(before.body)).not.toContain('tok_secret');

    paystack.disableSubscription.mockResolvedValue({});
    const cancelled = await request(app).post('/api/v1/billing/cancel').set('Authorization', auth);
    expect(cancelled.status).toBe(200);
    expect(paystack.disableSubscription).toHaveBeenCalledWith('SUB_123', 'tok_secret');
    expect(cancelled.body.billing).toMatchObject({
      plan: 'pro',
      status: 'cancelled',
      canCancel: false,
    });
    // Pro stays until the paid month ends.
    expect(Date.parse(cancelled.body.billing.proUntil)).toBe(Date.parse(nextPayment));
  });

  it('marks the subscription non-renewing when cancelled on Paystack', async () => {
    const { auth, userId, email } = await signUp();
    await sendWebhook({ event: 'charge.success', data: charge(userId, email) });
    await sendWebhook({
      event: 'subscription.not_renew',
      data: {
        subscription_code: 'SUB_9',
        status: 'non-renewing',
        customer: { customer_code: `CUS_${userId}`, email },
        plan: { plan_code: PLAN },
      },
    });
    const billing = await request(app).get('/api/v1/billing').set('Authorization', auth);
    expect(billing.body.billing).toMatchObject({ plan: 'pro', status: 'non-renewing' });
  });
});

describe('checkout', () => {
  it('starts a Paystack checkout for the Pro plan', async () => {
    const { auth, userId, email } = await signUp();
    paystack.initializeTransaction.mockResolvedValue({
      authorization_url: 'https://checkout.paystack.com/abc',
      reference: 'ref_1',
    });

    const res = await request(app).post('/api/v1/billing/checkout').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.paystack.com/abc');
    expect(paystack.initializeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        email,
        amountKobo: 500_000,
        planCode: PLAN,
        metadata: expect.objectContaining({ userId }),
      }),
    );
  });

  it('verifies the payment after the redirect', async () => {
    const { auth, userId, email } = await signUp();
    paystack.verifyTransaction.mockResolvedValue(charge(userId, email, { reference: 'ref_ok' }));

    const res = await request(app).get('/api/v1/billing/verify/ref_ok').set('Authorization', auth);
    expect(res.body).toEqual({ ok: true });
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', auth);
    expect(me.body.user.plan).toBe('pro');
  });

  it("won't apply someone else's payment to your account", async () => {
    const ada = await signUp();
    const bola = await signUp();
    paystack.verifyTransaction.mockResolvedValue(charge(ada.userId, ada.email));

    const res = await request(app)
      .get('/api/v1/billing/verify/ref_x')
      .set('Authorization', bola.auth);
    expect(res.status).toBe(403);
  });

  it('reports an unpaid checkout', async () => {
    const { auth, userId, email } = await signUp();
    paystack.verifyTransaction.mockResolvedValue(charge(userId, email, { status: 'abandoned' }));
    const res = await request(app).get('/api/v1/billing/verify/ref_y').set('Authorization', auth);
    expect(res.body.ok).toBe(false);
  });
});

describe('Pro expiry', () => {
  it('falls back to free once Pro runs out', async () => {
    const { auth, userId } = await signUp();
    await UserModel.updateOne(
      { _id: userId },
      { plan: 'pro', proUntil: new Date(Date.now() - 60_000) },
    );
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', auth);
    expect(me.body.user.plan).toBe('free');
    const usage = await request(app).get('/api/v1/usage').set('Authorization', auth);
    expect(usage.body.usage.cvAnalysis.limit).toBe(5);
  });
});
