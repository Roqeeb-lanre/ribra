import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { UserModel, currentPlan, type UserDocument } from '../users/user.model.js';
import { PaymentModel } from './payment.model.js';
import * as paystack from './paystack.js';

const DAY = 24 * 60 * 60 * 1000;
/** Extra days of Pro after the billing date, so a slow renewal doesn't cut anyone off. */
export const GRACE_DAYS = 3;

const addMonth = (d: Date) => {
  const next = new Date(d);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
};
const withGrace = (d: Date) => new Date(d.getTime() + GRACE_DAYS * DAY);
/** Never shorten Pro that is already paid for. */
const later = (a: Date | null | undefined, b: Date) => (a && a > b ? a : b);

export function priceKobo() {
  return env.PRO_PRICE_NGN * 100;
}

export async function getBillingSummary(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  const plan = currentPlan(user);
  const payments = await PaymentModel.find({ userId }).sort({ paidAt: -1 }).limit(12).lean();
  return {
    plan,
    proUntil: plan === 'pro' ? user.proUntil : null,
    status: user.billing?.status ?? null,
    nextPaymentAt: user.billing?.status === 'active' ? (user.billing.nextPaymentAt ?? null) : null,
    canCancel: Boolean(user.billing?.subscriptionCode) && user.billing?.status === 'active',
    canManage: Boolean(user.billing?.subscriptionCode),
    priceNgn: env.PRO_PRICE_NGN,
    paymentsEnabled: paystack.paystackConfigured(),
    payments: payments.map((p) => ({
      reference: p.reference,
      amountNgn: p.amount / 100,
      currency: p.currency,
      paidAt: p.paidAt,
    })),
  };
}

/** Starts a Paystack checkout for the monthly Pro plan. Returns the page to send the user to. */
export async function startCheckout(userId: string) {
  if (!paystack.paystackConfigured()) {
    throw new AppError(503, 'Payments are not set up yet.', 'PAYMENTS_NOT_CONFIGURED');
  }
  const user = await UserModel.findById(userId);
  if (!user) throw new AppError(401, 'You need to log in.', 'UNAUTHORIZED');
  if (currentPlan(user) === 'pro' && user.billing?.status === 'active') {
    throw new AppError(409, 'You are already on Pro.', 'ALREADY_PRO');
  }

  const { authorization_url } = await paystack.initializeTransaction({
    email: user.email,
    amountKobo: priceKobo(),
    planCode: env.PAYSTACK_PLAN_CODE!,
    callbackUrl: `${env.appUrl}/billing/callback`,
    metadata: { userId: user.id, cancel_action: `${env.appUrl}/billing` },
  });
  return { url: authorization_url };
}

function metadataUserId(meta: paystack.PaystackTransaction['metadata']): string | null {
  if (!meta) return null;
  const parsed =
    typeof meta === 'string'
      ? (() => {
          try {
            return JSON.parse(meta) as { userId?: string };
          } catch {
            return null;
          }
        })()
      : meta;
  const id = parsed?.userId;
  return id && Types.ObjectId.isValid(id) ? id : null;
}

const planCodeOf = (plan: paystack.PaystackTransaction['plan']) =>
  typeof plan === 'string' ? plan : (plan?.plan_code ?? null);

/** Finds whose payment this is: by our own user id first, then by Paystack customer, then email. */
async function findPayer(tx: {
  metadata?: paystack.PaystackTransaction['metadata'];
  customer?: Partial<paystack.PaystackCustomer>;
}): Promise<UserDocument | null> {
  const id = metadataUserId(tx.metadata);
  if (id) {
    const user = await UserModel.findById(id);
    if (user) return user;
  }
  if (tx.customer?.customer_code) {
    const user = await UserModel.findOne({ 'billing.customerCode': tx.customer.customer_code });
    if (user) return user;
  }
  if (tx.customer?.email) return UserModel.findOne({ email: tx.customer.email.toLowerCase() });
  return null;
}

/**
 * Records a successful Pro payment and gives a month of Pro.
 * Safe to call twice for the same payment (webhook + redirect, or webhook retries).
 * Returns the user, or null if the payment isn't a Pro payment we recognise.
 */
export async function applySuccessfulCharge(tx: paystack.PaystackTransaction) {
  if (tx.status !== 'success' || tx.currency !== 'NGN' || tx.amount < priceKobo()) return null;
  const planCode = planCodeOf(tx.plan);
  if (planCode && planCode !== env.PAYSTACK_PLAN_CODE) return null;

  const user = await findPayer(tx);
  if (!user) {
    logger.warn({ reference: tx.reference }, 'Paid charge with no matching Ribra user');
    return null;
  }
  // A charge without a plan only counts as a renewal from someone who already subscribed.
  if (!planCode && !user.billing?.subscriptionCode) {
    logger.warn({ reference: tx.reference }, 'Ignoring a charge that is not for Pro');
    return null;
  }

  const paidAt = new Date(tx.paid_at ?? tx.paidAt ?? Date.now());
  try {
    await PaymentModel.create({
      userId: user._id,
      reference: tx.reference,
      amount: tx.amount,
      currency: tx.currency,
      planCode,
      paidAt,
    });
  } catch (err) {
    // Already recorded: nothing more to do.
    if ((err as { code?: number }).code === 11000) return user;
    throw err;
  }

  user.plan = 'pro';
  user.proUntil = later(user.proUntil, withGrace(addMonth(paidAt)));
  user.set('billing.customerCode', tx.customer.customer_code);
  if (!user.billing?.status || user.billing.status === 'attention') {
    user.set('billing.status', 'active');
  }
  await user.save();
  logger.info({ userId: user.id, reference: tx.reference }, 'Pro payment recorded');
  return user;
}

