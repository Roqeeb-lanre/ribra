/**
 * Checks your AI setup:  npm run ai:check -w server
 *  1. Lists the models your API key can use.
 *  2. Sends a tiny test request to each model in AI_MODELS.
 */
import { env } from '../src/config/env.js';

async function main() {
  if (!env.AI_API_KEY) {
    console.error('✗ AI_API_KEY is not set in server/.env');
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' };

  const list = await fetch(`${env.aiBaseUrl}models`, { headers });
  if (!list.ok) {
    console.error(
      `✗ Could not list models (HTTP ${list.status}). Check that AI_API_KEY is correct.`,
    );
    console.error(await list.text());
    process.exit(1);
  }
  const { data } = (await list.json()) as { data: Array<{ id: string }> };
  const ids = data.map((m) => m.id.replace(/^models\//, ''));
  const textModels = ids.filter(
    (id) => /flash|pro|lite/i.test(id) && !/image|tts|audio|live|embed/i.test(id),
  );
  console.log(`✓ API key works. ${ids.length} models available. Text models include:`);
  console.log(`  ${textModels.slice(0, 25).join(', ')}\n`);

  console.log(`Testing AI_MODELS in order: ${env.aiModels.join(' → ')}`);
  for (const model of env.aiModels) {
    const started = Date.now();
    const res = await fetch(`${env.aiBaseUrl}chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with the word OK.' }],
        max_tokens: 200,
      }),
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (res.ok) {
      console.log(`  ✓ ${model} works (${seconds}s)`);
    } else {
      const body = await res.text();
      const reason =
        res.status === 429
          ? 'out of free quota for now'
          : res.status === 404
            ? 'not available'
            : body.slice(0, 160);
      console.log(`  ✗ ${model}: HTTP ${res.status} (${reason})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
