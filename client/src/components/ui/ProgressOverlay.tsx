import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Button';

/** Full-screen progress while the AI works (usually 10-40 seconds), with rotating status lines. */
export function ProgressOverlay({ title, steps }: { title: string; steps: string[] }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 5000);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 px-6 backdrop-blur-sm"
      role="status"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
          <Spinner className="h-6 w-6" />
        </div>
        <p className="mt-5 font-display text-lg font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-400">{steps[step]}</p>
        <p className="mt-4 text-xs text-slate-500">This usually takes 10 to 40 seconds.</p>
      </div>
    </div>
  );
}