/** After Paystack sends the user back, check the payment ourselves (never trust the URL). */
export async function verifyCheckout(userId: string, reference: string) {
  const tx = await paystack.verifyTransaction(reference);
  if (tx.status !== 'success') {
    return { ok: false as const, message: 'This payment was not completed.' };
  }
  const payerId = metadataUserId(tx.metadata);
  if (payerId && payerId !== userId) {
    throw new AppError(403, 'This payment belongs to another account.', 'FORBIDDEN');
  }
  const user = await applySuccessfulCharge(tx);
  if (!user || user.id !== userId) {
    return { ok: false as const, message: "We couldn't match this payment to your account." };
  }
  return { ok: true as const };
}

type SubscriptionEvent = {
  subscription_code?: string;
  email_token?: string;
  status?: string;
  next_payment_date?: string | null;
  customer?: Partial<paystack.PaystackCustomer>;
  plan?: paystack.PaystackPlan | string | null;
};

/** Keeps our copy of the Paystack subscription up to date. */
async function applySubscriptionEvent(event: string, data: SubscriptionEvent) {
  if (planCodeOf(data.plan ?? null) !== env.PAYSTACK_PLAN_CODE) return;
  const user = await findPayer({ customer: data.customer });
  if (!user) {
    logger.warn({ event, code: data.subscription_code }, 'Subscription event for unknown user');
    return;
  }

  if (data.subscription_code) user.set('billing.subscriptionCode', data.subscription_code);
  if (data.email_token) user.set('billing.emailToken', data.email_token);
  if (data.customer?.customer_code) user.set('billing.customerCode', data.customer.customer_code);

  const status =
    event === 'subscription.not_renew'
      ? 'non-renewing'
      : event === 'invoice.payment_failed'
        ? 'attention'
        : event === 'subscription.disable'
          ? data.status === 'complete' || data.status === 'completed'
            ? 'completed'
            : 'cancelled'
          : (data.status ?? 'active');
  user.set('billing.status', status);

  if (data.next_payment_date) {
    const next = new Date(data.next_payment_date);
    user.set('billing.nextPaymentAt', next);
    // While the subscription is running, Pro lasts until the next billing date (plus grace).
    if (status === 'active') {
      user.plan = 'pro';
      user.proUntil = later(user.proUntil, withGrace(next));
    }
  }
  await user.save();
}

/** Handles one verified webhook event from Paystack. */
export async function handleWebhookEvent(event: { event?: string; data?: unknown }) {
  const name = event.event ?? '';
  switch (name) {
    case 'charge.success':
      await applySuccessfulCharge(event.data as paystack.PaystackTransaction);
      break;
    case 'subscription.create':
    case 'subscription.not_renew':
    case 'subscription.disable':
      await applySubscriptionEvent(name, event.data as SubscriptionEvent);
      break;
    case 'invoice.update': {
      // Sent after each renewal attempt. A paid invoice moves the next billing date forward.
      const data = event.data as {
        paid?: boolean;
        status?: string;
        subscription?: SubscriptionEvent;
        customer?: SubscriptionEvent['customer'];
      };
      if (data.paid || data.status === 'success') {
        await applySubscriptionEvent(name, {
          ...data.subscription,
          status: 'active',
          customer: data.customer ?? data.subscription?.customer,
          plan: data.subscription?.plan ?? env.PAYSTACK_PLAN_CODE,
        });
      }
      break;
    }
    case 'invoice.payment_failed': {
      const data = event.data as {
        subscription?: SubscriptionEvent;
        customer?: SubscriptionEvent['customer'];
      };
      await applySubscriptionEvent(name, {
        ...data.subscription,
        customer: data.customer ?? data.subscription?.customer,
        plan: data.subscription?.plan ?? env.PAYSTACK_PLAN_CODE,
      });
      break;
    }
    default:
      // Other events (invoice.create, transfers...) aren't needed.
      break;
  }
}

/** Link to Paystack's page where the user can change their card or cancel. */
export async function getManageLink(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user?.billing?.subscriptionCode) {
    throw new AppError(404, 'You have no subscription to manage.', 'NOT_FOUND');
  }
  const { link } = await paystack.getSubscriptionManageLink(user.billing.subscriptionCode);
  return { url: link };
}

/** Stops future renewals. Pro stays until the end of the month already paid for. */
export async function cancelSubscription(userId: string) {
  const user = await UserModel.findById(userId).select('+billing.emailToken');
  if (!user?.billing?.subscriptionCode || !user.billing.emailToken) {
    throw new AppError(404, 'You have no active subscription.', 'NOT_FOUND');
  }
  if (user.billing.status !== 'active') {
    throw new AppError(409, 'Your subscription is already cancelled.', 'ALREADY_CANCELLED');
  }
  await paystack.disableSubscription(user.billing.subscriptionCode, user.billing.emailToken);
  user.set('billing.status', 'cancelled');
  // The paid month runs to the next billing date; drop the renewal grace days.
  if (user.billing.nextPaymentAt && user.proUntil && user.billing.nextPaymentAt < user.proUntil) {
    user.proUntil = user.billing.nextPaymentAt;
  }
  await user.save();
  return getBillingSummary(userId);
}
