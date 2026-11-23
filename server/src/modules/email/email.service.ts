import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export type EmailMessage = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  /** Extra email headers, e.g. List-Unsubscribe for reminder emails. */
  headers?: Record<string, string>;
};

/** Emails "sent" while no provider is configured (tests and local development read these). */
export const devOutbox: EmailMessage[] = [];

/**
 * Sends an email with Brevo's HTTP API.
 * Why HTTP and not SMTP: Render's free plan blocks outgoing SMTP ports (25, 465, 587).
 *
 * Without BREVO_API_KEY (local development, tests) the email is printed to the log instead,
 * so you can click the link straight from your terminal.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!env.BREVO_API_KEY || !env.EMAIL_FROM_ADDRESS) {
    devOutbox.push(message);
    if (!env.isTest) {
      logger.info(
        { to: message.to.email, subject: message.subject },
        `📧 Email not sent (no BREVO_API_KEY). Contents:\n${message.text}`,
      );
    }
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS },
      to: [message.to],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
      ...(message.headers ? { headers: message.headers } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo rejected the email (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  logger.info({ to: message.to.email, subject: message.subject }, 'Email sent');
}

/**
 * Sends without making the user wait or fail: if the email provider is down,
 * the sign-up still works and the user can press "resend" later.
 */
export function sendEmailInBackground(message: EmailMessage): void {
  sendEmail(message).catch((err) =>
    logger.error({ err, to: message.to.email }, 'Email failed to send'),
  );
}
