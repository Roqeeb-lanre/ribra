import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { devOutbox } from '../src/modules/email/email.service.js';
import { UserModel } from '../src/modules/users/user.model.js';
import {
  startOfToday,
  unsubscribeToken,
  userIdFromUnsubscribeToken,
} from '../src/modules/reminders/reminders.service.js';
import { useTestDatabase } from './helpers/db.js';

useTestDatabase();

const app = createApp();
const SECRET = 'test-cron-secret-that-is-long-enough'; // from vitest.config.ts
const DAY = 86_400_000;

beforeEach(() => {
  devOutbox.length = 0;
});

const ymd = (offsetDays: number) =>
  new Date(startOfToday().getTime() + offsetDays * DAY).toISOString().slice(0, 10);

const runReminders = (secret = SECRET) =>
  request(app).post('/api/v1/internal/reminders').set('x-cron-secret', secret);

async function signUp({ verified = true } = {}) {
  const email = `ada${Math.random()}@example.com`;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Ada Okafor', email, password: 'analytical1' });
  if (verified) await UserModel.updateOne({ email }, { emailVerified: true });
  devOutbox.length = 0; // forget the sign-up confirmation email
  return { email, userId: res.body.user.id as string, auth: `Bearer ${res.body.accessToken}` };
}

const addJob = (auth: string, body: object) =>
  request(app).post('/api/v1/applications').set('Authorization', auth).send(body);

describe('calendar days', () => {
  it("uses the reminder time zone's date", () => {
    const lateEveningUtc = new Date('2026-12-01T23:30:00Z'); // already 2 Dec in Lagos
    expect(startOfToday(lateEveningUtc, 'Africa/Lagos').toISOString()).toBe(
      '2026-12-02T00:00:00.000Z',
    );
    expect(startOfToday(lateEveningUtc, 'UTC').toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('unsubscribe tokens', () => {
  it('only accepts untampered tokens', () => {
    const id = '64b7f0c2a1b2c3d4e5f60718';
    const token = unsubscribeToken(id);
    expect(userIdFromUnsubscribeToken(token)).toBe(id);
    expect(userIdFromUnsubscribeToken(token.replace(id, '64b7f0c2a1b2c3d4e5f60719'))).toBeNull();
    expect(userIdFromUnsubscribeToken('garbage')).toBeNull();
  });
});

describe('POST /api/v1/internal/reminders', () => {
  it('needs the cron secret', async () => {
    expect((await request(app).post('/api/v1/internal/reminders')).status).toBe(401);
    expect((await runReminders('wrong-secret-that-is-long-enough!!')).status).toBe(401);
  });

  it("emails one digest of today's and tomorrow's open next steps, once", async () => {
    const { auth, email } = await signUp();
    await addJob(auth, {
      company: 'Paystack',
      role: 'Backend Engineer',
      status: 'interview',
      nextStep: 'Technical interview',
      nextStepAt: ymd(0),
    });
    await addJob(auth, {
      company: 'Flutterwave',
      role: 'Frontend Engineer',
      status: 'applied',
      nextStep: 'Follow up with recruiter',
      nextStepAt: ymd(1),
    });
    // Not included: too far away, and a rejected job.
    await addJob(auth, { company: 'Later', role: 'Dev', nextStep: 'Apply', nextStepAt: ymd(3) });
    await addJob(auth, {
      company: 'Nope',
      role: 'Dev',
      status: 'rejected',
      nextStep: 'Ask for feedback',
      nextStepAt: ymd(0),
    });

    const res = await runReminders();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ due: 2, emails: 1, failed: 0 });

    const sent = devOutbox.filter((m) => m.to.email === email);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toContain('Today: Technical interview (Backend Engineer at Paystack)');
    expect(sent[0]!.text).toContain('Tomorrow: Follow up with recruiter');
    expect(sent[0]!.text).not.toContain('Nope');
    expect(sent[0]!.headers?.['List-Unsubscribe']).toContain('/unsubscribe?token=');

    // Running again the same day sends nothing new.
    const again = await runReminders();
    expect(again.body).toMatchObject({ due: 0, emails: 0 });
  });

  it('reminds again when the next step moves to a new date', async () => {
    const { auth } = await signUp();
    const job = await addJob(auth, {
      company: 'Andela',
      role: 'Engineer',
      nextStep: 'Call',
      nextStepAt: ymd(0),
    });
    await runReminders();

    await request(app)
      .patch(`/api/v1/applications/${job.body.application.id}`)
      .set('Authorization', auth)
      .send({ nextStepAt: ymd(1) });
    const res = await runReminders();
    expect(res.body).toMatchObject({ due: 1, emails: 1 });
  });

  it('skips unverified emails and people who turned reminders off', async () => {
    const unverified = await signUp({ verified: false });
    await addJob(unverified.auth, { company: 'A', role: 'B', nextStep: 'X', nextStepAt: ymd(0) });

    const optedOut = await signUp();
    await addJob(optedOut.auth, { company: 'A', role: 'B', nextStep: 'X', nextStepAt: ymd(0) });
    const off = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', optedOut.auth)
      .send({ emailReminders: false });
    expect(off.body.user.emailReminders).toBe(false);

    const res = await runReminders();
    expect(res.body.emails).toBe(0);
    expect(devOutbox).toHaveLength(0);
  });
});

describe('POST /api/v1/reminders/unsubscribe', () => {
  it('turns reminders off with the link from the email', async () => {
    const { userId } = await signUp();
    const res = await request(app)
      .post('/api/v1/reminders/unsubscribe')
      .send({ token: unsubscribeToken(userId) });
    expect(res.status).toBe(200);
    expect((await UserModel.findById(userId))!.emailReminders).toBe(false);

    const bad = await request(app)
      .post('/api/v1/reminders/unsubscribe')
      .send({ token: `${userId}.not-the-right-signature` });
    expect(bad.status).toBe(400);
  });
});
