import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Spinner } from '@/components/ui/Button';
import { verifyEmail } from '@/features/auth/api';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type State = { status: 'working' } | { status: 'done' } | { status: 'failed'; message: string };

/** Opened from the link in the confirmation email. Works whether or not the user is logged in. */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const loggedIn = useAuthStore((s) => s.status === 'authenticated');
  const [state, setState] = useState<State>(
    token ? { status: 'working' } : { status: 'failed', message: 'This link is missing its code.' },
  );

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => setState({ status: 'done' }))
      .catch((err) =>
        setState({
          status: 'failed',
          message:
            err instanceof ApiError ? err.message : "We couldn't reach Ribra. Please try again.",
        }),
      );
  }, [token]);

  const next = loggedIn
    ? { to: '/dashboard', label: 'Go to your dashboard' }
    : { to: '/login', label: 'Log in' };

  return (
    <AuthLayout
      title={
        state.status === 'working'
          ? 'Confirming your email…'
          : state.status === 'done'
            ? 'Email confirmed'
            : "That link didn't work"
      }
      subtitle={
        state.status === 'working'
          ? 'Just a moment.'
          : state.status === 'done'
            ? 'Thanks! Your Ribra account is fully set up.'
            : state.message
      }
      footer={<span>Need help? Reply to the email we sent you.</span>}
    >
      {state.status === 'working' ? (
        <div className="flex justify-center py-4 text-brand-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-3">
          <Link
            to={next.to}
            className="block rounded-lg bg-brand-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-600"
          >
            {next.label}
          </Link>
          {state.status === 'failed' && (
            <p className="text-center text-xs text-slate-500">
              {loggedIn
                ? 'You can send a new link from your dashboard.'
                : 'Log in to send yourself a new confirmation link.'}
            </p>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
