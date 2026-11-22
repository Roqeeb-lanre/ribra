import { Logo } from '@/components/ui/Logo';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

/** Centred card used by the log-in and sign-up pages. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface/80 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">{footer}</p>
      </div>
    </div>
  );
}
