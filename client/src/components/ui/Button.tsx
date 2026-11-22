import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600 focus-visible:outline-brand-300',
  secondary:
    'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 focus-visible:outline-white/40',
  ghost: 'text-slate-300 hover:bg-white/5 hover:text-white focus-visible:outline-white/40',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
    />
  );
}
