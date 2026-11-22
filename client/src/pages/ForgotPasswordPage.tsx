import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { forgotPassword } from '@/features/auth/api';
import { applyServerErrors } from '@/features/auth/applyServerErrors';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas';

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await forgotPassword(email);
      setSentTo(email);
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  return (
    <AuthLayout
      title={sentTo ? 'Check your inbox' : 'Forgot your password?'}
      subtitle={
        sentTo
          ? `If ${sentTo} has a Ribra account, we've sent a link to reset your password. It expires in 30 minutes.`
          : "Enter your email and we'll send you a link to choose a new password."
      }
      footer={
        <Link to="/login" className="font-medium text-brand-300 hover:text-brand-200">
          ← Back to log in
        </Link>
      }
    >
      {sentTo ? (
        <div className="space-y-4 text-sm text-slate-400">
          <p>Didn't get it? Check your spam folder, or wait a minute and try again.</p>
          <Button variant="secondary" className="w-full" onClick={() => setSentTo(null)}>
            Try a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {formError && <Alert>{formError}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
