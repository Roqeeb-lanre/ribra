import { readFileSync } from 'node:fs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { devOutbox } from '../src/modules/email/email.service.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { ResumeModel } from '../src/modules/resumes/resume.model.js';
import { SessionModel } from '../src/modules/auth/session.model.js';
import { PaymentModel } from '../src/modules/billing/payment.model.js';
import { signAccessToken } from '../src/modules/auth/tokens.js';
import { useTestDatabase } from './helpers/db.js';

// Never call the real Paystack.
const paystack = vi.hoisted(() => ({ disableSubscription: vi.fn() }));
vi.mock('../src/modules/billing/paystack.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/modules/billing/paystack.js')>()),
  ...paystack,
}));

useTestDatabase();

const app = createApp();
const cvFile = readFileSync(new URL('./fixtures/sample-cv.pdf', import.meta.url));
const PASSWORD = 'analytical1';

beforeEach(() => {
  paystack.disableSubscription.mockReset();
  devOutbox.length = 0;
});

/** Signs up in a cookie-keeping "browser". */
async function signUp() {
  const browser = request.agent(app);
  const email = `ada${Math.random()}@example.com`;
  const res = await browser
    .post('/api/v1/auth/register')
    .send({ name: 'Ada Okafor', email, password: PASSWORD });
  return {
    browser,
    email,
    userId: res.body.user.id as string,
    auth: `Bearer ${res.body.accessToken}`,
  };
}

/** Logs the same account in on a second "device". */
async function secondDevice(email: string) {
  const browser = request.agent(app);
  await browser.post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return browser;
}

