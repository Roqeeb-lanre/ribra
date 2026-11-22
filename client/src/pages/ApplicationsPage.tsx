import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApplicationCard } from '@/components/applications/ApplicationCard';
import { ApplicationDialog } from '@/components/applications/ApplicationDialog';
import { Alert } from '@/components/ui/Alert';
import { Button, Spinner } from '@/components/ui/Button';
import { useApplications, useMoveApplication } from '@/features/applications/api';
import { statusMeta } from '@/features/applications/status';
import { STATUSES, type Application, type ApplicationStatus } from '@/features/applications/types';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

type DialogState = { mode: 'add'; status: ApplicationStatus } | { mode: 'edit'; id: string } | null;

export default function ApplicationsPage() {
  const { data: applications, isLoading, error } = useApplications();
  const move = useMoveApplication();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [addDialog, setAddDialog] = useState<ApplicationStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ApplicationStatus | null>(null);

  // The open job lives in the URL (?open=<id>), so "Track this job" can link straight to it.
  const openId = params.get('open');
  const dialog: DialogState = addDialog
    ? { mode: 'add', status: addDialog }
    : openId
      ? { mode: 'edit', id: openId }
      : null;
  const editing =
    dialog?.mode === 'edit' ? applications?.find((a) => a.id === dialog.id) : undefined;

  function openJob(id: string) {
    setParams({ open: id });
  }
  function closeDialog() {
    setAddDialog(null);
    if (openId) setParams({}, { replace: true });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !applications) return applications ?? [];
    return applications.filter((a) =>
      `${a.role} ${a.company} ${a.location}`.toLowerCase().includes(q),
    );
  }, [applications, search]);

  const columns = useMemo(() => {
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, [] as Application[]])) as Record<
      ApplicationStatus,
      Application[]
    >;
    for (const a of filtered) byStatus[a.status].push(a);
    return byStatus;
  }, [filtered]);

  function handleDrop(status: ApplicationStatus) {
    setOverColumn(null);
    const a = applications?.find((x) => x.id === draggingId);
    setDraggingId(null);
    if (a && a.status !== status) move.mutate({ id: a.id, status });
  }

  const total = applications?.length ?? 0;
  const active = applications?.filter(
    (a) => a.status === 'applied' || a.status === 'interview',
  ).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-brand-300">Application tracker</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            Your job search, on one board
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            {total > 0
              ? `${total} job${total === 1 ? '' : 's'} tracked, ${active} in progress. Drag a card to another column to update it.`
              : 'Keep every application, interview and offer in one place.'}
          </p>
        </div>
        <div className="flex gap-2">
          {total > 0 && (
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs…"
              aria-label="Search jobs"
              className="w-44 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 sm:w-56"
            />
          )}
          <Button onClick={() => setAddDialog('saved')}>+ Add job</Button>
        </div>
      </div>

      {move.isError && (
        <div className="mt-6">
          <Alert>
            {move.error instanceof ApiError
              ? move.error.message
              : "We couldn't move that job. Please try again."}
          </Alert>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-24 text-brand-300">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error ? (
        <div className="mt-8">
          <Alert>
            {error instanceof ApiError ? error.message : 'We could not load your jobs.'}
          </Alert>
        </div>
      ) : total === 0 ? (
        <EmptyState onAdd={() => setAddDialog('saved')} />
      ) : (
        <div className="-mx-6 mt-8 overflow-x-auto px-6 pb-4">
          <div className="grid min-w-[1000px] grid-cols-5 gap-3">
            {STATUSES.map((status) => (
              <section
                key={status}
                aria-label={statusMeta[status].label}
                onDragOver={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  setOverColumn(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverColumn(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(status);
                }}
                className={cn(
                  'flex min-h-[420px] flex-col rounded-2xl border bg-surface/60 p-2.5 transition',
                  overColumn === status ? 'border-brand-400/60 bg-brand-500/10' : 'border-white/10',
                )}
              >
                <header className="flex items-center justify-between px-1.5 pb-2.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', statusMeta[status].dot)} />
                    <h2 className="text-sm font-semibold text-white">{statusMeta[status].label}</h2>
                    <span className="rounded-full bg-white/5 px-1.5 text-xs text-slate-400">
                      {columns[status].length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddDialog(status)}
                    aria-label={`Add a job to ${statusMeta[status].label}`}
                    className="rounded-md px-1.5 text-lg leading-none text-slate-500 hover:bg-white/5 hover:text-white"
                  >
                    +
                  </button>
                </header>

                <div className="flex flex-1 flex-col gap-2">
                  {columns[status].map((a) => (
                    <ApplicationCard
                      key={a.id}
                      application={a}
                      dragging={draggingId === a.id}
                      onOpen={() => openJob(a.id)}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', a.id);
                        setDraggingId(a.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverColumn(null);
                      }}
                    />
                  ))}
                  {columns[status].length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-slate-600">
                      {search ? 'No matches' : statusMeta[status].hint}
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {dialog?.mode === 'add' && (
        <ApplicationDialog defaultStatus={dialog.status} onClose={closeDialog} />
      )}
      {editing && (
        <ApplicationDialog key={editing.id} application={editing} onClose={closeDialog} />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="mt-10 rounded-2xl border border-dashed border-white/15 bg-surface/50 px-6 py-14 text-center">
      <div className="mx-auto flex max-w-md justify-center gap-1.5">
        {STATUSES.map((s) => (
          <span key={s} className={cn('h-1.5 w-8 rounded-full', statusMeta[s].dot)} />
        ))}
      </div>
      <h2 className="mt-6 font-display text-xl font-semibold text-white">No jobs tracked yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
        Add jobs as you find them, then move them from Saved to Applied, Interview and Offer. Set a
        next step with a date so nothing slips.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={onAdd}>+ Add your first job</Button>
        <Link
          to="/jobs"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          Or track one from a job match
        </Link>
      </div>
    </section>
  );
}
