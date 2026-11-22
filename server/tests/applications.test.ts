import { readFileSync } from 'node:fs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { useTestDatabase } from './helpers/db.js';

// Fake AI, only needed for the "track a job match" tests.
const { generateStructured } = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock('../src/ai/aiClient.js', () => ({ generateStructured }));

useTestDatabase();

const app = createApp();
const cvFile = readFileSync(new URL('./fixtures/sample-cv.pdf', import.meta.url));

const jobDescription = `We are hiring a Junior Backend Engineer to join our payments team in Lagos.
You will build and maintain REST APIs with Node.js and Express, design MongoDB schemas,
and write automated tests. Experience with TypeScript and Docker is required.
Nice to have: AWS, GraphQL and experience in fintech. Strong communication skills are essential.`;

beforeEach(() => {
  generateStructured.mockReset();
  generateStructured.mockResolvedValue({
    data: {
      jobTitle: 'Junior Backend Engineer',
      company: 'PayCo',
      seniority: 'entry',
      keywords: [{ keyword: 'Node.js', importance: 'required' }],
      fitScore: 70,
      verdict: 'A good backend match.',
      strengths: [],
      gaps: [],
      tailoringTips: [],
      suggestedSummary: '',
    },
    model: 'gemini-test',
    totalTokens: 900,
    durationMs: 800,
  });
});

async function signUp() {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Ada Okafor',
      email: `ada${Math.random()}@example.com`,
      password: 'analytical1',
    });
  return `Bearer ${res.body.accessToken}`;
}

const newApp = (auth: string, body: object) =>
  request(app).post('/api/v1/applications').set('Authorization', auth).send(body);

