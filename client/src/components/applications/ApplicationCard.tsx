import { dueTone, relativeDay, statusMeta } from '@/features/applications/status';
import type { Application } from '@/features/applications/types';
import { scoreTone } from '@/features/cv/score';
import { cn } from '@/lib/cn';

const dueClass = {
  overdue: 'bg-danger/15 text-rose-300',
  soon: 'bg-warning/15 text-amber-300',
  later: 'bg-white/5 text-slate-300',
};

type Props = {
  application: Application;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  dragging: boolean;
};

/** One job on the tracker board. Click to edit, drag to another column to change its status. */
export function ApplicationCard({
  application: a,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: Props) {
  const showNextStep = (a.nextStep || a.nextStepAt) && a.status !== 'rejected';

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      aria-label={`${a.role} at ${a.company}, ${statusMeta[a.status].label}. Open to edit.`}
      className={cn(
        'group w-full cursor-grab rounded-xl border border-white/10 bg-ink/60 p-3.5 text-left transition hover:border-brand-400/40 hover:bg-ink focus-visible:outline-2 focus-visible:outline-brand-400 active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug text-white">{a.role}</p>
        {a.matchScore !== null && (
          <span
            title="Job match score"
            className={cn(
              'shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[11px] font-semibold',
              scoreTone(a.matchScore).text,
            )}
          >
            {a.matchScore}%
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm text-slate-400">
        {a.company}
        {a.location && <span className="text-slate-500"> · {a.location}</span>}
      </p>

      {showNextStep && (
        <p
          className={cn(
            'mt-3 inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs',
            a.nextStepAt ? dueClass[dueTone(a.nextStepAt)] : dueClass.later,
          )}
        >
          <span className="truncate">{a.nextStep || 'Next step'}</span>
          {a.nextStepAt && (
            <span className="shrink-0 font-medium">· {relativeDay(a.nextStepAt)}</span>
          )}
        </p>
      )}

      {a.appliedAt && a.status !== 'saved' && (
        <p className="mt-2 text-[11px] text-slate-500">
          Applied {relativeDay(a.appliedAt).toLowerCase()}
        </p>
      )}
    </button>
  );
}
