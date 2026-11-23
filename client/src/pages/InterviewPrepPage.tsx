import { useState } from 'react';
import { useParams } from 'react-router';
import { MatchHeader, UsageNote } from '@/components/prep/MatchHeader';
import { Alert } from '@/components/ui/Alert';
import { Button, Spinner } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { ProgressOverlay } from '@/components/ui/ProgressOverlay';
import { useUsage } from '@/features/cv/api';
import { useJobMatch } from '@/features/jobs/api';
import { useGenerateInterviewPrep, useInterviewPrep, useReviewAnswer } from '@/features/prep/api';
import type { AnswerFeedback, InterviewQuestion, QuestionCategory } from '@/features/prep/types';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

const MIN_ANSWER = 40;
const MAX_ANSWER = 4000;

const categoryInfo: Record<QuestionCategory, { label: string; className: string }> = {
  motivation: { label: 'Motivation', className: 'bg-sky-400/15 text-sky-300' },
  behavioural: { label: 'Behavioural', className: 'bg-brand-400/15 text-brand-200' },
  technical: { label: 'Technical', className: 'bg-amber-400/15 text-amber-300' },
  role: { label: 'Role', className: 'bg-emerald-400/15 text-emerald-300' },
};

const steps = [
  'Reading the job description…',
  'Thinking like the hiring manager…',
  'Finding the gaps they will ask about…',
  'Matching questions to your CV…',
  'Writing tips for each answer…',
];

