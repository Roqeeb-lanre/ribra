import { Link } from 'react-router';
import { useApplications } from '@/features/applications/api';
import { daysFromToday, dueTone, relativeDay, statusMeta } from '@/features/applications/status';
import { STATUSES } from '@/features/applications/types';
import { cn } from '@/lib/cn';

const dueText = { overdue: 'text-rose-300', soon: 'text-amber-300', later: 'text-slate-400' };

/** Dashboard card: how many jobs are in each column, and the next steps coming up. */
export function TrackerSummary() {
  const { data: applications } = useApplications();
  if (!applications) return null;

  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, applications.filter((a) => a.status === s).length]),
  );

  // Open jobs with a dated next step: overdue ones first, then the soonest.
  const upcoming = applications
    .filter((a) => a.nextStepAt && a.status !== 'rejected' && a.status !== 'offer')
    .filter((a) => daysFromToday(a.nextStepAt!) <= 14)
    .sort((x, y) => Date.parse(x.nextStepAt!) - Date.parse(y.nextStepAt!))
    .slice(0, 4);

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-surface/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Your applications</h2>
          <p className="mt-1 text-sm text-slate-300">
            {applications.length === 0
              ? 'Track every job you apply for, from saved to offer.'
              : 'Where every job you are tracking stands.'}
          </p>
        </div>
        <Link
          to="/applications"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          {applications.length === 0 ? 'Start tracking' : 'Open tracker'}
        </Link>
      </div>

      {applications.length > 0 && (
        <>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {STATUSES.map((s) => (
              <div key={s} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta[s].dot)} />
                  <span className="truncate">{statusMeta[s].label}</span>
                </p>
                <p className="mt-0.5 font-display text-xl font-semibold text-white">{counts[s]}</p>
              </div>
            ))}
          </div>

          {upcoming.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Coming up
              </p>
              <ul className="mt-2 divide-y divide-white/5">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/applications?open=${a.id}`}
                      className="flex items-center justify-between gap-4 py-2.5 text-sm hover:text-white"
                    >
                      <span className="min-w-0 truncate text-slate-200">
                        {a.nextStep || 'Next step'}
                        <span className="text-slate-500">
                          {' '}
                          · {a.role} at {a.company}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-xs font-medium',
                          dueText[dueTone(a.nextStepAt!)],
                        )}
                      >
                        {relativeDay(a.nextStepAt!)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
