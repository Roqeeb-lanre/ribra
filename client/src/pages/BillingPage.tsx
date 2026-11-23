import { Alert } from '@/components/ui/Alert';
import { Button, Spinner } from '@/components/ui/Button';
import { PlanCards } from '@/components/billing/PlanCards';
import {
  useBilling,
  useCancelSubscription,
  useCheckout,
  useManageSubscription,
  type Billing,
} from '@/features/billing/api';
import { featureLabels, formatNaira } from '@/features/billing/plans';
import { useUsage } from '@/features/cv/api';
import { formatDate } from '@/features/cv/score';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

export default function BillingPage() {
  const billing = useBilling();
  const usage = useUsage();
  const checkout = useCheckout();
  const manage = useManageSubscription();
  const cancel = useCancelSubscription();

  if (billing.isLoading) {
    return (
      <div className="flex justify-center py-24 text-brand-300">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (billing.error || !billing.data) {
    return <Alert>{errorText(billing.error, 'We could not load your plan.')}</Alert>;
  }

  const b = billing.data;
  const isPro = b.plan === 'pro';

  function handleCancel() {
    const until = b.proUntil ? formatDate(b.proUntil) : 'the end of this month';
    if (window.confirm(`Cancel Pro? You'll keep Pro until ${until}, and won't be charged again.`)) {
      cancel.mutate();
    }
  }

  const upgradeButton = !b.paymentsEnabled ? (
    <p className="text-center text-xs text-slate-500">Payments aren't switched on yet.</p>
  ) : isPro ? null : (
    <Button className="w-full" onClick={() => checkout.mutate()} loading={checkout.isPending}>
      Upgrade to Pro · {formatNaira(b.priceNgn)}/month
    </Button>
  );

  return (
    <div>
      <p className="text-sm text-brand-300">Plan & billing</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
        {isPro ? "You're on Pro" : 'Get more from Ribra with Pro'}
      </h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        {isPro
          ? 'Thanks for supporting Ribra. Your higher limits are active.'
          : 'Pro gives you ten times the AI limits for a full job search. Pay securely with Paystack and cancel anytime.'}
      </p>

      {(checkout.isError || manage.isError || cancel.isError) && (
        <div className="mt-6">
          <Alert>
            {errorText(
              checkout.error ?? manage.error ?? cancel.error,
              'Something went wrong. Please try again.',
            )}
          </Alert>
        </div>
      )}

      {isPro && <SubscriptionCard billing={b} />}
      {isPro && (
        <div className="mt-4 flex flex-wrap gap-2">
          {b.canManage && (
            <Button variant="secondary" onClick={() => manage.mutate()} loading={manage.isPending}>
              Change card
            </Button>
          )}
          {b.canCancel && (
            <Button
              variant="ghost"
              className="text-rose-300 hover:text-rose-200"
              onClick={handleCancel}
              loading={cancel.isPending}
            >
              Cancel subscription
            </Button>
          )}
          {!b.canCancel && b.paymentsEnabled && b.status !== 'active' && (
            <Button onClick={() => checkout.mutate()} loading={checkout.isPending}>
              Restart subscription
            </Button>
          )}
        </div>
      )}

      {usage.data && (
        <section className="mt-8 rounded-2xl border border-white/10 bg-surface/70 p-6">
          <h2 className="font-display text-lg font-semibold text-white">This month's usage</h2>
          <p className="mt-1 text-sm text-slate-400">Limits reset on the 1st of every month.</p>
          <ul className="mt-5 space-y-4">
            {(Object.keys(featureLabels) as Array<keyof typeof featureLabels>).map((key) => {
              const c = usage.data[key];
              const pct = c.limit ? Math.min(100, (c.used / c.limit) * 100) : 0;
              return (
                <li key={key}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">{featureLabels[key]}</span>
                    <span className="text-slate-400">
                      {c.used} / {c.limit ?? '∞'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-brand-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="mt-10 font-display text-lg font-semibold text-white">Plans</h2>
      <div className="mt-4">
        <PlanCards current={b.plan} proAction={upgradeButton} />
      </div>

      {b.payments.length > 0 && (
        <section className="mt-8 rounded-2xl border border-white/10 bg-surface/70 p-6">
          <h2 className="font-display text-lg font-semibold text-white">Payments</h2>
          <ul className="mt-4 divide-y divide-white/5 text-sm">
            {b.payments.map((p) => (
              <li key={p.reference} className="flex justify-between gap-4 py-2.5">
                <span className="text-slate-300">{formatDate(p.paidAt)}</span>
                <span className="truncate text-xs text-slate-500">{p.reference}</span>
                <span className="font-medium text-white">{formatNaira(p.amountNgn)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-slate-500">
        Payments are processed by Paystack. Ribra never sees or stores your card details.
      </p>
    </div>
  );
}

function SubscriptionCard({ billing: b }: { billing: Billing }) {
  const until = b.proUntil ? formatDate(b.proUntil) : null;
  const message =
    b.status === 'active' && b.nextPaymentAt
      ? `Renews on ${formatDate(b.nextPaymentAt)} for ${formatNaira(b.priceNgn)}.`
      : b.status === 'attention'
        ? `Your last renewal payment failed. Paystack will try again; update your card to keep Pro after ${until}.`
        : until
          ? `Your subscription won't renew. Pro stays active until ${until}.`
          : 'Pro is active.';

  return (
    <section
      className={cn(
        'mt-8 rounded-2xl border p-6',
        b.status === 'attention'
          ? 'border-warning/40 bg-warning/10'
          : 'border-brand-400/40 bg-gradient-to-br from-brand-500/15 to-surface/70',
      )}
    >
      <p className="flex items-center gap-2 font-display text-lg font-semibold text-white">
        <span className="rounded-md bg-brand-500 px-2 py-0.5 text-xs font-bold uppercase">Pro</span>
        Ribra Pro
      </p>
      <p className="mt-2 text-sm text-slate-300">{message}</p>
    </section>
  );
}
