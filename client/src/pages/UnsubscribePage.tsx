import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Spinner } from '@/components/ui/Button';
import { ApiError, apiRequest } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

// One request per token, even though React runs effects twice in development.
const requests = new Map<string, Promise<unknown>>();

/** Opened from "Turn off reminder emails" in a reminder. Works without logging in. */
export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const loggedIn = useAuthStore((s) => s.status === 'authenticated');
  const [state, setState] = useState<'working' | 'done' | 'failed'>(token ? 'working' : 'failed');
  const [message, setMessage] = useState('This link is missing its code.');

  useEffect(() => {
    if (!token) return;
    if (!requests.has(token)) {
      requests.set(
        token,
        apiRequest('/reminders/unsubscribe', { method: 'POST', body: { token }, auth: false }),
      );
    }
    requests
      .get(token)!
      .then(() => {
        setState('done');
        // Keep the Settings switch in step if this person is logged in here.
        const { user, setUser } = useAuthStore.getState();
        if (user) setUser({ ...user, emailReminders: false });
      })
      .catch((err) => {
        setMessage(err instanceof ApiError ? err.message : "We couldn't reach Ribra. Try again.");
        setState('failed');
      });
  }, [token]);

  return (
    <AuthLayout
      title={
        state === 'working'
          ? 'Updating your settings…'
          : state === 'done'
            ? 'Reminder emails turned off'
            : "That link didn't work"
      }
      subtitle={
        state === 'done'
          ? "You won't get next-step reminders any more. You can turn them back on in Settings."
          : state === 'failed'
            ? `${message} You can also turn reminders off in Settings.`
            : 'Just a moment.'
      }
      footer={<span>Account emails, like password resets, are not affected.</span>}
    >
      {state === 'working' ? (
        <div className="flex justify-center py-4 text-brand-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <Link
          to={loggedIn ? '/settings' : '/login'}
          className="block rounded-lg bg-brand-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-600"
        >
          {loggedIn ? 'Open settings' : 'Log in'}
        </Link>
      )}
    </AuthLayout>
  );
}