describe('applications', () => {
  it('requires login', async () => {
    const res = await request(app).get('/api/v1/applications');
    expect(res.status).toBe(401);
  });

  it('creates a saved job without an applied date', async () => {
    const auth = await signUp();
    const res = await newApp(auth, { company: 'Flutterwave', role: 'Frontend Engineer' });

    expect(res.status).toBe(201);
    expect(res.body.application).toMatchObject({
      company: 'Flutterwave',
      role: 'Frontend Engineer',
      status: 'saved',
      appliedAt: null,
      jobMatchId: null,
    });
    expect(res.body.application.history).toHaveLength(1);
  });

  it('sets the applied date when a job is created as applied', async () => {
    const auth = await signUp();
    const res = await newApp(auth, {
      company: 'Paystack',
      role: 'Backend Engineer',
      status: 'applied',
    });
    expect(res.body.application.appliedAt).not.toBeNull();
  });

  it('rejects missing fields, bad statuses and unsafe links', async () => {
    const auth = await signUp();
    expect((await newApp(auth, { role: 'Engineer' })).status).toBe(400);
    expect((await newApp(auth, { company: 'A', role: 'B', status: 'hired' })).status).toBe(400);
    const badLink = await newApp(auth, { company: 'A', role: 'B', jobUrl: 'javascript:alert(1)' });
    expect(badLink.status).toBe(400);
    expect(badLink.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('moves through statuses, recording history and keeping the first applied date', async () => {
    const auth = await signUp();
    const { id } = (await newApp(auth, { company: 'Andela', role: 'Engineer' })).body.application;

    const applied = await request(app)
      .patch(`/api/v1/applications/${id}`)
      .set('Authorization', auth)
      .send({ status: 'applied' });
    expect(applied.status).toBe(200);
    const appliedAt = applied.body.application.appliedAt;
    expect(appliedAt).not.toBeNull();

    const interview = await request(app)
      .patch(`/api/v1/applications/${id}`)
      .set('Authorization', auth)
      .send({ status: 'interview', nextStep: 'Technical interview', nextStepAt: '2026-12-02' });
    expect(interview.body.application).toMatchObject({
      status: 'interview',
      appliedAt,
      nextStep: 'Technical interview',
    });
    expect(interview.body.application.history.map((h: { status: string }) => h.status)).toEqual([
      'saved',
      'applied',
      'interview',
    ]);

    // Saving the same status again does not add another history entry.
    const again = await request(app)
      .patch(`/api/v1/applications/${id}`)
      .set('Authorization', auth)
      .send({ status: 'interview', notes: 'Bring portfolio' });
    expect(again.body.application.history).toHaveLength(3);
    expect(again.body.application.notes).toBe('Bring portfolio');

    // null clears a date.
    const cleared = await request(app)
      .patch(`/api/v1/applications/${id}`)
      .set('Authorization', auth)
      .send({ nextStepAt: null });
    expect(cleared.body.application.nextStepAt).toBeNull();
  });

  it('rejects an empty update', async () => {
    const auth = await signUp();
    const { id } = (await newApp(auth, { company: 'A', role: 'B' })).body.application;
    const res = await request(app)
      .patch(`/api/v1/applications/${id}`)
      .set('Authorization', auth)
      .send({});
    expect(res.status).toBe(400);
  });

  it("keeps each user's applications private", async () => {
    const ada = await signUp();
    const bola = await signUp();
    const { id } = (await newApp(ada, { company: 'A', role: 'B' })).body.application;

    expect(
      (await request(app).get(`/api/v1/applications/${id}`).set('Authorization', bola)).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/v1/applications/${id}`)
          .set('Authorization', bola)
          .send({ status: 'offer' })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/api/v1/applications/${id}`).set('Authorization', bola)).status,
    ).toBe(404);

    const list = await request(app).get('/api/v1/applications').set('Authorization', bola);
    expect(list.body.applications).toEqual([]);
  });

  it('lists newest-updated first and deletes', async () => {
    const auth = await signUp();
    const first = (await newApp(auth, { company: 'First', role: 'R' })).body.application;
    await newApp(auth, { company: 'Second', role: 'R' });
    await request(app)
      .patch(`/api/v1/applications/${first.id}`)
      .set('Authorization', auth)
      .send({ status: 'applied' });

    const list = await request(app).get('/api/v1/applications').set('Authorization', auth);
    expect(list.body.applications.map((a: { company: string }) => a.company)).toEqual([
      'First',
      'Second',
    ]);

    const del = await request(app)
      .delete(`/api/v1/applications/${first.id}`)
      .set('Authorization', auth);
    expect(del.status).toBe(204);
    expect(
      (await request(app).get(`/api/v1/applications/${first.id}`).set('Authorization', auth))
        .status,
    ).toBe(404);
  });

  it('returns 404 for a malformed id', async () => {
    const auth = await signUp();
    const res = await request(app).get('/api/v1/applications/not-an-id').set('Authorization', auth);
    expect(res.status).toBe(404);
  });
});

describe('tracking a job match', () => {
  async function signUpWithMatch() {
    const auth = await signUp();
    const upload = await request(app)
      .post('/api/v1/resumes')
      .set('Authorization', auth)
      .attach('file', cvFile, 'cv.pdf');
    const match = await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', auth)
      .send({ resumeId: upload.body.resume.id, jobDescription });
    return { auth, resumeId: upload.body.resume.id as string, match: match.body.match };
  }

  it('creates an application from the match, only once', async () => {
    const { auth, match } = await signUpWithMatch();

    const first = await request(app)
      .post(`/api/v1/applications/from-match/${match.id}`)
      .set('Authorization', auth);
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(true);
    expect(first.body.application).toMatchObject({
      company: 'PayCo',
      role: 'Junior Backend Engineer',
      status: 'saved',
      jobMatchId: match.id,
      matchScore: match.matchScore,
    });

    const second = await request(app)
      .post(`/api/v1/applications/from-match/${match.id}`)
      .set('Authorization', auth);
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.application.id).toBe(first.body.application.id);
  });

  it("can't track someone else's match", async () => {
    const { match } = await signUpWithMatch();
    const other = await signUp();
    const res = await request(app)
      .post(`/api/v1/applications/from-match/${match.id}`)
      .set('Authorization', other);
    expect(res.status).toBe(404);
  });

  it('keeps the application but unlinks it when the match or CV is deleted', async () => {
    const { auth, resumeId, match } = await signUpWithMatch();
    const tracked = await request(app)
      .post(`/api/v1/applications/from-match/${match.id}`)
      .set('Authorization', auth);
    const id = tracked.body.application.id;

    await request(app).delete(`/api/v1/resumes/${resumeId}`).set('Authorization', auth);

    const after = await request(app).get(`/api/v1/applications/${id}`).set('Authorization', auth);
    expect(after.status).toBe(200);
    expect(after.body.application.jobMatchId).toBeNull();
    expect(after.body.application.company).toBe('PayCo');
  });
});
