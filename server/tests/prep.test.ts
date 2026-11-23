import { readFileSync } from 'node:fs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/utils/AppError.js';
import { composeLetter } from '../src/modules/coverLetters/coverLetters.service.js';
import { useTestDatabase } from './helpers/db.js';

// Fake AI: returns a different answer depending on what is being generated.
const { generateStructured } = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock('../src/ai/aiClient.js', () => ({ generateStructured }));

useTestDatabase();

const app = createApp();
const cvFile = readFileSync(new URL('./fixtures/sample-cv.pdf', import.meta.url));

const jobDescription = `We are hiring a Junior Backend Engineer to join our payments team in Lagos.
You will build and maintain REST APIs with Node.js and Express, design MongoDB schemas,
and write automated tests. Experience with TypeScript and Docker is required.
Nice to have: AWS, GraphQL and experience in fintech. Strong communication skills are essential.`;

const fakeResults: Record<string, unknown> = {
  job_match: {
    jobTitle: 'Junior Backend Engineer',
    company: 'PayCo',
    seniority: 'entry',
    keywords: [{ keyword: 'Node.js', importance: 'required' }],
    fitScore: 70,
    verdict: 'A good backend match.',
    strengths: ['Payments API experience'],
    gaps: ['No Docker'],
    tailoringTips: [],
    suggestedSummary: '',
  },
  cover_letter: {
    greeting: 'Dear PayCo Hiring Team,',
    paragraphs: ['First paragraph.', '  Second paragraph.  ', ''],
    closing: 'Kind regards,',
  },
  interview_prep: {
    questions: [
      {
        category: 'motivation',
        question: 'Why PayCo?',
        whyTheyAsk: 'Motivation',
        howToAnswer: 'Be specific.',
        cvPoints: ['Payments project', 'a', 'b', 'c'],
      },
      {
        category: 'technical',
        question: 'How do you design a REST API?',
        whyTheyAsk: 'Skills',
        howToAnswer: 'Talk about resources.',
        cvPoints: [],
      },
    ],
  },
  answer_feedback: {
    score: 11,
    summary: 'Good start.',
    strengths: ['Clear'],
    improvements: ['Add a number', 'Use STAR', 'Shorter', 'Extra'],
    improvedAnswer: 'A stronger answer.',
  },
};

beforeEach(() => {
  generateStructured.mockReset();
  generateStructured.mockImplementation(async ({ name }: { name: string }) => ({
    data: fakeResults[name],
    model: 'gemini-test',
    totalTokens: 500,
    durationMs: 100,
  }));
});

async function signUpWithMatch(email = `ada${Math.random()}@example.com`) {
  const signUp = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Zainab Bello', email, password: 'analytical1' });
  const auth = `Bearer ${signUp.body.accessToken}`;
  const upload = await request(app)
    .post('/api/v1/resumes')
    .set('Authorization', auth)
    .attach('file', cvFile, 'cv.pdf');
  const match = await request(app)
    .post('/api/v1/job-matches')
    .set('Authorization', auth)
    .send({ resumeId: upload.body.resume.id, jobDescription });
  return {
    auth,
    resumeId: upload.body.resume.id as string,
    matchId: match.body.match.id as string,
  };
}

describe('composeLetter', () => {
  it('joins the parts and signs with the user name', () => {
    expect(
      composeLetter(
        { greeting: 'Dear Team,', paragraphs: ['One.', ' ', 'Two.'], closing: 'Best,' },
        'Ada Okafor',
      ),
    ).toBe('Dear Team,\n\nOne.\n\nTwo.\n\nBest,\nAda Okafor');
  });
});

describe('cover letters', () => {
  it('writes a letter for a job match, signed with the user name', async () => {
    const { auth, matchId } = await signUpWithMatch();

    const res = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId, tone: 'warm', length: 'short', notes: 'Relocating to Lagos' });

    expect(res.status).toBe(201);
    expect(res.body.coverLetter).toMatchObject({
      jobMatchId: matchId,
      jobTitle: 'Junior Backend Engineer',
      company: 'PayCo',
      tone: 'warm',
      length: 'short',
      edited: false,
      content:
        'Dear PayCo Hiring Team,\n\nFirst paragraph.\n\nSecond paragraph.\n\nKind regards,\nZainab Bello',
    });

    // The user's notes reach the AI, but their account name does not (the CV is sent redacted).
    const call = generateStructured.mock.calls.at(-1)![0];
    const prompt = JSON.stringify(call.messages);
    expect(prompt).toContain('Relocating to Lagos');
    expect(prompt).not.toContain('Zainab Bello');
  });

  it('replaces the letter when written again, and saves edits', async () => {
    const { auth, matchId } = await signUpWithMatch();
    const first = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId });
    const id = first.body.coverLetter.id;

    const edited = await request(app)
      .patch(`/api/v1/cover-letters/${id}`)
      .set('Authorization', auth)
      .send({ content: 'My own version' });
    expect(edited.body.coverLetter).toMatchObject({ content: 'My own version', edited: true });

    const again = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId, tone: 'confident' });
    expect(again.body.coverLetter.id).toBe(id);
    expect(again.body.coverLetter).toMatchObject({ tone: 'confident', edited: false });

    const byMatch = await request(app)
      .get(`/api/v1/cover-letters/by-match/${matchId}`)
      .set('Authorization', auth);
    expect(byMatch.body.coverLetter.tone).toBe('confident');

    const list = await request(app).get('/api/v1/cover-letters').set('Authorization', auth);
    expect(list.body.coverLetters).toHaveLength(1);
  });

  it('rejects an unknown tone and other users', async () => {
    const { auth, matchId } = await signUpWithMatch();
    const bad = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId, tone: 'sarcastic' });
    expect(bad.status).toBe(400);

    const other = await signUpWithMatch();
    const res = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', other.auth)
      .send({ jobMatchId: matchId });
    expect(res.status).toBe(404);

    const missing = await request(app)
      .get(`/api/v1/cover-letters/by-match/${matchId}`)
      .set('Authorization', auth);
    expect(missing.status).toBe(404);
  });

  it('stops at the free limit and gives the use back when the AI fails', async () => {
    const { auth, matchId } = await signUpWithMatch();

    generateStructured.mockImplementationOnce(async () => {
      throw new AppError(503, 'AI busy', 'AI_UNAVAILABLE');
    });
    const failed = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId });
    expect(failed.status).toBe(503);

    for (let i = 0; i < 5; i++) {
      const ok = await request(app)
        .post('/api/v1/cover-letters')
        .set('Authorization', auth)
        .send({ jobMatchId: matchId });
      expect(ok.status).toBe(201);
    }
    const blocked = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PLAN_LIMIT_REACHED');
    expect(blocked.body.error.message).toContain('cover letters');

    const usage = await request(app).get('/api/v1/usage').set('Authorization', auth);
    expect(usage.body.usage.coverLetter).toEqual({ used: 5, limit: 5, remaining: 0 });
  });
});

