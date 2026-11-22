import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { resendVerification } from '@/features/auth/api';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

/** Reminder shown inside the app until the user confirms their email address. */
export function VerifyEmailBanner() {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!user || user.emailVerified) return null;

  async function resend() {
    setState('sending');
    try {
      await resendVerification();
      setState('sent');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not send the email. Please try again.',
      );
      setState('error');
    }
  }

  return (
    <div className="border-b border-warning/20 bg-warning/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
        <p className="text-amber-100">
          {state === 'sent' ? (
            <>
              New link sent to <strong>{user.email}</strong>. Check your inbox (and spam folder).
            </>
          ) : state === 'error' ? (
            error
          ) : (
            <>
              Please confirm your email. We sent a link to <strong>{user.email}</strong>.
            </>
          )}
        </p>
        {state !== 'sent' && (
          <Button
            variant="ghost"
            className="py-1.5 text-amber-100"
            loading={state === 'sending'}
            onClick={resend}
          >
            Resend email
          </Button>
        )}
      </div>
    </div>
  );
}
