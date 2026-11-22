import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * One small client for any OpenAI-compatible chat API (Gemini, Groq, OpenAI...).
 * Switching provider = changing AI_BASE_URL, AI_API_KEY and AI_MODELS. No code changes.
 *
 * What it adds on top of a plain API call:
 *  - model fallback: if a model is out of free quota / unavailable, try the next one
 *  - structured output: asks for JSON matching a Zod schema, then validates it
 *  - one repair attempt when the model returns invalid JSON
 */

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type StructuredRequest<T extends z.ZodType> = {
  /** Short name for the output, used by the provider and in logs, e.g. "cv_analysis". */
  name: string;
  schema: T;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type StructuredResult<T> = {
  data: T;
  model: string;
  totalTokens: number | null;
  durationMs: number;
};

type CallResult =
  | { ok: true; content: string; totalTokens: number | null }
  | { ok: false; status: number; message: string };

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

async function callModel(
  model: string,
  messages: ChatMessage[],
  options: {
    temperature: number;
    maxTokens: number;
    jsonSchema?: { name: string; schema: object };
  },
): Promise<CallResult> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    // Keep "thinking" short: faster answers and less quota used.
    reasoning_effort: 'low',
  };
  if (options.jsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: options.jsonSchema.name, schema: options.jsonSchema.schema },
    };
  }

  let res: Response;
  try {
    res = await fetch(`${env.aiBaseUrl}chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.AI_TIMEOUT_SECONDS * 1000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return { ok: false, status: timedOut ? 408 : 503, message: timedOut ? 'timeout' : String(err) };
  }

  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { total_tokens?: number };
    error?: { message?: string } | Array<{ error?: { message?: string } }>;
  } | null;

  if (!res.ok) {
    const error = Array.isArray(data?.error) ? data?.error[0]?.error : data?.error;
    return { ok: false, status: res.status, message: error?.message ?? res.statusText };
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) return { ok: false, status: 502, message: 'Empty response from model' };
  return { ok: true, content, totalTokens: data?.usage?.total_tokens ?? null };
}

/** Pulls a JSON object out of a reply, even if the model wrapped it in ```json fences or prose. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found');
  return JSON.parse(candidate.slice(start, end + 1));
}

function validate<T extends z.ZodType>(schema: T, content: string) {
  try {
    const parsed = schema.safeParse(extractJson(content));
    return parsed.success
      ? { ok: true as const, data: parsed.data as z.infer<T> }
      : { ok: false as const, problem: z.prettifyError(parsed.error) };
  } catch (err) {
    return { ok: false as const, problem: err instanceof Error ? err.message : 'Invalid JSON' };
  }
}

export async function generateStructured<T extends z.ZodType>(
  request: StructuredRequest<T>,
): Promise<StructuredResult<z.infer<T>>> {
  if (!env.AI_API_KEY) {
    throw new AppError(503, 'AI features are not set up on the server yet.', 'AI_NOT_CONFIGURED');
  }

  const started = Date.now();
  const temperature = request.temperature ?? 0.2;
  const maxTokens = request.maxTokens ?? 8192;
  const jsonSchema = { name: request.name, schema: toJsonSchema(request.schema) };

  for (const model of env.aiModels) {
    // 1st try: ask the provider to enforce our JSON schema.
    let result = await callModel(model, request.messages, { temperature, maxTokens, jsonSchema });

    // Some providers/models reject a schema they don't support: retry with the schema in the prompt only.
    if (!result.ok && result.status === 400) {
      logger.warn(
        { model, reason: result.message },
        'AI rejected response_format, retrying without it',
      );
      result = await callModel(model, request.messages, { temperature, maxTokens });
    }

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        logger.error({ model, status: result.status }, 'AI provider rejected the API key');
        throw new AppError(502, 'The AI provider rejected our API key.', 'AI_AUTH_FAILED');
      }
      // Out of free quota (429), unknown model (404), provider error (5xx) or timeout: try the next model.
      logger.warn(
        { model, status: result.status, reason: result.message },
        'AI model unavailable, trying next',
      );
      continue;
    }

    let checked = validate(request.schema, result.content);
    let totalTokens = result.totalTokens;

    // One repair attempt: show the model what was wrong and ask again.
    if (!checked.ok) {
      logger.warn(
        { model, problem: checked.problem },
        'AI returned invalid JSON, asking it to fix',
      );
      const repair = await callModel(
        model,
        [
          ...request.messages,
          { role: 'assistant', content: result.content },
          {
            role: 'user',
            content: `Your reply did not match the required JSON format:\n${checked.problem}\nReply again with ONLY the corrected JSON object.`,
          },
        ],
        { temperature: 0, maxTokens, jsonSchema },
      );
      if (repair.ok) {
        checked = validate(request.schema, repair.content);
        totalTokens = (totalTokens ?? 0) + (repair.totalTokens ?? 0);
      }
    }

    if (checked.ok) {
      const durationMs = Date.now() - started;
      logger.info({ name: request.name, model, durationMs, totalTokens }, 'AI request completed');
      return { data: checked.data, model, totalTokens, durationMs };
    }
  }

  throw new AppError(
    503,
    "Ribra's AI is busy right now (the free daily limit may be used up). Please try again later.",
    'AI_UNAVAILABLE',
  );
}
