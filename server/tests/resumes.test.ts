import { readFileSync } from 'node:fs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/utils/AppError.js';
import { UsageModel } from '../src/modules/usage/usage.model.js';
import { useTestDatabase } from './helpers/db.js';

// Replace the real AI call with a fake one: tests must be fast, free and predictable.
const { generateStructured } = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock('../src/ai/aiClient.js', () => ({ generateStructured }));

useTestDatabase();

const app = createApp();
const cvFile = readFileSync(new URL('./fixtures/sample-cv.pdf', import.meta.url));

const fakeAnalysis = {
  overallScore: 68.4,
  scores: { ats: 80, impact: 45, skills: 75, structure: 70, clarity: 72 },
  detectedRole: 'Full-stack Developer',
  experienceLevel: 'entry',
  summary: 'A solid foundation that undersells your impact.',
  strengths: ['Relevant stack', 'Clear structure'],
  improvements: [
    { priority: 'high', title: 'Quantify results', detail: 'Add numbers to your bullets.' },
  ],
  sections: [{ name: 'Experience', score: 55, feedback: 'Duties rather than achievements.' }],
  improvedBullets: [
    {
      original: 'Responsible for building pages in React.',
      improved: 'Built [N] responsive React pages used by [X] customers.',
      reason: 'Shows ownership and scale.',
    },
  ],
  skills: { technical: ['React', 'Node.js'], soft: ['Teamwork'], missing: ['Testing'] },
};

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

async function uploadCv(auth: string) {
  return request(app)
    .post('/api/v1/resumes')
    .set('Authorization', auth)
    .attach('file', cvFile, 'Ada CV.pdf');
}

beforeEach(() => {
  generateStructured.mockReset();
  generateStructured.mockResolvedValue({
    data: fakeAnalysis,
    model: 'gemini-test',
    totalTokens: 1234,
    durationMs: 900,
  });
});

describe('CV upload', () => {
  it('extracts the text and saves the CV', async () => {
    const auth = await signUp();
    const res = await uploadCv(auth);

    expect(res.status).toBe(201);
    expect(res.body.resume).toMatchObject({ title: 'Ada CV', fileType: 'pdf', latestScore: null });
    expect(res.body.resume.wordCount).toBeGreaterThan(50);
    expect(res.body.resume.text).toBeUndefined();
  });

  it('rejects unsupported files', async () => {
    const auth = await signUp();
    const res = await request(app)
      .post('/api/v1/resumes')
      .set('Authorization', auth)
      .attach('file', Buffer.from('not really a cv'), 'photo.png');

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
  });

  it('requires login', async () => {
    const res = await request(app).get('/api/v1/resumes');
    expect(res.status).toBe(401);
  });
});

describe('CV analysis', () => {
  it('analyses a CV, saves the report and counts the use', async () => {
    const auth = await signUp();
    const { body } = await uploadCv(auth);

    const res = await request(app)
      .post(`/api/v1/resumes/${body.resume.id}/analyze`)
      .set('Authorization', auth)
      .send({ targetRole: 'Backend Engineer' });

    expect(res.status).toBe(201);
    expect(res.body.analysis).toMatchObject({
      overallScore: 68,
      targetRole: 'Backend Engineer',
      model: 'gemini-test',
    });

    // Contact details were removed before the CV went to the AI.
    const prompt = JSON.stringify(generateStructured.mock.calls[0]![0].messages);
    expect(prompt).not.toContain('ada.okafor@example.com');
    expect(prompt).toContain('Backend Engineer');

    const usage = await request(app).get('/api/v1/usage').set('Authorization', auth);
    expect(usage.body.usage.cvAnalysis).toMatchObject({ used: 1, limit: 5, remaining: 4 });

    const list = await request(app).get('/api/v1/resumes').set('Authorization', auth);
    expect(list.body.resumes[0].latestScore).toBe(68);

    const report = await request(app)
      .get(`/api/v1/analyses/${res.body.analysis.id}`)
      .set('Authorization', auth);
    expect(report.body.analysis.improvedBullets).toHaveLength(1);
  });

  it('does not count a use when the AI fails', async () => {
    generateStructured.mockRejectedValueOnce(new AppError(503, 'Busy', 'AI_UNAVAILABLE'));
    const auth = await signUp();
    const { body } = await uploadCv(auth);

    const res = await request(app)
      .post(`/api/v1/resumes/${body.resume.id}/analyze`)
      .set('Authorization', auth)
      .send({});
    expect(res.status).toBe(503);

    const usage = await request(app).get('/api/v1/usage').set('Authorization', auth);
    expect(usage.body.usage.cvAnalysis.used).toBe(0);
  });

  it('stops free users at the monthly limit', async () => {
    const auth = await signUp();
    const { body } = await uploadCv(auth);
    await UsageModel.syncIndexes();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post(`/api/v1/resumes/${body.resume.id}/analyze`)
        .set('Authorization', auth)
        .send({})
        .expect(201);
    }
    const sixth = await request(app)
      .post(`/api/v1/resumes/${body.resume.id}/analyze`)
      .set('Authorization', auth)
      .send({});

    expect(sixth.status).toBe(403);
    expect(sixth.body.error.code).toBe('PLAN_LIMIT_REACHED');
    expect(generateStructured).toHaveBeenCalledTimes(5);
  });

  it("never shows one user's CV or report to another user", async () => {
    const ada = await signUp();
    const eve = await signUp();
    const { body } = await uploadCv(ada);
    const analysis = await request(app)
      .post(`/api/v1/resumes/${body.resume.id}/analyze`)
      .set('Authorization', ada)
      .send({});

    const stealCv = await request(app)
      .post(`/api/v1/resumes/${body.resume.id}/analyze`)
      .set('Authorization', eve)
      .send({});
    const stealReport = await request(app)
      .get(`/api/v1/analyses/${analysis.body.analysis.id}`)
      .set('Authorization', eve);
    const eveList = await request(app).get('/api/v1/resumes').set('Authorization', eve);

    expect(stealCv.status).toBe(404);
    expect(stealReport.status).toBe(404);
    expect(eveList.body.resumes).toHaveLength(0);
  });

  it('deletes a CV together with its reports', async () => {
    const auth = await signUp();
    const { body } = await uploadCv(auth);
    await request(app)
      .post(`/api/v1/resumes/${body.resume.id}/analyze`)
      .set('Authorization', auth)
      .send({});

    await request(app)
      .delete(`/api/v1/resumes/${body.resume.id}`)
      .set('Authorization', auth)
      .expect(204);
    const analyses = await request(app).get('/api/v1/analyses').set('Authorization', auth);
    expect(analyses.body.analyses).toHaveLength(0);
  });
});
