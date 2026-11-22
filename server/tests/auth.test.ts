import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { SessionModel } from '../src/modules/auth/session.model.js';
import { useTestDatabase } from './helpers/db.js';

useTestDatabase();

const app = createApp();

const ada = { name: 'Ada Lovelace', email: 'Ada@Example.com', password: 'analytical1' };

/** Pulls the refresh cookie ("ribra_rt=...") out of a response. */
function refreshCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('ribra_rt='));
  if (!cookie) throw new Error('No refresh cookie was set');
  return cookie.split(';')[0]!;
}

async function registerAda() {
  return request(app).post('/api/v1/auth/register').send(ada);
}

describe('POST /api/v1/auth/register', () => {
  it('creates an account, returns an access token and sets a secure refresh cookie', async () => {
    const res = await registerAda();

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      plan: 'free',
    });
    expect(res.body.user.passwordHash).toBeUndefined();

    const rawCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(rawCookie).toContain('HttpOnly');
    expect(rawCookie).toContain('Path=/api/v1/auth');
  });

  it('rejects a second account with the same email', async () => {
    await registerAda();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...ada, email: 'ada@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects weak passwords with a field-level message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...ada, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('password');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in with the right password (email is case-insensitive)', async () => {
    await registerAda();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ADA@example.com', password: ada.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ada@example.com');
    expect(refreshCookie(res)).toMatch(/^ribra_rt=/);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await registerAda();
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ada.email, password: 'wrong-password1' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toEqual(unknownEmail.body.error);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the user for a valid access token', async () => {
    const { body } = await registerAda();
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ada@example.com');
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a tampered token', async () => {
    const { body } = await registerAda();
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}x`);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('swaps the refresh cookie for a new access token and a new cookie', async () => {
    const registered = await registerAda();
    const cookie = refreshCookie(registered);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('ada@example.com');
    expect(refreshCookie(res)).not.toBe(cookie);
  });

  it('ends every session if an old refresh token is reused (token theft protection)', async () => {
    const registered = await registerAda();
    const oldCookie = refreshCookie(registered);

    await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie).expect(200);
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);

    expect(reuse.status).toBe(401);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('rejects requests without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_SESSION');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('ends the session so the refresh cookie stops working', async () => {
    const registered = await registerAda();
    const cookie = refreshCookie(registered);

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(401);
    expect(await SessionModel.countDocuments()).toBe(0);
  });
});
