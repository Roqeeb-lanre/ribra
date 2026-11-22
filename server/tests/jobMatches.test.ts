import { readFileSync } from 'node:fs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/utils/AppError.js';
import { UsageModel } from '../src/modules/usage/usage.model.js';
import { useTestDatabase } from './helpers/db.js';

// Fake AI: tests must be fast, free and predictable.
const { generateStructured } = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock('../src/ai/aiClient.js', () => ({ generateStructured }));

useTestDatabase();

const app = createApp();
const cvFile = readFileSync(new URL('./fixtures/sample-cv.pdf', import.meta.url));

const jobDescription = `We are hiring a Junior Backend Engineer to join our payments team in Lagos.
You will build and maintain REST APIs with Node.js and Express, design MongoDB schemas,
and write automated tests. Experience with TypeScript and Docker is required.
Nice to have: AWS, GraphQL and experience in fintech. Strong communication skills are essential.`;

const fakeAi = {
  jobTitle: 'Junior Backend Engineer',
  company: 'PayCo',
  seniority: 'entry',
  keywords: [
    { keyword: 'Node.js', importance: 'required' },
    { keyword: 'Express', importance: 'required' },
    { keyword: 'MongoDB', importance: 'required' },
    { keyword: 'TypeScript', importance: 'required' },
    { keyword: 'Docker', importance: 'required' },
    { keyword: 'AWS', importance: 'preferred' },
  ],
  fitScore: 70,
  verdict: 'A good backend match. The biggest gap is Docker.',
  strengths: ['Payments API experience'],
  gaps: ['No Docker'],
  tailoringTips: [{ section: 'Skills', tip: 'Move Node.js and Express to the top.' }],
  suggestedSummary: 'Backend-focused developer who has built payment APIs with Node.js.',
};

async function signUpWithCv() {
  const signUp = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Ada Okafor',
      email: `ada${Math.random()}@example.com`,
      password: 'analytical1',
    });
  const auth = `Bearer ${signUp.body.accessToken}`;
  const upload = await request(app)
    .post('/api/v1/resumes')
    .set('Authorization', auth)
    .attach('file', cvFile, 'cv.pdf');
  return { auth, resumeId: upload.body.resume.id as string };
}

beforeEach(() => {
  generateStructured.mockReset();
  generateStructured.mockResolvedValue({
    data: fakeAi,
    model: 'gemini-test',
    totalTokens: 900,
    durationMs: 800,
  });
});

describe('POST /api/v1/job-matches', () => {
  it('scores the match, checking keywords in code', async () => {
    const { auth, resumeId } = await signUpWithCv();

    const res = await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', auth)
      .send({ resumeId, jobDescription });

    expect(res.status).toBe(201);
    const { match } = res.body;
    expect(match.jobTitle).toBe('Junior Backend Engineer');

    // The sample CV mentions Node.js, Express, MongoDB and TypeScript, but not Docker or AWS.
    const found = Object.fromEntries(
      match.keywords.map((k: { keyword: string; found: boolean }) => [k.keyword, k.found]),
    );
    expect(found).toEqual({
      'Node.js': true,
      Express: true,
      MongoDB: true,
      TypeScript: true,
      Docker: false,
      AWS: false,
    });

    // Coverage: 8 of 11 weighted points = 73%. Score: 70 * 0.6 + 73 * 0.4 = 71.
    expect(match.keywordCoverage).toBe(73);
    expect(match.matchScore).toBe(71);

    const usage = await request(app).get('/api/v1/usage').set('Authorization', auth);
    expect(usage.body.usage.jobMatch).toMatchObject({ used: 1, limit: 5 });
  });

  it('reuses the saved result for the same CV and job (no AI call, no quota used)', async () => {
    const { auth, resumeId } = await signUpWithCv();
    await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', auth)
      .send({ resumeId, jobDescription })
      .expect(201);

    const again = await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', auth)
      .send({ resumeId, jobDescription: `  ${jobDescription.toUpperCase()}  ` });

    expect(again.status).toBe(200);
    expect(again.body.cached).toBe(true);
    expect(generateStructured).toHaveBeenCalledTimes(1);
    const usage = await request(app).get('/api/v1/usage').set('Authorization', auth);
    expect(usage.body.usage.jobMatch.used).toBe(1);
  });

  it('rejects a job description that is too short', async () => {
    const { auth, resumeId } = await signUpWithCv();
    const res = await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', auth)
      .send({ resumeId, jobDescription: 'Developer needed.' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('jobDescription');
  });

  it('gives the use back when the AI fails', async () => {
    generateStructured.mockRejectedValueOnce(new AppError(503, 'Busy', 'AI_UNAVAILABLE'));
    const { auth, resumeId } = await signUpWithCv();

    const res = await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', auth)
      .send({ resumeId, jobDescription });
    expect(res.status).toBe(503);

    const usage = await request(app).get('/api/v1/usage').set('Authorization', auth);
    expect(usage.body.usage.jobMatch.used).toBe(0);
  });

  it('stops free users at the monthly limit', async () => {
    const { auth, resumeId } = await signUpWithCv();
    await UsageModel.syncIndexes();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/job-matches')
        .set('Authorization', auth)
        .send({ resumeId, jobDescription: `${jobDescription}\nPosting #${i}` })
        .expect(201);
    }
    const sixth = await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', auth)
      .send({ resumeId, jobDescription: `${jobDescription}\nPosting #6` });

    expect(sixth.status).toBe(403);
    expect(sixth.body.error.message).toContain('job matches');
  });

  it("doesn't let one user use or read another user's data", async () => {
    const ada = await signUpWithCv();
    const eve = await signUpWithCv();
    const created = await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', ada.auth)
      .send({ resumeId: ada.resumeId, jobDescription });

    const useAdasCv = await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', eve.auth)
      .send({ resumeId: ada.resumeId, jobDescription });
    const readAdasMatch = await request(app)
      .get(`/api/v1/job-matches/${created.body.match.id}`)
      .set('Authorization', eve.auth);

    expect(useAdasCv.status).toBe(404);
    expect(readAdasMatch.status).toBe(404);
  });
});

describe('listing and deleting', () => {
  it('lists matches newest first and deletes them', async () => {
    const { auth, resumeId } = await signUpWithCv();
    const created = await request(app)
      .post('/api/v1/job-matches')
      .set('Authorization', auth)
      .send({ resumeId, jobDescription });

    const list = await request(app).get('/api/v1/job-matches').set('Authorization', auth);
    expect(list.body.matches).toHaveLength(1);
    expect(list.body.matches[0]).toMatchObject({
      jobTitle: 'Junior Backend Engineer',
      matchScore: 71,
    });

    await request(app)
      .delete(`/api/v1/job-matches/${created.body.match.id}`)
      .set('Authorization', auth)
      .expect(204);
    const after = await request(app).get('/api/v1/job-matches').set('Authorization', auth);
    expect(after.body.matches).toHaveLength(0);
  });
});