describe('profile', () => {
  it('changes the name', async () => {
    const { browser, auth } = await signUp();
    const res = await browser
      .patch('/api/v1/auth/me')
      .set('Authorization', auth)
      .send({ name: 'Ada O.' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Ada O.');

    const bad = await browser
      .patch('/api/v1/auth/me')
      .set('Authorization', auth)
      .send({ name: 'A' });
    expect(bad.status).toBe(400);
  });
});

describe('password', () => {
  it('needs the current password', async () => {
    const { browser, auth } = await signUp();
    const res = await browser
      .post('/api/v1/auth/password')
      .set('Authorization', auth)
      .send({ currentPassword: 'wrong-one1', newPassword: 'brandnew22' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WRONG_PASSWORD');
  });

  it('changes it, keeps this device logged in and logs out the others', async () => {
    const { browser, email, auth } = await signUp();
    const other = await secondDevice(email);

    const res = await browser
      .post('/api/v1/auth/password')
      .set('Authorization', auth)
      .send({ currentPassword: PASSWORD, newPassword: 'brandnew22' });
    expect(res.status).toBe(200);

    expect((await browser.post('/api/v1/auth/refresh')).status).toBe(200);
    expect((await other.post('/api/v1/auth/refresh')).status).toBe(401);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'brandnew22' });
    expect(newLogin.status).toBe(200);

    expect(
      devOutbox.some((m) => m.to.email === email && /password was changed/i.test(m.subject)),
    ).toBe(true);
  });

  it('lets a Google-only account set its first password', async () => {
    const user = await UserModel.create({
      name: 'Bola Ade',
      email: 'bola@example.com',
      googleId: 'google-123',
      emailVerified: true,
    });
    const auth = `Bearer ${signAccessToken({ userId: user.id, role: 'user' })}`;

    const res = await request(app)
      .post('/api/v1/auth/password')
      .set('Authorization', auth)
      .send({ newPassword: 'firstpass1' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ hasPassword: true, googleLinked: true });
  });
});

describe('sessions', () => {
  it('lists devices, marks this one, and signs out the rest', async () => {
    const { browser, email, auth } = await signUp();
    const other = await secondDevice(email);

    const list = await browser.get('/api/v1/auth/sessions').set('Authorization', auth);
    expect(list.body.sessions).toHaveLength(2);
    expect(list.body.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);

    const out = await browser
      .post('/api/v1/auth/sessions/sign-out-others')
      .set('Authorization', auth);
    expect(out.body.signedOut).toBe(1);
    expect((await other.post('/api/v1/auth/refresh')).status).toBe(401);
    expect((await browser.post('/api/v1/auth/refresh')).status).toBe(200);
  });
});

describe('export', () => {
  it('downloads everything as JSON', async () => {
    const { browser, auth, email } = await signUp();
    await browser
      .post('/api/v1/resumes')
      .set('Authorization', auth)
      .attach('file', cvFile, 'cv.pdf');
    await browser
      .post('/api/v1/applications')
      .set('Authorization', auth)
      .send({ company: 'Paystack', role: 'Engineer' });

    const res = await browser.get('/api/v1/auth/me/export').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.account.email).toBe(email);
    expect(res.body.cvs).toHaveLength(1);
    expect(res.body.cvs[0].text).toContain('Ada Okafor');
    expect(res.body.applications[0].company).toBe('Paystack');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

describe('deleting the account', () => {
  it('needs the right password', async () => {
    const { browser, auth } = await signUp();
    const res = await browser
      .delete('/api/v1/auth/me')
      .set('Authorization', auth)
      .send({ password: 'not-it-123' });
    expect(res.status).toBe(400);
  });

  it('deletes the user and their data, and cancels an active subscription first', async () => {
    const { browser, email, auth, userId } = await signUp();
    await browser
      .post('/api/v1/resumes')
      .set('Authorization', auth)
      .attach('file', cvFile, 'cv.pdf');
    await UserModel.updateOne(
      { _id: userId },
      {
        plan: 'pro',
        proUntil: new Date(Date.now() + 86_400_000),
        billing: { subscriptionCode: 'SUB_1', emailToken: 'tok_1', status: 'active' },
      },
    );
    await PaymentModel.create({
      userId,
      reference: 'ref_keep',
      amount: 500_000,
      currency: 'NGN',
      paidAt: new Date(),
    });
    paystack.disableSubscription.mockResolvedValue({});

    const res = await browser
      .delete('/api/v1/auth/me')
      .set('Authorization', auth)
      .send({ password: PASSWORD });
    expect(res.status).toBe(204);
    expect(paystack.disableSubscription).toHaveBeenCalledWith('SUB_1', 'tok_1');

    expect(await UserModel.countDocuments({ _id: userId })).toBe(0);
    expect(await ResumeModel.countDocuments({ userId })).toBe(0);
    expect(await SessionModel.countDocuments({ userId })).toBe(0);
    // Payment records stay for accounting.
    expect(await PaymentModel.countDocuments({ reference: 'ref_keep' })).toBe(1);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(401);
  });

  it('keeps the account if Paystack cannot cancel the subscription', async () => {
    const { browser, auth, userId } = await signUp();
    await UserModel.updateOne(
      { _id: userId },
      { billing: { subscriptionCode: 'SUB_2', emailToken: 'tok_2', status: 'active' } },
    );
    paystack.disableSubscription.mockRejectedValue(new Error('Paystack down'));

    const res = await browser
      .delete('/api/v1/auth/me')
      .set('Authorization', auth)
      .send({ password: PASSWORD });
    expect(res.status).toBe(500);
    expect(await UserModel.countDocuments({ _id: userId })).toBe(1);
  });

  it('lets a Google-only account confirm by typing its email', async () => {
    const user = await UserModel.create({
      name: 'Bola Ade',
      email: 'bola2@example.com',
      googleId: 'g-2',
    });
    const auth = `Bearer ${signAccessToken({ userId: user.id, role: 'user' })}`;

    const wrong = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', auth)
      .send({ confirmEmail: 'x@y.com' });
    expect(wrong.status).toBe(400);
    const ok = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', auth)
      .send({ confirmEmail: 'Bola2@Example.com' });
    expect(ok.status).toBe(204);
  });
});
