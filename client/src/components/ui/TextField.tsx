import { useId, useState, type InputHTMLAttributes, type Ref } from 'react';
import { cn } from '@/lib/cn';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  ref?: Ref<HTMLInputElement>;
};

/** Labelled input with an error message. Password fields get a show/hide button. */
export function TextField({
  label,
  error,
  hint,
  type = 'text',
  className,
  ref,
  ...props
}: TextFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'w-full rounded-lg border bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 transition outline-none',
            'focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30',
            error ? 'border-danger/70' : 'border-white/10',
            isPassword && 'pr-16',
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-400 hover:text-white"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
