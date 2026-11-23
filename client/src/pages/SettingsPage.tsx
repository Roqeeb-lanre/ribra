import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button, Spinner } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import {
  describeDevice,
  useChangePassword,
  useDeleteAccount,
  useExportData,
  useSessions,
  useSignOutOthers,
  useUpdateProfile,
} from '@/features/account/api';
import { applyServerErrors } from '@/features/auth/applyServerErrors';
import { formatDate } from '@/features/cv/score';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth';

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <p className="text-sm text-brand-300">Settings</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
        Your account
      </h1>
      <p className="mt-2 text-slate-400">
        Manage your profile, password, devices and data.{' '}
        <Link to="/billing" className="text-brand-300 hover:text-brand-200">
          Plan & billing →
        </Link>
      </p>

      <div className="mt-8 space-y-6">
        <ProfileSection />
        <PasswordSection />
        <SessionsSection />
        <DataSection />
        <DeleteSection />
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border p-6',
        danger ? 'border-danger/30 bg-danger/[0.04]' : 'border-white/10 bg-surface/70',
      )}
    >
      <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Saved({ show, text = 'Saved' }: { show: boolean; text?: string }) {
  return show ? <span className="text-sm text-emerald-300">✓ {text}</span> : null;
}

// ---- Profile ----

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long'),
});

function ProfileSection() {
  const user = useAuthStore((s) => s.user)!;
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name },
  });
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async ({ name }) => {
    setFormError(null);
    try {
      const { user: saved } = await update.mutateAsync(name);
      reset({ name: saved.name });
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  const methods = [user.hasPassword && 'Email and password', user.googleLinked && 'Google'].filter(
    Boolean,
  );

  return (
    <Section title="Profile">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Full name"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name')}
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-300">Email</p>
            <p className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-sm text-slate-300">
              <span className="truncate">{user.email}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  user.emailVerified
                    ? 'bg-success/15 text-emerald-300'
                    : 'bg-warning/15 text-amber-300',
                )}
              >
                {user.emailVerified ? 'Verified' : 'Not verified'}
              </span>
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          You sign in with: {methods.join(' or ')}. Member since {formatDate(user.createdAt)}.
        </p>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={update.isPending} disabled={!isDirty}>
            Save
          </Button>
          <Saved show={update.isSuccess && !isDirty} />
        </div>
      </form>
    </Section>
  );
}

// ---- Password ----

const passwordRules = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

const passwordFormSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: passwordRules,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The passwords don't match",
    path: ['confirmPassword'],
  });

