import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { sendEmail } from '../email/email.service.js';
import { reminderDigestMessage, type ReminderItem } from '../email/templates.js';
import {
  ApplicationModel,
  type ApplicationDocument,
  type ApplicationStatus,
} from '../applications/application.model.js';
import { UserModel } from '../users/user.model.js';

const DAY = 24 * 60 * 60 * 1000;
/** Only open applications get reminders. */
const OPEN_STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interview'];

/**
 * Next-step dates are calendar days stored as midnight UTC ("2026-12-02T00:00:00Z").
 * This returns today's calendar day in the reminder time zone, in the same form.
 */
export function startOfToday(now = new Date(), timeZone = env.REMINDER_TIMEZONE): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // "2026-12-02"
  return new Date(`${ymd}T00:00:00.000Z`);
}

// ---- Unsubscribe links: "<userId>.<signature>", so nobody can unsubscribe someone else ----

function sign(userId: string): string {
  return crypto
    .createHmac('sha256', env.jwtAccessSecret)
    .update(`reminders:${userId}`)
    .digest('base64url');
}

export function unsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function userIdFromUnsubscribeToken(token: string): string | null {
  const [userId, signature] = token.split('.');
  if (!userId || !signature || !Types.ObjectId.isValid(userId)) return null;
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
    ? userId
    : null;
}

export async function unsubscribe(token: string): Promise<boolean> {
  const userId = userIdFromUnsubscribeToken(token);
  if (!userId) return false;
  await UserModel.updateOne({ _id: userId }, { $set: { emailReminders: false } });
  return true;
}

/**
 * Emails each user one digest of the next steps due today or tomorrow.
 * Each step is reminded once: if the user moves the date, it will be reminded again.
 * Safe to run more than once a day.
 */
export async function sendDueReminders(now = new Date()) {
  const today = startOfToday(now);
  const dayAfterTomorrow = new Date(today.getTime() + 2 * DAY);

  // Skip steps already reminded for this exact date.
  const notYetReminded = { $expr: { $ne: ['$reminderSentFor', '$nextStepAt'] } };
  const due: ApplicationDocument[] = await ApplicationModel.find({
    status: { $in: OPEN_STATUSES },
    nextStepAt: { $gte: today, $lt: dayAfterTomorrow },
    ...notYetReminded,
  })
    .sort({ nextStepAt: 1 })
    .limit(5000);

  const byUser = new Map<string, ApplicationDocument[]>();
  for (const app of due) {
    const key = app.userId.toString();
    byUser.set(key, [...(byUser.get(key) ?? []), app]);
  }

  const users = await UserModel.find({
    _id: { $in: [...byUser.keys()] },
    emailVerified: true,
    emailReminders: { $ne: false },
  });

  let emails = 0;
  let failed = 0;
  for (const user of users) {
    const apps = byUser.get(user.id) ?? [];
    const items: ReminderItem[] = apps.map((a) => ({
      role: a.role,
      company: a.company,
      nextStep: a.nextStep ?? '',
      when: a.nextStepAt!.getTime() === today.getTime() ? 'Today' : 'Tomorrow',
      url: `${env.appUrl}/applications?open=${a.id}`,
    }));

    try {
      await sendEmail(
        reminderDigestMessage(user, items, {
          tracker: `${env.appUrl}/applications`,
          unsubscribe: `${env.appUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken(user.id))}`,
        }),
      );
    } catch (err) {
      failed++;
      logger.error({ err, userId: user.id }, 'Reminder email failed');
      continue; // Not marked as sent, so the next run tries again.
    }

    emails++;
    await ApplicationModel.bulkWrite(
      apps.map((a) => ({
        updateOne: {
          filter: { _id: a._id, nextStepAt: a.nextStepAt },
          update: { $set: { reminderSentFor: a.nextStepAt } },
        },
      })),
    );
  }

  const result = { date: today.toISOString().slice(0, 10), due: due.length, emails, failed };
  logger.info(result, 'Reminder run finished');
  return result;
}