export default function InterviewPrepPage() {
  const { id } = useParams<{ id: string }>();
  const match = useJobMatch(id!);
  const prep = useInterviewPrep(id!);
  const usage = useUsage();
  const generate = useGenerateInterviewPrep();

  if (match.isLoading || prep.isLoading) {
    return (
      <div className="flex justify-center py-24 text-brand-300">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (match.error || !match.data) {
    return (
      <Alert>
        {match.error instanceof ApiError ? match.error.message : 'We could not load this job.'}
      </Alert>
    );
  }

  const data = prep.data ?? null;
  const counter = usage.data?.interviewPrep;
  const practised = data?.questions.filter((q) => q.feedback).length ?? 0;

  function handleGenerate() {
    if (
      practised > 0 &&
      !window.confirm('Get new questions? Your practice answers and feedback will be replaced.')
    ) {
      return;
    }
    generate.mutate(id!);
  }

  return (
    <div>
      {generate.isPending && <ProgressOverlay title="Preparing your interview" steps={steps} />}

      <MatchHeader
        match={match.data}
        eyebrow="Interview prep"
        description="Practise the questions you're most likely to be asked, and get feedback on your answers."
      />

      {generate.isError && (
        <div className="mt-6">
          <Alert>
            {generate.error instanceof ApiError
              ? generate.error.message
              : "We couldn't prepare your questions. Please try again."}
          </Alert>
        </div>
      )}

      {!data ? (
        <section className="mt-8 rounded-2xl border border-dashed border-white/15 bg-surface/50 px-6 py-14 text-center">
          <h2 className="font-display text-xl font-semibold text-white">
            Know what they'll ask before you walk in
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
            Ribra predicts about 8 questions for this job, including the ones about your gaps, with
            tips and the parts of your CV to talk about. Then practise your answers and get a score
            and feedback on each.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button onClick={handleGenerate} disabled={counter?.remaining === 0}>
              Prepare my questions
            </Button>
            <UsageNote counter={counter} what="interview prep sets" />
          </div>
        </section>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-surface/70 px-5 py-4">
            <div className="min-w-[200px] flex-1">
              <p className="text-sm text-white">
                {practised} of {data.questions.length} questions practised
              </p>
              <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${(practised / data.questions.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="secondary"
                onClick={handleGenerate}
                disabled={counter?.remaining === 0}
              >
                Get new questions
              </Button>
              <UsageNote counter={usage.data?.answerFeedback} what="answer reviews" />
            </div>
          </div>

          <ol className="mt-6 space-y-4">
            {data.questions.map((q, i) => (
              <QuestionCard key={q.id} prepId={data.id} question={q} number={i + 1} />
            ))}
          </ol>

          <p className="mt-8 text-center text-xs text-slate-500">
            AI feedback can be wrong. Use it as a practice partner, not a verdict. Questions by{' '}
            {data.model}.
          </p>
        </>
      )}
    </div>
  );
}

function QuestionCard({
  prepId,
  question: q,
  number,
}: {
  prepId: string;
  question: InterviewQuestion;
  number: number;
}) {
  const [open, setOpen] = useState(number === 1);
  const [draft, setDraft] = useState(q.answer);
  const review = useReviewAnswer();
  const length = draft.trim().length;
  const changed = draft.trim() !== q.answer.trim();

  return (
    <li className="rounded-2xl border border-white/10 bg-surface/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-slate-300">
          {number}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
              categoryInfo[q.category].className,
            )}
          >
            {categoryInfo[q.category].label}
          </span>
          <span className="mt-1.5 block font-medium leading-snug text-white">{q.question}</span>
        </span>
        {q.feedback && <ScoreBadge score={q.feedback.score} />}
        <span aria-hidden className={cn('mt-1 text-slate-500 transition', open && 'rotate-180')}>
          ▾
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-white/5 px-5 pb-5 pt-4 sm:pl-16">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Why they ask
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{q.whyTheyAsk}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                How to answer
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{q.howToAnswer}</p>
            </div>
          </div>

          {q.cvPoints.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                From your CV, talk about
              </p>
              <ul className="mt-1.5 space-y-1">
                {q.cvPoints.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-brand-300">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label
              htmlFor={`answer-${q.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Practise your answer
            </label>
            <textarea
              id={`answer-${q.id}`}
              rows={6}
              maxLength={MAX_ANSWER}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your answer as you would say it in the interview…"
              className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                {length < MIN_ANSWER
                  ? `Write at least ${MIN_ANSWER} characters`
                  : `${length} characters`}
              </span>
              <Button
                onClick={() => review.mutate({ prepId, questionId: q.id, answer: draft.trim() })}
                loading={review.isPending}
                disabled={length < MIN_ANSWER || (!changed && Boolean(q.feedback))}
              >
                {review.isPending
                  ? 'Reviewing your answer…'
                  : q.feedback
                    ? 'Get new feedback'
                    : 'Get feedback'}
              </Button>
            </div>
            {review.isError && (
              <div className="mt-3">
                <Alert>
                  {review.error instanceof ApiError
                    ? review.error.message
                    : "We couldn't review your answer. Please try again."}
                </Alert>
              </div>
            )}
          </div>

          {q.feedback && <Feedback feedback={q.feedback} />}
        </div>
      )}
    </li>
  );
}

function scoreClass(score: number) {
  if (score >= 8) return 'bg-success/15 text-emerald-300';
  if (score >= 5) return 'bg-warning/15 text-amber-300';
  return 'bg-danger/15 text-rose-300';
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
        scoreClass(score),
      )}
    >
      {score}/10
    </span>
  );
}

function Feedback({ feedback }: { feedback: AnswerFeedback }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink/50 p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold',
            scoreClass(feedback.score),
          )}
        >
          {feedback.score}
        </span>
        <p className="text-sm leading-relaxed text-slate-200">{feedback.summary}</p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What works</p>
          <ul className="mt-1.5 space-y-1">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300">
                <span className="text-success">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Make it stronger
          </p>
          <ul className="mt-1.5 space-y-1">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300">
                <span className="text-warning">→</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            A stronger version
          </p>
          <CopyButton text={feedback.improvedAnswer} />
        </div>
        <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm leading-relaxed text-slate-200">
          {feedback.improvedAnswer}
        </p>
      </div>
    </div>
  );
}
