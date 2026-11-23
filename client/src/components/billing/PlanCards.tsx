import type { ReactNode } from 'react';
import { featureLabels, formatNaira, planLimits, PRO_PRICE_NGN } from '@/features/billing/plans';
import { cn } from '@/lib/cn';

const extras = {
  free: ['Application tracker', 'Saved reports and letters'],
  pro: ['Everything in Free', '10× the AI limits for heavy job searches'],
};

/** Free vs Pro side by side. Used on the landing page and the plan page. */
export function PlanCards({
  current,
  freeAction,
  proAction,
}: {
  current?: 'free' | 'pro';
  freeAction?: ReactNode;
  proAction?: ReactNode;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PlanCard
        name="Free"
        price="₦0"
        note="Forever"
        limits={planLimits.free}
        extras={extras.free}
        current={current === 'free'}
        action={freeAction}
      />
      <PlanCard
        name="Pro"
        price={formatNaira(PRO_PRICE_NGN)}
        note="per month · cancel anytime"
        limits={planLimits.pro}
        extras={extras.pro}
        current={current === 'pro'}
        highlight
        action={proAction}
      />
    </div>
  );
}

function PlanCard({
  name,
  price,
  note,
  limits,
  extras,
  current,
  highlight,
  action,
}: {
  name: string;
  price: string;
  note: string;
  limits: Record<keyof typeof featureLabels, number>;
  extras: string[];
  current?: boolean;
  highlight?: boolean;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'relative flex flex-col rounded-2xl border p-6 text-left',
        highlight
          ? 'border-brand-400/50 bg-gradient-to-b from-brand-500/15 to-surface/80 shadow-xl shadow-brand-500/10'
          : 'border-white/10 bg-surface/70',
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-white">{name}</h3>
        {current && (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white">
            Your plan
          </span>
        )}
      </div>
      <p className="mt-3">
        <span className="font-display text-3xl font-bold text-white">{price}</span>{' '}
        <span className="text-sm text-slate-400">{note}</span>
      </p>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {(Object.keys(featureLabels) as Array<keyof typeof featureLabels>).map((key) => (
          <li key={key} className="flex justify-between gap-4 text-slate-300">
            <span>{featureLabels[key]}</span>
            <span className="font-medium text-white">{limits[key]}/mo</span>
          </li>
        ))}
        {extras.map((e) => (
          <li key={e} className="flex gap-2 text-slate-300">
            <span className="text-success">✓</span>
            {e}
          </li>
        ))}
      </ul>
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}
