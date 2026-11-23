import { Router, type Request } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import * as service from './billing.service.js';
import { isValidSignature } from './paystack.js';

export const billingRouter = Router();

/**
 * POST /api/v1/billing/paystack/webhook: Paystack calls this, not the browser.
 * The body arrives raw (see app.ts) so the signature can be checked byte for byte.
 */
billingRouter.post('/paystack/webhook', async (req, res) => {
  const raw = req.body as Buffer;
  if (!Buffer.isBuffer(raw) || !isValidSignature(raw, req.get('x-paystack-signature'))) {
    res.status(401).end();
    return;
  }

  let event: { event?: string; data?: unknown };
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    res.status(400).end();
    return;
  }

  try {
    await service.handleWebhookEvent(event);
  } catch (err) {
    // A 500 makes Paystack retry later.
    logger.error({ err, event: event.event }, 'Could not process Paystack webhook');
    res.status(500).end();
    return;
  }
  res.status(200).end();
});

billingRouter.get('/', requireAuth, async (req, res) => {
  res.json({ billing: await service.getBillingSummary(req.auth!.userId) });
});

billingRouter.post('/checkout', requireAuth, async (req, res) => {
  res.json(await service.startCheckout(req.auth!.userId));
});

billingRouter.get(
  '/verify/:reference',
  requireAuth,
  async (req: Request<{ reference: string }>, res) => {
    const reference = req.params.reference;
    if (!/^[\w.-]{1,100}$/.test(reference)) {
      throw new AppError(400, 'That payment reference is not valid.', 'VALIDATION_ERROR');
    }
    res.json(await service.verifyCheckout(req.auth!.userId, reference));
  },
);

billingRouter.post('/manage', requireAuth, async (req, res) => {
  res.json(await service.getManageLink(req.auth!.userId));
});

billingRouter.post('/cancel', requireAuth, async (req, res) => {
  res.json({ billing: await service.cancelSubscription(req.auth!.userId) });
});
