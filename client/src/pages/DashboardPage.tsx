import { Link } from 'react-router';
import { useAnalyses, useUsage } from '@/features/cv/api';
import { useJobMatches } from '@/features/jobs/api';
import { TrackerSummary } from '@/components/applications/TrackerSummary';
import { formatDate, scoreTone } from '@/features/cv/score';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth';

const comingSoon = [
  {
    stage: 'Stage 6',
    title: 'Cover letters & interview prep',
    text: 'Tailored letters and practice questions.',
  },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)!;
  const analyses = useAnalyses();
  const matches = useJobMatches();
  const latestMatch = matches.data?.[0];
  const usage = useUsage();
  const firstName = user.name.split(' ')[0];
  const latest = analyses.data?.[0];
  const cvUsage = usage.data?.cvAnalysis;

  return (
    <div>
      <p className="text-sm text-brand-300">Dashboard</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
        Welcome, {firstName} 👋
      </h1>
      <p className="mt-2 max-w-2xl text-slate-400">Here's where your job search stands.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Latest CV score"
          value={latest ? `${latest.overallScore}/100` : 'Not analysed yet'}
          valueClass={latest ? scoreTone(latest.overallScore).text : undefined}
        />
        <Stat
          label="AI analyses this month"
          value={
            cvUsage
              ? cvUsage.limit === null
                ? `${cvUsage.used} used`
                : `${cvUsage.used} of ${cvUsage.limit} used`
              : '…'
          }
        />
        <Stat
          label="Latest job match"
          value={
            latestMatch ? `${latestMatch.matchScore}% · ${latestMatch.jobTitle}` : 'No matches yet'
          }
          valueClass={latestMatch ? scoreTone(latestMatch.matchScore).text : undefined}
        />
      </div>

      <section className="mt-8 rounded-2xl border border-brand-400/30 bg-gradient-to-br from-brand-500/15 to-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">
              {latest ? 'Keep improving your CV' : 'Start with your CV'}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              {latest
                ? `Your last report for "${latest.resumeTitle}" was on ${formatDate(latest.createdAt)}. Apply the fixes and re-analyze to see your score climb.`
                : 'Upload your CV and get an ATS score, specific fixes and rewritten bullet points in under a minute.'}
            </p>
          </div>
          <div className="flex gap-2">
            {latest && (
              <Link
                to={`/cv/reports/${latest.id}`}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                View last report
              </Link>
            )}
            <Link
              to="/cv"
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600"
            >
              {latest ? 'Open CV Analyzer' : 'Analyze my CV'}
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-surface/70 p-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Applying for a specific job?
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-300">
            Paste the job description to see your match score, missing keywords and how to tailor
            your CV.
          </p>
        </div>
        <Link
          to="/jobs"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          Check a job match
        </Link>
      </section>

      <TrackerSummary />

      <h2 className="mt-12 font-display text-lg font-semibold text-white">Coming next</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {comingSoon.map((item) => (
          <div key={item.title} className="rounded-card border border-white/10 bg-surface/70 p-5">
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-400">
              {item.stage}
            </span>
            <h3 className="mt-3 font-display text-base font-semibold text-white">{item.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-card border border-white/10 bg-surface/70 p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn('mt-1 font-display text-lg font-semibold text-white', valueClass)}>
        {value}
      </p>
    </div>
  );
}