function PasswordSection() {
  const user = useAuthStore((s) => s.user)!;
  const change = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (user.hasPassword && !values.currentPassword) {
      setError('currentPassword', { message: 'Enter your current password' });
      return;
    }
    try {
      await change.mutateAsync({
        currentPassword: user.hasPassword ? values.currentPassword : undefined,
        newPassword: values.newPassword,
      });
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WRONG_PASSWORD') {
        setError('currentPassword', { message: err.message });
      } else if (err instanceof ApiError && err.code === 'SAME_PASSWORD') {
        setError('newPassword', { message: err.message });
      } else {
        setFormError(applyServerErrors(err, setError));
      }
    }
  });

  return (
    <Section
      title={user.hasPassword ? 'Change password' : 'Set a password'}
      description={
        user.hasPassword
          ? "You'll stay logged in here and be logged out on your other devices."
          : 'You sign in with Google. Add a password to also log in with your email.'
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}
        {user.hasPassword && (
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            className="sm:max-w-[calc(50%-0.5rem)]"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            hint={
              <p className="mt-1.5 text-xs text-slate-500">
                8+ characters, with a letter and a number.
              </p>
            }
            {...register('newPassword')}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={change.isPending}>
            {user.hasPassword ? 'Change password' : 'Set password'}
          </Button>
          <Saved show={change.isSuccess} text="Password updated" />
        </div>
      </form>
    </Section>
  );
}

// ---- Sessions ----

function SessionsSection() {
  const sessions = useSessions();
  const signOut = useSignOutOthers();
  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  return (
    <Section
      title="Where you're logged in"
      description="Don't recognise a device? Log it out, then change your password."
    >
      {sessions.isLoading ? (
        <div className="flex justify-center py-4 text-brand-300">
          <Spinner />
        </div>
      ) : sessions.error ? (
        <Alert>{errorText(sessions.error, 'We could not load your devices.')}</Alert>
      ) : (
        <>
          <ul className="divide-y divide-white/5">
            {sessions.data?.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm text-white">
                    {describeDevice(s.userAgent)}
                    {s.current && (
                      <span className="ml-2 rounded-full bg-brand-500/20 px-2 py-0.5 text-[11px] font-medium text-brand-200">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    Signed in {formatDate(s.createdAt)} · last active {formatDate(s.lastActiveAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {signOut.isError && (
            <div className="mt-3">
              <Alert>{errorText(signOut.error, 'Something went wrong. Please try again.')}</Alert>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => signOut.mutate()}
              loading={signOut.isPending}
              disabled={others === 0}
            >
              Log out other devices
            </Button>
            {signOut.isSuccess && (
              <span className="text-sm text-emerald-300">
                ✓ Logged out {signOut.data.signedOut} device
                {signOut.data.signedOut === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </>
      )}
    </Section>
  );
}

// ---- Data ----

function DataSection() {
  const exportData = useExportData();
  return (
    <Section
      title="Your data"
      description="Download a copy of everything Ribra stores about you: your profile, CVs, reports, job matches, applications, cover letters, interview prep and payments."
    >
      {exportData.isError && (
        <div className="mb-3">
          <Alert>{errorText(exportData.error, 'We could not prepare your download.')}</Alert>
        </div>
      )}
      <Button
        variant="secondary"
        onClick={() => exportData.mutate()}
        loading={exportData.isPending}
      >
        Download my data (.json)
      </Button>
    </Section>
  );
}

// ---- Delete ----

function DeleteSection() {
  const user = useAuthStore((s) => s.user)!;
  const navigate = useNavigate();
  const remove = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const ready = user.hasPassword
    ? confirmation.length > 0
    : confirmation.trim().toLowerCase() === user.email;

  async function handleDelete() {
    try {
      await remove.mutateAsync(
        user.hasPassword ? { password: confirmation } : { confirmEmail: confirmation },
      );
      navigate('/', { replace: true });
    } catch {
      // Shown below.
    }
  }

  return (
    <Section
      danger
      title="Delete account"
      description="Permanently deletes your account, CVs, reports, applications, letters and interview prep. This can't be undone. If you're on Pro, your subscription is cancelled first."
    >
      {!open ? (
        <Button
          variant="secondary"
          className="border-danger/40 text-rose-300 hover:bg-danger/10"
          onClick={() => setOpen(true)}
        >
          Delete my account…
        </Button>
      ) : (
        <div className="space-y-4">
          {remove.isError && (
            <Alert>
              {errorText(remove.error, "We couldn't delete your account. Please try again.")}
            </Alert>
          )}
          <TextField
            label={
              user.hasPassword
                ? 'Enter your password to confirm'
                : `Type your email (${user.email}) to confirm`
            }
            type={user.hasPassword ? 'password' : 'email'}
            autoComplete={user.hasPassword ? 'current-password' : 'off'}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="sm:max-w-sm"
          />
          <p className="text-xs text-slate-500">
            Tip: download your data first if you might want it later.
          </p>
          <div className="flex gap-2">
            <Button
              className="bg-danger shadow-none hover:bg-rose-600"
              onClick={handleDelete}
              disabled={!ready}
              loading={remove.isPending}
            >
              Permanently delete my account
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setConfirmation('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}
