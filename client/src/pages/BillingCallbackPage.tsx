import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Spinner } from '@/components/ui/Button';
import { useRefreshPlan, useVerifyPayment } from '@/features/billing/api';
import { ApiError } from '@/lib/api';

/** Paystack sends the user here after checkout, with ?reference=... in the URL. */
export default function BillingCallbackPage() {
  const [params] = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref') ?? '';
  const verify = useVerifyPayment(reference);
  const refreshPlan = useRefreshPlan();
  const ok = verify.data?.ok === true;

  useEffect(() => {
    if (ok) void refreshPlan();
    // Run once when the payment is confirmed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);

  let title: string;
  let text: string;
  if (!reference) {
    title = 'No payment to check';
    text = "This page is opened by Paystack after you pay. If you've just paid, check your plan.";
  } else if (verify.isLoading) {
    title = 'Confirming your payment…';
    text = 'Checking with Paystack. This takes a few seconds.';
  } else if (ok) {
    title = 'Welcome to Ribra Pro 🎉';
    text = 'Your payment went through and your higher limits are active now.';
  } else {
    title = "We couldn't confirm this payment";
    text =
      verify.data?.message ??
      (verify.error instanceof ApiError
        ? verify.error.message
        : 'If money left your account, it will show on your plan page shortly once Paystack tells us.');
  }

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      {verify.isLoading ? (
        <div className="flex justify-center text-brand-300">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
            ok ? 'bg-success/15 text-success' : 'bg-white/5 text-slate-300'
          }`}
        >
          {ok ? '✓' : '!'}
        </div>
      )}
      <h1 className="mt-6 font-display text-2xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-slate-400">{text}</p>
      {!verify.isLoading && (
        <div className="mt-8 flex justify-center gap-2">
          <Link
            to={ok ? '/dashboard' : '/billing'}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            {ok ? 'Go to dashboard' : 'Back to my plan'}
          </Link>
        </div>
      )}
    </div>
  );
}
