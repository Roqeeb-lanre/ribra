import { Link, useParams } from 'react-router';
import { ScoreRing } from '@/components/cv/ScoreRing';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CopyButton } from '@/components/ui/CopyButton';
import { useAnalysis } from '@/features/cv/api';
import { formatDate, scoreTone } from '@/features/cv/score';
import type { Analysis } from '@/features/cv/types';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

const scoreLabels: Array<{ key: keyof Analysis['scores']; label: string; hint: string }> = [
  { key: 'ats', label: 'ATS readiness', hint: 'Can hiring software read it?' },
  { key: 'impact', label: 'Impact', hint: 'Results, not just duties' },
  { key: 'skills', label: 'Skills match', hint: 'Relevant to the role' },
  { key: 'structure', label: 'Structure', hint: 'Order, format, length' },
  { key: 'clarity', label: 'Clarity', hint: 'Concise and easy to scan' },
];

const priorityStyle = {
  high: 'bg-danger/15 text-rose-200',
  medium: 'bg-warning/15 text-amber-200',
  low: 'bg-white/10 text-slate-300',
};

const levelLabel = { student: 'Student', entry: 'Entry level', mid: 'Mid level', senior: 'Senior' };

export default function AnalysisReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data: analysis, isLoading, error } = useAnalysis(id!);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24 text-brand-300">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="space-y-4">
        <Alert>
          {error instanceof ApiError ? error.message : 'We could not load this report.'}
        </Alert>
        <BackLink />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BackLink />

      {/* Overview */}
      <section className="grid gap-6 rounded-2xl border border-white/10 bg-surface/70 p-6 md:grid-cols-[auto_1fr] md:items-center md:p-8">
        <div className="flex justify-center">
          <ScoreRing score={analysis.overallScore} />
        </div>
        <div>
          <p className="text-sm text-slate-400">
            {analysis.resumeTitle} · {formatDate(analysis.createdAt)}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {analysis.targetRole
              ? `Your CV for ${analysis.targetRole}`
              : `Your CV as a ${analysis.detectedRole}`}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-brand-500/15 px-2.5 py-1 text-brand-200">
              {analysis.detectedRole}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-slate-300">
              {levelLabel[analysis.experienceLevel]}
            </span>
          </div>
          <p className="mt-4 leading-relaxed text-slate-300">{analysis.summary}</p>
        </div>
      </section>

      {/* Sub-scores */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {scoreLabels.map(({ key, label, hint }) => {
          const value = analysis.scores[key];
          const tone = scoreTone(value);
          return (
            <div key={key} className="rounded-card border border-white/10 bg-surface/70 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className={cn('font-display text-lg font-bold', tone.text)}>{value}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn('h-full rounded-full', tone.bar)}
                  style={{ width: `${value}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">{hint}</p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Improvements */}
        <Card title="What to fix first">
          <ol className="space-y-4">
            {analysis.improvements.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className={cn(
                    'mt-0.5 h-fit rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase',
                    priorityStyle[item.priority],
                  )}
                >
                  {item.priority}
                </span>
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* Strengths */}
        <Card title="What's working">
          <ul className="space-y-3">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
                <span className="text-success" aria-hidden>
                  ✓
                </span>
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Rewritten bullets */}
      {analysis.improvedBullets.length > 0 && (
        <Card
          title="Stronger bullet points"
          subtitle="Copy these into your CV. Replace anything in [brackets] with your real numbers."
        >
          <ul className="space-y-4">
            {analysis.improvedBullets.map((b, i) => (
              <li
                key={i}
                className="grid gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 md:grid-cols-2"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Before
                  </p>
                  <p className="mt-1 text-sm text-slate-400 line-through decoration-white/20">
                    {b.original}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-success">
                      After
                    </p>
                    <CopyButton text={b.improved} />
                  </div>
                  <p className="mt-1 text-sm text-white">{b.improved}</p>
                  <p className="mt-2 text-xs text-slate-500">{b.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sections */}
        <Card title="Section by section">
          <ul className="space-y-4">
            {analysis.sections.map((s, i) => (
              <li key={i}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{s.name}</p>
                  <p className={cn('text-sm font-semibold', scoreTone(s.score).text)}>{s.score}</p>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.feedback}</p>
              </li>
            ))}
          </ul>
        </Card>

        {/* Skills */}
        <Card title="Skills">
          <SkillGroup
            label="Technical"
            skills={analysis.skills.technical}
            className="bg-brand-500/15 text-brand-200"
          />
          <SkillGroup
            label="Soft skills"
            skills={analysis.skills.soft}
            className="bg-white/5 text-slate-300"
          />
          <SkillGroup
            label="Worth adding (if you have them)"
            skills={analysis.skills.missing}
            className="border border-dashed border-warning/40 text-amber-200"
          />
        </Card>
      </div>

      <p className="text-center text-xs text-slate-500">
        AI feedback can be wrong. Use your judgement. Analysed by {analysis.model}.
      </p>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/cv"
      className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
    >
      ← Back to CV Analyzer
    </Link>
  );
}

function SkillGroup({
  label,
  skills,
  className,
}: {
  label: string;
  skills: string[];
  className: string;
}) {
  if (skills.length === 0) return null;
  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span key={skill} className={cn('rounded-full px-2.5 py-1 text-xs', className)}>
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}
