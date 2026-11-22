import { describe, expect, it } from 'vitest';
import { devOutbox, sendEmail } from '../src/modules/email/email.service.js';
import { resetPasswordMessage, verifyEmailMessage } from '../src/modules/email/templates.js';

describe('email templates', () => {
  it('include the link in both the HTML and plain-text versions', () => {
    const url = 'https://ribra.vercel.app/verify-email?token=abc123';
    const msg = verifyEmailMessage({ name: 'Ada Okafor', email: 'ada@example.com' }, url);

    expect(msg.subject).toBe('Confirm your email for Ribra');
    expect(msg.html).toContain(url);
    expect(msg.text).toContain(url);
    expect(msg.html).toContain('Welcome to Ribra, Ada');
  });

  it('escapes names so HTML in a name cannot inject content', () => {
    const msg = verifyEmailMessage(
      { name: '<script>alert(1)</script>', email: 'x@example.com' },
      'https://x',
    );
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
  });

  it('reset email says the link expires', () => {
    const msg = resetPasswordMessage({ name: 'Ada', email: 'ada@example.com' }, 'https://x/reset');
    expect(msg.text).toContain('30 minutes');
  });
});

describe('sendEmail without a provider', () => {
  it('keeps the email in the dev outbox instead of sending it', async () => {
    devOutbox.length = 0;
    await sendEmail({
      to: { email: 'a@example.com' },
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
    expect(devOutbox).toHaveLength(1);
  });
});