describe('interview prep', () => {
  it('generates questions and reviews a practice answer', async () => {
    const { auth, matchId } = await signUpWithMatch();

    const res = await request(app)
      .post('/api/v1/interview-preps')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId });
    expect(res.status).toBe(201);
    const prep = res.body.interviewPrep;
    expect(prep.questions).toHaveLength(2);
    expect(prep.questions[0].cvPoints).toHaveLength(3);
    expect(prep.questions[0].feedback).toBeNull();

    // The match's gaps are given to the AI so it can ask about them.
    expect(JSON.stringify(generateStructured.mock.calls.at(-1)![0].messages)).toContain(
      'No Docker',
    );

    const tooShort = await request(app)
      .post(`/api/v1/interview-preps/${prep.id}/questions/${prep.questions[0].id}/feedback`)
      .set('Authorization', auth)
      .send({ answer: 'Because.' });
    expect(tooShort.status).toBe(400);

    const answer =
      'I want to work at PayCo because I built a payments API in my last project and enjoyed it.';
    const reviewed = await request(app)
      .post(`/api/v1/interview-preps/${prep.id}/questions/${prep.questions[0].id}/feedback`)
      .set('Authorization', auth)
      .send({ answer });
    expect(reviewed.status).toBe(200);
    const q = reviewed.body.interviewPrep.questions[0];
    expect(q.answer).toBe(answer);
    expect(q.feedback).toMatchObject({ score: 10, summary: 'Good start.' });
    expect(q.feedback.improvements).toHaveLength(3);

    const list = await request(app).get('/api/v1/interview-preps').set('Authorization', auth);
    expect(list.body.interviewPreps[0]).toMatchObject({ questionCount: 2, practisedCount: 1 });

    const usage = await request(app).get('/api/v1/usage').set('Authorization', auth);
    expect(usage.body.usage.interviewPrep.used).toBe(1);
    expect(usage.body.usage.answerFeedback).toEqual({ used: 1, limit: 30, remaining: 29 });
  });

  it('returns 404 for an unknown question or another user', async () => {
    const { auth, matchId } = await signUpWithMatch();
    const prep = (
      await request(app)
        .post('/api/v1/interview-preps')
        .set('Authorization', auth)
        .send({ jobMatchId: matchId })
    ).body.interviewPrep;

    const answer = 'A long enough answer that talks about a real project and what I learned.';
    const unknown = await request(app)
      .post(`/api/v1/interview-preps/${prep.id}/questions/not-a-question/feedback`)
      .set('Authorization', auth)
      .send({ answer });
    expect(unknown.status).toBe(404);

    const other = await signUpWithMatch();
    const res = await request(app)
      .post(`/api/v1/interview-preps/${prep.id}/questions/${prep.questions[0].id}/feedback`)
      .set('Authorization', other.auth)
      .send({ answer });
    expect(res.status).toBe(404);
  });
});

describe('deleting', () => {
  it('removes cover letters and interview prep with their job match', async () => {
    const { auth, matchId } = await signUpWithMatch();
    await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId });
    await request(app)
      .post('/api/v1/interview-preps')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId });

    await request(app).delete(`/api/v1/job-matches/${matchId}`).set('Authorization', auth);

    const letters = await request(app).get('/api/v1/cover-letters').set('Authorization', auth);
    const preps = await request(app).get('/api/v1/interview-preps').set('Authorization', auth);
    expect(letters.body.coverLetters).toEqual([]);
    expect(preps.body.interviewPreps).toEqual([]);
  });

  it('removes them when the CV is deleted too', async () => {
    const { auth, resumeId, matchId } = await signUpWithMatch();
    await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', auth)
      .send({ jobMatchId: matchId });

    await request(app).delete(`/api/v1/resumes/${resumeId}`).set('Authorization', auth);

    const letters = await request(app).get('/api/v1/cover-letters').set('Authorization', auth);
    expect(letters.body.coverLetters).toEqual([]);
  });
});
