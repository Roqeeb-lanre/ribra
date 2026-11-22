import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/utils/AppError.js';
import { devOutbox } from '../src/modules/email/email.service.js';
import { SessionModel } from '../src/modules/auth/session.model.js';
import { useTestDatabase } from './helpers/db.js';

// Fake Google: we test OUR logic, not Google's servers.
const { verifyGoogleIdToken } = vi.hoisted(() => ({ verifyGoogleIdToken: vi.fn() }));
vi.mock('../src/modules/auth/google.js', () => ({ verifyGoogleIdToken }));

useTestDatabase();

const app = createApp();
const password = 'analytical1';

/** Pulls the token out of the last email sent to this address. */
function tokenFromLastEmail(email: string, path: 'verify-email' | 'reset-password'): string {
  const message = [...devOutbox].reverse().find((m) => m.to.email === email);
  const match = message?.text.match(new RegExp(`/${path}\\?token=([\\w-]+)`));
  if (!match) throw new Error(`No ${path} email found for ${email}`);
  return match[1]!;
}

async function register(email = `ada${Math.random()}@example.com`) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Ada Okafor', email, password });
  return {
    email,
    auth: `Bearer ${res.body.accessToken}`,
    cookie: String(res.headers['set-cookie']).split(';')[0]!,
  };
}

beforeEach(() => {
  devOutbox.length = 0;
  verifyGoogleIdToken.mockReset();
});

describe('email verification', () => {
  it('sends a confirmation email on sign-up, and the link verifies the account', async () => {
    const { email, auth } = await register();
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', auth);
    expect(me.body.user.emailVerified).toBe(false);

    const sent = devOutbox.find((m) => m.to.email === email);
    expect(sent?.subject).toContain('Confirm your email');
    expect(sent?.text).toContain('http://localhost:5173/verify-email?token=');

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: tokenFromLastEmail(email, 'verify-email') });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('only lets each link be used once', async () => {
    const { email } = await register();
    const token = tokenFromLastEmail(email, 'verify-email');

    await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(200);
    const again = await request(app).post('/api/v1/auth/verify-email').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('TOKEN_INVALID');
  });

  it('resending replaces the old link', async () => {
    const { email, auth } = await register();
    const oldToken = tokenFromLastEmail(email, 'verify-email');

    await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Authorization', auth)
      .expect(200);
    const newToken = tokenFromLastEmail(email, 'verify-email');

    expect(newToken).not.toBe(oldToken);
    await request(app).post('/api/v1/auth/verify-email').send({ token: oldToken }).expect(400);
    await request(app).post('/api/v1/auth/verify-email').send({ token: newToken }).expect(200);
  });
});

describe('password reset', () => {
  it('gives the same answer for known and unknown emails', async () => {
    const { email } = await register();
    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email });
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(devOutbox.some((m) => m.to.email === 'nobody@example.com')).toBe(false);
  });

  it('resets the password, logs out every device and verifies the email', async () => {
    const { email, cookie } = await register();
    await request(app).post('/api/v1/auth/forgot-password').send({ email }).expect(200);
    const token = tokenFromLastEmail(email, 'reset-password');

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'newPassword2' });
    expect(res.status).toBe(200);

    // Old session is gone...
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    expect(await SessionModel.countDocuments()).toBe(0);
    // ...the old password no longer works, the new one does.
    await request(app).post('/api/v1/auth/login').send({ email, password }).expect(401);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'newPassword2' });
    expect(login.status).toBe(200);
    expect(login.body.user.emailVerified).toBe(true);
  });

  it('rejects weak new passwords and reused links', async () => {
    const { email } = await register();
    await request(app).post('/api/v1/auth/forgot-password').send({ email });
    const token = tokenFromLastEmail(email, 'reset-password');

    const weak = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'short' });
    expect(weak.status).toBe(400);

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'newPassword2' })
      .expect(200);
    const reused = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'another3pw' });
    expect(reused.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('Google sign-in', () => {
  const profile = (overrides: Record<string, unknown> = {}) => ({
    googleId: 'google-123',
    email: 'chioma@example.com',
    emailVerified: true,
    name: 'Chioma Eze',
    picture: 'https://example.com/photo.jpg',
    ...overrides,
  });

  it('creates a verified account on first sign-in', async () => {
    verifyGoogleIdToken.mockResolvedValue(profile());

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'fake-google-id-token-123' });

    expect(res.status).toBe(201);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.user).toMatchObject({
      email: 'chioma@example.com',
      emailVerified: true,
      hasPassword: false,
    });
    expect(String(res.headers['set-cookie'])).toContain('ribra_rt=');
  });

  it('signs the same person in again without creating a duplicate', async () => {
    verifyGoogleIdToken.mockResolvedValue(profile());
    const first = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'fake-google-id-token-123' });
    const second = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'fake-google-id-token-456' });

    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it('links Google to an existing email/password account', async () => {
    const { email } = await register('linked@example.com');
    verifyGoogleIdToken.mockResolvedValue(profile({ email }));

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'fake-google-id-token-123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      email,
      googleLinked: true,
      hasPassword: true,
      emailVerified: true,
    });
  });

  it('refuses unverified Google emails and bad tokens', async () => {
    verifyGoogleIdToken.mockResolvedValueOnce(profile({ emailVerified: false }));
    const unverified = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'fake-google-id-token-123' });
    expect(unverified.status).toBe(401);

    verifyGoogleIdToken.mockRejectedValueOnce(
      new AppError(401, 'Google sign-in failed.', 'GOOGLE_TOKEN_INVALID'),
    );
    const bad = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'tampered-google-token-xyz' });
    expect(bad.body.error.code).toBe('GOOGLE_TOKEN_INVALID');
  });

  it('tells Google-only users to use Google when they try a password', async () => {
    verifyGoogleIdToken.mockResolvedValue(profile());
    await request(app).post('/api/v1/auth/google').send({ credential: 'fake-google-id-token-123' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'chioma@example.com', password: 'whatever1' });
    expect(res.body.error.code).toBe('USE_GOOGLE_SIGN_IN');
  });
});
