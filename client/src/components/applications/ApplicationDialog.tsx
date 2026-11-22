import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { applyServerErrors } from '@/features/auth/applyServerErrors';
import {
  useCreateApplication,
  useDeleteApplication,
  useUpdateApplication,
} from '@/features/applications/api';
import { applicationFormSchema, type ApplicationFormValues } from '@/features/applications/schema';
import { formatDay, statusMeta, toDateInput } from '@/features/applications/status';
import {
  STATUSES,
  type Application,
  type ApplicationInput,
  type ApplicationStatus,
} from '@/features/applications/types';
import { cn } from '@/lib/cn';

const fieldClass =
  'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30';

type Props = {
  /** The job being edited; leave out to add a new one. */
  application?: Application;
  /** Column to put a new job in. */
  defaultStatus?: ApplicationStatus;
  onClose: () => void;
};

function toFormValues(a?: Application, status: ApplicationStatus = 'saved'): ApplicationFormValues {
  return {
    company: a?.company ?? '',
    role: a?.role ?? '',
    status: a?.status ?? status,
    location: a?.location ?? '',
    jobUrl: a?.jobUrl ?? '',
    salary: a?.salary ?? '',
    notes: a?.notes ?? '',
    appliedAt: toDateInput(a?.appliedAt ?? null),
    nextStep: a?.nextStep ?? '',
    nextStepAt: toDateInput(a?.nextStepAt ?? null),
  };
}

function toInput(v: ApplicationFormValues): ApplicationInput {
  return { ...v, appliedAt: v.appliedAt || null, nextStepAt: v.nextStepAt || null };
}

/** Pop-up form to add a job to the tracker or edit one. */
export function ApplicationDialog({ application, defaultStatus, onClose }: Props) {
  const titleId = useId();
  const isEdit = Boolean(application);
  const create = useCreateApplication();
  const update = useUpdateApplication();
  const remove = useDeleteApplication();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: toFormValues(application, defaultStatus),
  });

  // Close with Escape, and stop the page behind from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (application) {
        await update.mutateAsync({ id: application.id, changes: toInput(values) });
      } else {
        await create.mutateAsync(toInput(values));
      }
      onClose();
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  async function handleDelete() {
    if (!application) return;
    try {
      await remove.mutateAsync(application.id);
      onClose();
    } catch {
      setFormError('We could not delete this job. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl border border-white/10 bg-surface shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-4">
          <div>
            <h2 id={titleId} className="font-display text-lg font-semibold text-white">
              {isEdit ? 'Edit job' : 'Add a job'}
            </h2>
            {application?.jobMatchId && (
              <Link
                to={`/jobs/${application.jobMatchId}`}
                className="text-xs text-brand-300 hover:text-brand-200"
              >
                View job match report ({application.matchScore}% match) →
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-5 overflow-y-auto px-6 py-5">
            {formError && <Alert>{formError}</Alert>}

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Job title"
                placeholder="Frontend Engineer"
                autoFocus={!isEdit}
                error={errors.role?.message}
                {...register('role')}
              />
              <TextField
                label="Company"
                placeholder="Paystack"
                error={errors.company?.message}
                {...register('company')}
              />
            </div>

            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-slate-300">Status</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {STATUSES.map((s) => (
                  <label key={s} className="cursor-pointer">
                    <input
                      type="radio"
                      value={s}
                      className="peer sr-only"
                      {...register('status')}
                    />
                    <span className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-2 text-xs font-medium text-slate-400 transition peer-checked:border-brand-400 peer-checked:bg-brand-500/15 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 hover:bg-white/5">
                      <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta[s].dot)} />
                      {statusMeta[s].label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Location"
                placeholder="Lagos · Remote"
                error={errors.location?.message}
                {...register('location')}
              />
              <TextField
                label="Salary"
                placeholder="₦600k / month"
                error={errors.salary?.message}
                {...register('salary')}
              />
            </div>

            <TextField
              label="Job advert link"
              type="url"
              placeholder="https://…"
              error={errors.jobUrl?.message}
              {...register('jobUrl')}
            />

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <TextField
                label="Next step"
                placeholder="Follow up with recruiter"
                error={errors.nextStep?.message}
                {...register('nextStep')}
              />
              <TextField
                label="Due"
                type="date"
                error={errors.nextStepAt?.message}
                {...register('nextStepAt')}
              />
            </div>

            <TextField
              label="Date applied"
              type="date"
              className="sm:max-w-[50%]"
              hint={
                <p className="mt-1.5 text-xs text-slate-500">
                  Filled in automatically when you move a job out of Saved.
                </p>
              }
              error={errors.appliedAt?.message}
              {...register('appliedAt')}
            />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">Notes</span>
              <textarea
                rows={4}
                placeholder="Recruiter's name, interview questions, how it went…"
                className={cn(fieldClass, 'resize-y leading-relaxed')}
                {...register('notes')}
              />
              {errors.notes && (
                <span role="alert" className="mt-1.5 block text-xs text-danger">
                  {errors.notes.message}
                </span>
              )}
            </label>

            {application && application.history.length > 1 && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-300">Timeline</p>
                <ol className="space-y-1.5 border-l border-white/10 pl-4">
                  {application.history.map((h, i) => (
                    <li key={i} className="relative text-xs text-slate-400">
                      <span
                        className={cn(
                          'absolute top-1 -left-[21px] h-2 w-2 rounded-full',
                          statusMeta[h.status].dot,
                        )}
                      />
                      <span className="text-slate-200">{statusMeta[h.status].label}</span> ·{' '}
                      {formatDay(h.at)}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-6 py-4">
            <div>
              {application &&
                (confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Delete this job?</span>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-danger/40 text-rose-300 hover:bg-danger/10"
                      loading={remove.isPending}
                      onClick={handleDelete}
                    >
                      Yes, delete
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-rose-300 hover:text-rose-200"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </Button>
                ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isEdit ? 'Save changes' : 'Add job'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
