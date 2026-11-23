import { Link } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Button';
import { useUsage } from '@/features/cv/api';
import { formatDate, scoreTone } from '@/features/cv/score';
import { useJobMatches } from '@/features/jobs/api';
import { useCoverLetters, useInterviewPreps } from '@/features/prep/api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

/** Every job match, with its cover letter and interview prep. */
export default function PrepPage() {
  const matches = useJobMatches();
  const letters = useCoverLetters();
  const preps = useInterviewPreps();
  const usage = useUsage();

  const letterFor = new Map(letters.data?.map((l) => [l.jobMatchId, l]));
  const prepFor = new Map(preps.data?.map((p) => [p.jobMatchId, p]));

  return (
    <div>
      <p className="text-sm text-brand-300">Prep</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
        Cover letters & interview prep
      </h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Pick a job you've matched your CV with. Ribra writes a tailored cover letter and coaches you
        on the questions you're likely to be asked.
      </p>

      {usage.data && usage.data.plan === 'free' && (
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <Pill label="Cover letters" counter={usage.data.coverLetter} />
          <Pill label="Interview prep sets" counter={usage.data.interviewPrep} />
          <Pill label="Answer reviews" counter={usage.data.answerFeedback} />
        </div>
      )}

      {matches.isLoading ? (
        <div className="flex justify-center py-24 text-brand-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : matches.error ? (
        <div className="mt-8">
          <Alert>
            {matches.error instanceof ApiError
              ? matches.error.message
              : 'We could not load your job matches.'}
          </Alert>
        </div>
      ) : !matches.data?.length ? (
        <section className="mt-8 rounded-2xl border border-dashed border-white/15 bg-surface/50 px-6 py-14 text-center">
          <h2 className="font-display text-xl font-semibold text-white">Start with a job match</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Paste a job description in Job Match first. Ribra uses it, together with your CV, to
            write your cover letter and predict your interview questions.
          </p>
          <Link
            to="/jobs"
            className="mt-6 inline-block rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Check a job match
          </Link>
        </section>
      ) : (
        <ul className="mt-8 space-y-3">
          {matches.data.map((m) => {
            const letter = letterFor.get(m.id);
            const prep = prepFor.get(m.id);
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-surface/70 px-5 py-4"
              >
                <Link to={`/jobs/${m.id}`} className="min-w-0 flex-1 hover:opacity-90">
                  <p className="truncate font-medium text-white">
                    {m.jobTitle}
                    {m.company && <span className="text-slate-400"> at {m.company}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <span className={scoreTone(m.matchScore).text}>{m.matchScore}% match</span> ·{' '}
                    {m.resumeTitle} · {formatDate(m.createdAt)}
                  </p>
                </Link>
                <div className="flex flex-wrap gap-2">
                  <ActionLink
                    to={`/jobs/${m.id}/cover-letter`}
                    done={Boolean(letter)}
                    label={letter ? 'Cover letter ✓' : 'Write cover letter'}
                  />
                  <ActionLink
                    to={`/jobs/${m.id}/interview`}
                    done={Boolean(prep)}
                    label={
                      prep
                        ? `Interview prep · ${prep.practisedCount}/${prep.questionCount}`
                        : 'Prep for interview'
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ActionLink({ to, done, label }: { to: string; done: boolean; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-lg px-3.5 py-2 text-sm font-semibold transition',
        done
          ? 'border border-success/30 bg-success/10 text-emerald-300 hover:bg-success/15'
          : 'border border-white/10 bg-white/5 text-white hover:bg-white/10',
      )}
    >
      {label}
    </Link>
  );
}

function Pill({
  label,
  counter,
}: {
  label: string;
  counter: { limit: number | null; remaining: number | null };
}) {
  if (counter.limit === null) return null;
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1',
        counter.remaining === 0
          ? 'border-warning/30 text-amber-300'
          : 'border-white/10 text-slate-400',
      )}
    >
      {label}: {counter.remaining} of {counter.limit} left this month
    </span>
  );
}
