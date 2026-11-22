import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { UploadDropzone } from '@/components/cv/UploadDropzone';
import { Alert } from '@/components/ui/Alert';
import { Button, Spinner } from '@/components/ui/Button';
import { ProgressOverlay } from '@/components/ui/ProgressOverlay';
import {
  useAnalyses,
  useAnalyzeResume,
  useDeleteResume,
  useResumes,
  useUploadResume,
  useUsage,
} from '@/features/cv/api';
import { formatBytes, formatDate, scoreTone } from '@/features/cv/score';
import type { Resume } from '@/features/cv/types';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

const errorMessage = (err: unknown) =>
  err instanceof ApiError
    ? err.message
    : "We couldn't reach Ribra. Check your connection and try again.";

export default function CvAnalyzerPage() {
  const navigate = useNavigate();
  const resumes = useResumes();
  const analyses = useAnalyses();
  const usage = useUsage();
  const upload = useUploadResume();
  const analyze = useAnalyzeResume();
  const remove = useDeleteResume();

  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('');

  const remaining = usage.data?.cvAnalysis.remaining;
  const outOfAnalyses = remaining === 0;

  async function handleFile(file: File) {
    setError(null);
    try {
      const resume = await upload.mutateAsync(file);
      setSelectedId(resume.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleAnalyze(resume: Resume) {
    setError(null);
    try {
      const analysis = await analyze.mutateAsync({ resumeId: resume.id, targetRole });
      navigate(`/cv/reports/${analysis.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(resume: Resume) {
    if (!window.confirm(`Delete "${resume.title}" and all its reports? This can't be undone.`))
      return;
    setError(null);
    try {
      await remove.mutateAsync(resume.id);
      if (selectedId === resume.id) setSelectedId(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div>
      {analyze.isPending && <ProgressOverlay title="Analyzing your CV" steps={steps} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-brand-300">CV Analyzer</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            See your CV the way recruiters do
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Upload your CV to get an ATS score, section-by-section feedback and stronger bullet
            points.
          </p>
        </div>
        {usage.data && usage.data.cvAnalysis.limit !== null && (
          <span
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium',
              outOfAnalyses ? 'border-danger/40 text-rose-200' : 'border-white/10 text-slate-300',
            )}
          >
            {remaining} of {usage.data.cvAnalysis.limit} free analyses left this month
          </span>
        )}
      </div>

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-8">
        <UploadDropzone onFile={handleFile} uploading={upload.isPending} onInvalid={setError} />
        <p className="mt-2 text-center text-xs text-slate-500">
          Your phone number, email and links are removed before your CV is sent to the AI.
        </p>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-lg font-semibold text-white">Your CVs</h2>

        {resumes.isLoading ? (
          <div className="mt-6 flex justify-center text-brand-300">
            <Spinner className="h-5 w-5" />
          </div>
        ) : resumes.data?.length ? (
          <ul className="mt-4 space-y-3">
            {resumes.data.map((resume) => {
              const selected = selectedId === resume.id;
              return (
                <li
                  key={resume.id}
                  className={cn(
                    'rounded-card border bg-surface/70 p-4 transition',
                    selected ? 'border-brand-400/50' : 'border-white/10',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] font-semibold uppercase text-slate-300">
                        {resume.fileType}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{resume.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatBytes(resume.fileSize)} · {resume.wordCount} words · uploaded{' '}
                          {formatDate(resume.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {resume.latestScore !== null && (
                        <span
                          className={cn(
                            'mr-2 text-sm font-semibold',
                            scoreTone(resume.latestScore).text,
                          )}
                        >
                          {resume.latestScore}/100
                        </span>
                      )}
                      <Button
                        variant={selected ? 'secondary' : 'primary'}
                        onClick={() => setSelectedId(selected ? null : resume.id)}
                      >
                        {selected
                          ? 'Cancel'
                          : resume.latestScore === null
                            ? 'Analyze'
                            : 'Re-analyze'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleDelete(resume)}
                        aria-label={`Delete ${resume.title}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {selected && (
                    <form
                      className="mt-4 flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-end"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleAnalyze(resume);
                      }}
                    >
                      <label className="flex-1">
                        <span className="mb-1.5 block text-sm font-medium text-slate-300">
                          Target role <span className="font-normal text-slate-500">(optional)</span>
                        </span>
                        <input
                          value={targetRole}
                          onChange={(e) => setTargetRole(e.target.value)}
                          maxLength={100}
                          placeholder="e.g. Frontend Developer, Data Analyst"
                          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30"
                        />
                      </label>
                      <Button type="submit" loading={analyze.isPending} disabled={outOfAnalyses}>
                        Analyze with AI
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No CVs yet. Upload one above to get started.
          </p>
        )}
      </section>

      {analyses.data && analyses.data.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-lg font-semibold text-white">Past reports</h2>
          <ul className="mt-4 divide-y divide-white/5 overflow-hidden rounded-card border border-white/10 bg-surface/70">
            {analyses.data.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/cv/reports/${a.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{a.resumeTitle}</p>
                    <p className="text-xs text-slate-500">
                      {a.targetRole ? `For ${a.targetRole}` : a.detectedRole} ·{' '}
                      {formatDate(a.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn('font-display text-lg font-bold', scoreTone(a.overallScore).text)}
                  >
                    {a.overallScore}
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

const steps = [
  'Reading your CV…',
  'Checking how an ATS would parse it…',
  'Looking for measurable achievements…',
  'Comparing your skills with the role…',
  'Rewriting your weakest bullet points…',
  'Putting your report together…',
];
