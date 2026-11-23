/**
 * Creates Ribra's monthly Pro plan in your Paystack account:  npm run paystack:plan -w server
 * Uses PAYSTACK_SECRET_KEY and PRO_PRICE_NGN from server/.env, then prints the plan code
 * to put in PAYSTACK_PLAN_CODE (in server/.env and on Render).
 */
import { env } from '../src/config/env.js';
import { createPlan } from '../src/modules/billing/paystack.js';

async function main() {
  if (!env.PAYSTACK_SECRET_KEY) {
    console.error('✗ PAYSTACK_SECRET_KEY is not set in server/.env');
    process.exit(1);
  }
  const mode = env.PAYSTACK_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  if (env.PAYSTACK_PLAN_CODE) {
    console.log(
      `ℹ PAYSTACK_PLAN_CODE is already set (${env.PAYSTACK_PLAN_CODE}). Creating another one anyway.`,
    );
  }

  const plan = await createPlan({
    name: `Ribra Pro (₦${env.PRO_PRICE_NGN.toLocaleString('en-NG')}/month)`,
    amountKobo: env.PRO_PRICE_NGN * 100,
  });

  console.log(`✓ Created the ${mode} plan "${plan.name}"`);
  console.log('\nAdd this line to server/.env, and the same value on Render:\n');
  console.log(`PAYSTACK_PLAN_CODE=${plan.plan_code}\n`);
}

main().catch((err: Error) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
