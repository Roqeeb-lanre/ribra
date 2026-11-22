import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import { useCallback, useState } from 'react';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { register as registerUser } from '@/features/auth/api';
import { passwordRules, registerSchema, type RegisterValues } from '@/features/auth/schemas';
import { applyServerErrors } from '@/features/auth/applyServerErrors';
import { cn } from '@/lib/cn';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const onGoogleError = useCallback((message: string) => setFormError(message), []);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const password = useWatch({ control, name: 'password' }) ?? '';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerUser(values);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start landing interviews with AI on your side. It's free."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-300 hover:text-brand-200">
            Log in
          </Link>
        </>
      }
    >
      <GoogleButton onError={onGoogleError} />

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && <Alert>{formError}</Alert>}

        <TextField
          label="Full name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          error={errors.name?.message}
          {...register('name')}
        />
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
          autoComplete="new-password"
          placeholder="Create a password"
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

        <Button type="submit" loading={isSubmitting} className="w-full">
          Create account
        </Button>

        <p className="text-center text-xs text-slate-500">
          By creating an account you agree to Ribra's Terms and Privacy Policy.
        </p>
      </form>
    </AuthLayout>
  );
}
