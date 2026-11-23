import { Link } from 'react-router';
import { scoreTone } from '@/features/cv/score';
import type { JobMatch } from '@/features/jobs/types';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth';

/** Top of the cover letter and interview prep pages: which job this is for. */
export function MatchHeader({
  match,
  eyebrow,
  description,
}: {
  match: JobMatch;
  eyebrow: string;
  description: string;
}) {
  return (
    <div>
      <Link
        to={`/jobs/${match.id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
      >
        ← Back to job match report
      </Link>
      <p className="mt-6 text-sm text-brand-300">{eyebrow}</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
        {match.jobTitle}
        {match.company && <span className="text-slate-400"> at {match.company}</span>}
      </h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        {description}{' '}
        <span className={cn('font-medium', scoreTone(match.matchScore).text)}>
          {match.matchScore}% match
        </span>{' '}
        with {match.resumeTitle}.
      </p>
    </div>
  );
}

export function UsageNote({
  counter,
  what,
}: {
  counter?: { limit: number | null; remaining: number | null };
  what: string;
}) {
  const plan = useAuthStore((st) => st.user?.plan);
  if (!counter || counter.limit === null) return null;
  return (
    <p className={cn('text-xs', counter.remaining === 0 ? 'text-warning' : 'text-slate-500')}>
      {counter.remaining} of {counter.limit} {plan === 'pro' ? '' : 'free '}
      {what} left this month
      {counter.remaining === 0 && plan !== 'pro' && (
        <>
          {' · '}
          <Link to="/billing" className="font-medium text-brand-300 hover:text-brand-200">
            Upgrade to Pro
          </Link>
        </>
      )}
    </p>
  );
}
