import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { login } from '@/features/auth/api';
import { applyServerErrors } from '@/features/auth/applyServerErrors';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // If the user was sent here from a protected page, go back there after logging in.
  const state = location.state as { from?: string; notice?: string } | null;
  const from = state?.from ?? '/dashboard';
  const [formError, setFormError] = useState<string | null>(null);
  const onGoogleError = useCallback((message: string) => setFormError(message), []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your job search."
      footer={
        <>
          New to Ribra?{' '}
          <Link to="/register" className="font-medium text-brand-300 hover:text-brand-200">
            Create an account
          </Link>
        </>
      }
    >
      {state?.notice && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-emerald-200"
        >
          {state.notice}
        </p>
      )}
      <GoogleButton onError={onGoogleError} />

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
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="-mt-2 text-right">
          <Link
            to="/forgot-password"
            className="text-xs font-medium text-brand-300 hover:text-brand-200"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full">
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
