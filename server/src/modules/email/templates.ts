import type { EmailMessage } from './email.service.js';

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Simple, email-client-safe layout: inline styles, one table, one button. */
function layout(opts: {
  heading: string;
  intro: string;
  buttonText: string;
  url: string;
  footer: string;
}): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f4f7;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
        <tr><td>
          <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#5b4be8">Ribra</p>
          <h1 style="margin:0 0 12px;font-size:22px;color:#111827">${opts.heading}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563">${opts.intro}</p>
          <a href="${opts.url}" style="display:inline-block;background:#6d5ef5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">${opts.buttonText}</a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280">If the button doesn't work, copy this link into your browser:<br><a href="${opts.url}" style="color:#5b4be8;word-break:break-all">${opts.url}</a></p>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#9ca3af">${opts.footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function verifyEmailMessage(
  user: { name: string; email: string },
  url: string,
): EmailMessage {
  const firstName = escapeHtml(user.name.split(' ')[0] ?? user.name);
  return {
    to: { email: user.email, name: user.name },
    subject: 'Confirm your email for Ribra',
    html: layout({
      heading: `Welcome to Ribra, ${firstName}`,
      intro:
        'Please confirm your email address so we can keep your account secure and send you important updates.',
      buttonText: 'Confirm my email',
      url,
      footer:
        "This link expires in 24 hours. If you didn't create a Ribra account, you can ignore this email.",
    }),
    text: `Welcome to Ribra, ${user.name}!\n\nConfirm your email address by opening this link:\n${url}\n\nThis link expires in 24 hours. If you didn't create a Ribra account, ignore this email.`,
  };
}

export function resetPasswordMessage(
  user: { name: string; email: string },
  url: string,
): EmailMessage {
  return {
    to: { email: user.email, name: user.name },
    subject: 'Reset your Ribra password',
    html: layout({
      heading: 'Reset your password',
      intro:
        'We received a request to reset the password for your Ribra account. Click the button to choose a new one.',
      buttonText: 'Choose a new password',
      url,
      footer:
        "This link expires in 30 minutes and can be used once. If you didn't ask for this, you can ignore this email; your password won't change.",
    }),
    text: `Reset your Ribra password by opening this link:\n${url}\n\nThis link expires in 30 minutes and can be used once. If you didn't ask for this, ignore this email.`,
  };
}

export function passwordChangedMessage(
  user: { name: string; email: string },
  resetUrl: string,
): EmailMessage {
  return {
    to: { email: user.email, name: user.name },
    subject: 'Your Ribra password was changed',
    html: layout({
      heading: 'Your password was changed',
      intro:
        'The password for your Ribra account was just changed, and you were logged out on your other devices. If this was you, there is nothing else to do.',
      buttonText: "This wasn't me: reset my password",
      url: resetUrl,
      footer: 'For your security, we send this email every time your password changes.',
    }),
    text: `The password for your Ribra account was just changed, and you were logged out on your other devices.\n\nIf this wasn't you, reset your password now:\n${resetUrl}`,
  };
}
