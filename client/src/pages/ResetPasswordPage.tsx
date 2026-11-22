import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { resetPassword } from '@/features/auth/api';
import {
  passwordRules,
  resetPasswordSchema,
  type ResetPasswordValues,
} from '@/features/auth/schemas';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const password = useWatch({ control, name: 'password' }) ?? '';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await resetPassword(token, values.password);
      navigate('/login', {
        replace: true,
        state: { notice: 'Your password has been changed. Log in with your new password.' },
      });
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "We couldn't reach Ribra. Please try again.",
      );
    }
  });

  const footer = (
    <Link to="/login" className="font-medium text-brand-300 hover:text-brand-200">
      ← Back to log in
    </Link>
  );

  if (!token) {
    return (
      <AuthLayout
        title="Link incomplete"
        subtitle="This reset link is missing its code. Open the link from your email again."
        footer={footer}
      >
        <Link
          to="/forgot-password"
          className="block rounded-lg bg-brand-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-600"
        >
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="You'll be logged out of every device for safety."
      footer={footer}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && (
          <Alert>
            {formError}{' '}
            <Link to="/forgot-password" className="underline">
              Request a new link
            </Link>
          </Alert>
        )}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          hint={
            <ul className="mt-2 space-y-1">
              {passwordRules.map((rule) => {
                const met = rule.test(password);
                return (
                  <li
                    key={rule.label}
                    className={cn(
                      'flex items-center gap-2 text-xs',
                      met ? 'text-success' : 'text-slate-500',
                    )}
                  >
                    <span aria-hidden>{met ? '✓' : '•'}</span>
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          }
          {...register('password')}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Change password
        </Button>
      </form>
    </AuthLayout>
  );
}
