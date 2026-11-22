import { Link, useNavigate, useParams } from 'react-router';
import { ScoreRing } from '@/components/cv/ScoreRing';
import { Alert } from '@/components/ui/Alert';
import { Button, Spinner } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyButton } from '@/components/ui/CopyButton';
import { formatDate, scoreTone } from '@/features/cv/score';
import { useDeleteJobMatch, useJobMatch } from '@/features/jobs/api';
import { useApplications, useTrackJobMatch } from '@/features/applications/api';
import type { JobKeyword } from '@/features/jobs/types';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

export default function JobMatchReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: match, isLoading, error } = useJobMatch(id!);
  const remove = useDeleteJobMatch();
  const applications = useApplications();
  const track = useTrackJobMatch();
  const tracked = applications.data?.find((a) => a.jobMatchId === id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24 text-brand-300">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="space-y-4">
        <Alert>{error instanceof ApiError ? error.message : 'We could not load this match.'}</Alert>
        <BackLink />
      </div>
    );
  }

  const required = match.keywords.filter((k) => k.importance === 'required');
  const preferred = match.keywords.filter((k) => k.importance === 'preferred');
  const missingRequired = required.filter((k) => !k.found).length;

  async function handleTrack() {
    // A failure is shown in the alert under the buttons.
    const result = await track.mutateAsync(match!.id).catch(() => null);
    if (result) navigate(`/applications?open=${result.application.id}`);
  }

  async function handleDelete() {
    if (!window.confirm('Delete this job match?')) return;
    await remove.mutateAsync(match!.id);
    navigate('/jobs', { replace: true });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <BackLink />
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleDelete} loading={remove.isPending}>
            Delete
          </Button>
          {tracked ? (
            <Link
              to={`/applications?open=${tracked.id}`}
              className="rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-success/15"
            >
              ✓ Tracked · View in tracker
            </Link>
          ) : (
            <Button
              onClick={handleTrack}
              loading={track.isPending}
              disabled={applications.isLoading}
            >
              Track this job
            </Button>
          )}
        </div>
      </div>
      {track.isError && (
        <Alert>
          {track.error instanceof ApiError
            ? track.error.message
            : "We couldn't add this job to your tracker. Please try again."}
        </Alert>
      )}

      {/* Overview */}
      <section className="grid gap-6 rounded-2xl border border-white/10 bg-surface/70 p-6 md:grid-cols-[auto_1fr] md:items-center md:p-8">
        <div className="flex flex-col items-center gap-2">
          <ScoreRing score={match.matchScore} />
          <span className="text-xs text-slate-500">Match score</span>
        </div>
        <div>
          <p className="text-sm text-slate-400">
            {match.resumeTitle} · {formatDate(match.createdAt)}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {match.jobTitle}
            {match.company && <span className="text-slate-400"> at {match.company}</span>}
          </h1>
          <p className="mt-4 leading-relaxed text-slate-300">{match.verdict}</p>

          <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
            <Metric
              label="Keyword coverage"
              value={match.keywordCoverage}
              hint="Checked in your CV text"
            />
            <Metric label="Overall fit" value={match.fitScore} hint="AI judgement of experience" />
          </div>
        </div>
      </section>

      {/* Keywords */}
      <Card
        title="Keywords recruiters will scan for"
        subtitle={
          missingRequired > 0
            ? `${missingRequired} required keyword${missingRequired === 1 ? ' is' : 's are'} missing from your CV. Add them only if you genuinely have the skill.`
            : 'Your CV covers every required keyword.'
        }
      >
        <KeywordGroup label="Required" keywords={required} />
        <KeywordGroup label="Nice to have" keywords={preferred} />
        <p className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span>
            <span className="text-success">✓</span> found in your CV
          </span>
          <span>
            <span className="text-warning">+</span> missing
          </span>
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Why you're a good fit">
          <List items={match.strengths} icon="✓" iconClass="text-success" />
        </Card>
        <Card title="Gaps to address">
          <List items={match.gaps} icon="!" iconClass="text-warning" />
        </Card>
      </div>

      <Card title="Tailor your CV for this job">
        <ol className="space-y-4">
          {match.tailoringTips.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 h-fit shrink-0 rounded-md bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-brand-200">
                {t.section}
              </span>
              <p className="text-sm leading-relaxed text-slate-300">{t.tip}</p>
            </li>
          ))}
        </ol>
      </Card>

      {match.suggestedSummary && (
        <Card
          title="Suggested summary for this role"
          subtitle="Written only from facts in your CV. Edit it to sound like you."
          action={<CopyButton text={match.suggestedSummary} />}
        >
          <p className="rounded-xl border border-white/5 bg-white/[0.02] p-4 leading-relaxed text-white">
            {match.suggestedSummary}
          </p>
        </Card>
      )}

      <details className="rounded-2xl border border-white/10 bg-surface/70 p-6">
        <summary className="cursor-pointer font-display text-sm font-semibold text-slate-300">
          Job description you pasted
        </summary>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">
          {match.jobDescription}
        </p>
      </details>

      <p className="text-center text-xs text-slate-500">
        Match score = 60% AI fit judgement + 40% keyword coverage. AI feedback can be wrong.
        Analysed by {match.model}.
      </p>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/jobs"
      className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
    >
      ← Back to Job Match
    </Link>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  const tone = scoreTone(value);
  return (
    <div className="rounded-card border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={cn('font-display font-bold', tone.text)}>{value}%</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

function KeywordGroup({ label, keywords }: { label: string; keywords: JobKeyword[] }) {
  if (keywords.length === 0) return null;
  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {keywords.map((k) => (
          <span
            key={k.keyword}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs',
              k.found
                ? 'bg-success/15 text-emerald-200'
                : 'border border-dashed border-warning/50 text-amber-200',
            )}
          >
            <span aria-hidden>{k.found ? '✓ ' : '+ '}</span>
            {k.keyword}
            <span className="sr-only">{k.found ? ' (found)' : ' (missing)'}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function List({ items, icon, iconClass }: { items: string[]; icon: string; iconClass: string }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
          <span className={cn('font-semibold', iconClass)} aria-hidden>
            {icon}
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
