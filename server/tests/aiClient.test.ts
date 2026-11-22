import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { extractJson, generateStructured } from '../src/ai/aiClient.js';

// vitest.config.ts sets AI_MODELS=model-a,model-b and a fake AI_API_KEY for these tests.

const schema = z.object({ score: z.number(), verdict: z.string() });
const request = {
  name: 'test',
  schema,
  messages: [{ role: 'user' as const, content: 'Rate this' }],
};

/** Builds a fake HTTP response like the AI provider would send. */
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
const ok = (content: string) =>
  reply(200, { choices: [{ message: { content } }], usage: { total_tokens: 42 } });

afterEach(() => vi.unstubAllGlobals());

describe('generateStructured', () => {
  it('returns validated JSON from the first model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok('{"score": 80, "verdict": "Good"}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateStructured(request);

    expect(result.data).toEqual({ score: 80, verdict: 'Good' });
    expect(result.model).toBe('model-a');
    expect(result.totalTokens).toBe(42);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.response_format.type).toBe('json_schema');
  });

  it('falls back to the next model when the first is out of quota', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(429, { error: { message: 'Quota exceeded' } }))
      .mockResolvedValueOnce(ok('{"score": 70, "verdict": "Fine"}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateStructured(request);

    expect(result.model).toBe('model-b');
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).model).toBe('model-b');
  });

  it('retries without response_format if the provider rejects the schema', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(400, { error: { message: 'Unsupported schema' } }))
      .mockResolvedValueOnce(ok('```json\n{"score": 60, "verdict": "OK"}\n```'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateStructured(request);

    expect(result.data.score).toBe(60);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).response_format).toBeUndefined();
  });

  it('asks the model to repair invalid JSON once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok('{"score": "high"}'))
      .mockResolvedValueOnce(ok('{"score": 90, "verdict": "Great"}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateStructured(request);

    expect(result.data).toEqual({ score: 90, verdict: 'Great' });
    const repairMessages = JSON.parse(fetchMock.mock.calls[1]![1].body).messages;
    expect(repairMessages.at(-1).content).toContain('did not match');
  });

  it('gives a friendly error when every model is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(429, { error: { message: 'Quota' } })));

    await expect(generateStructured(request)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      statusCode: 503,
    });
  });

  it('stops immediately if the API key is rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(401, { error: { message: 'Bad key' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateStructured(request)).rejects.toMatchObject({ code: 'AI_AUTH_FAILED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('extractJson', () => {
  it('finds JSON inside prose or code fences', () => {
    expect(extractJson('Here you go: {"a": 1} hope that helps')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a": 2}\n```')).toEqual({ a: 2 });
  });
});
