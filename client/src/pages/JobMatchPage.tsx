import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button, Spinner } from '@/components/ui/Button';
import { ProgressOverlay } from '@/components/ui/ProgressOverlay';
import { useResumes, useUsage } from '@/features/cv/api';
import { formatDate, scoreTone } from '@/features/cv/score';
import { useCreateJobMatch, useJobMatches } from '@/features/jobs/api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

const MIN_CHARS = 150;
const MAX_CHARS = 15_000;

const steps = [
  'Reading the job description…',
  'Pulling out the keywords recruiters scan for…',
  'Checking which ones your CV already has…',
  'Judging your overall fit…',
  'Writing tailoring tips for this role…',
];

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30';

export default function JobMatchPage() {
  const navigate = useNavigate();
  const resumes = useResumes();
  const matches = useJobMatches();
  const usage = useUsage();
  const create = useCreateJobMatch();

  const [resumeId, setResumeId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Default to the most recent CV.
  const selectedResumeId = resumeId || resumes.data?.[0]?.id || '';
  const chars = jobDescription.trim().length;
  const remaining = usage.data?.jobMatch.remaining;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selectedResumeId) return setError('Upload a CV first.');
    if (chars < MIN_CHARS) return setError('Paste the full job description, not just the title.');

    try {
      const { match } = await create.mutateAsync({
        resumeId: selectedResumeId,
        jobDescription,
        jobTitle,
        company,
      });
      navigate(`/jobs/${match.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't reach Ribra. Check your connection and try again.",
      );
    }
  }

  return (
    <div>
      {create.isPending && <ProgressOverlay title="Matching your CV to this job" steps={steps} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-brand-300">Job Match</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            How well does your CV fit this job?
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Paste a job description to see your match score, the keywords you're missing and exactly
            how to tailor your CV.
          </p>
        </div>
        {usage.data && usage.data.jobMatch.limit !== null && (
          <span
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium',
              remaining === 0 ? 'border-danger/40 text-rose-200' : 'border-white/10 text-slate-300',
            )}
          >
            {remaining} of {usage.data.jobMatch.limit} {usage.data.plan === 'pro' ? '' : 'free '}
            matches left this month
            {remaining === 0 && usage.data.plan !== 'pro' && (
              <>
                {' · '}
                <Link to="/billing" className="text-brand-300 hover:text-brand-200">
                  Upgrade
                </Link>
              </>
            )}
          </span>
        )}
      </div>

      {resumes.isLoading ? (
        <div className="mt-10 flex justify-center text-brand-300">
          <Spinner className="h-5 w-5" />
        </div>
      ) : !resumes.data?.length ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-surface/50 p-8 text-center">
          <p className="font-medium text-white">First, upload your CV</p>
          <p className="mt-1 text-sm text-slate-400">
            Job Match compares a saved CV with the job you paste.
          </p>
          <Link
            to="/cv"
            className="mt-5 inline-block rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Upload a CV
          </Link>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-surface/70 p-6"
        >
          {error && <Alert>{error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">Your CV</span>
              <select
                value={selectedResumeId}
                onChange={(e) => setResumeId(e.target.value)}
                className={inputClass}
              >
                {resumes.data.map((r) => (
                  <option key={r.id} value={r.id} className="bg-surface">
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">
                Job title <span className="font-normal text-slate-500">(optional)</span>
              </span>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={120}
                placeholder="e.g. Frontend Developer"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">
                Company <span className="font-normal text-slate-500">(optional)</span>
              </span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={120}
                placeholder="e.g. Flutterwave"
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-slate-300">
              Job description
              <span
                className={cn(
                  'text-xs font-normal',
                  chars > MAX_CHARS ? 'text-danger' : 'text-slate-500',
                )}
              >
                {chars.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </span>
            </span>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={12}
              placeholder="Paste the whole job advert here: responsibilities, requirements, nice-to-haves…"
              className={cn(inputClass, 'resize-y leading-relaxed')}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Matching the same CV and job again is free; we reuse your saved result.
            </p>
            <Button
              type="submit"
              loading={create.isPending}
              disabled={remaining === 0 || chars > MAX_CHARS}
            >
              Check my match
            </Button>
          </div>
        </form>
      )}

      {matches.data && matches.data.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-lg font-semibold text-white">Past matches</h2>
          <ul className="mt-4 divide-y divide-white/5 overflow-hidden rounded-card border border-white/10 bg-surface/70">
            {matches.data.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/jobs/${m.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {m.jobTitle}
                      {m.company && <span className="text-slate-400"> · {m.company}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {m.resumeTitle} · {formatDate(m.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn('font-display text-lg font-bold', scoreTone(m.matchScore).text)}
                  >
                    {m.matchScore}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
