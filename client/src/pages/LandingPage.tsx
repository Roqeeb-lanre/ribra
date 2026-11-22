import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { getHealth, type HealthResponse } from '@/lib/health';
import { useAuthStore } from '@/stores/auth';

type Status =
  | { state: 'loading' }
  | { state: 'online'; data: HealthResponse }
  | { state: 'offline'; message: string };

const features = [
  { title: 'CV analyzer', text: 'An ATS-style score with fixes you can apply in minutes.' },
  { title: 'Job match', text: 'See the exact keywords and skills a job wants that your CV lacks.' },
  { title: 'Cover letters', text: 'Tailored letters for each role, written in seconds.' },
  { title: 'Interview prep', text: 'Practice likely questions and get feedback on your answers.' },
  { title: 'Application tracker', text: 'Every application on one board, with reminders.' },
];

export default function LandingPage() {
  const authStatus = useAuthStore((s) => s.status);
  const [status, setStatus] = useState<Status>({ state: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((data) => setStatus({ state: 'online', data }))
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setStatus({ state: 'offline', message: err.message });
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-brand-500/25 blur-[120px]"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {authStatus === 'authenticated' ? (
            <Link
              to="/dashboard"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Get started free
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 text-center sm:pt-24">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-200">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
          Your AI career co-pilot
        </p>

        <h1 className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
          Land the job,{' '}
          <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
            from CV to offer.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Ribra scores your CV, matches it to real jobs, writes your cover letters, preps you for
          interviews and tracks every application in one place.
        </p>

        <div className="mt-10 flex justify-center gap-3">
          <Link
            to={authStatus === 'authenticated' ? '/dashboard' : '/register'}
            className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
          >
            {authStatus === 'authenticated' ? 'Open your dashboard' : 'Create your free account'}
          </Link>
        </div>

        <section className="mt-20 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-card border border-white/10 bg-surface/70 p-5 backdrop-blur transition hover:border-brand-400/40"
            >
              <h3 className="font-display text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.text}</p>
            </div>
          ))}
        </section>

        <StatusCard status={status} />
      </main>

      <footer className="relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-white/5 px-6 py-8 text-xs text-slate-500 sm:flex-row">
        <span>© {new Date().getFullYear()} Ribra</span>
        <nav className="flex gap-5">
          <Link to="/privacy" className="hover:text-slate-300">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-slate-300">
            Terms of Service
          </Link>
        </nav>
      </footer>
    </div>
  );
}

function StatusCard({ status }: { status: Status }) {
  const dot =
    status.state === 'online'
      ? 'bg-success'
      : status.state === 'offline'
        ? 'bg-danger'
        : 'bg-warning animate-pulse';

  return (
    <div className="mx-auto mt-16 flex max-w-md items-center justify-center gap-2 text-xs text-slate-500">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {status.state === 'loading' && 'Checking system status…'}
      {status.state === 'online' &&
        `All systems go · API v${status.data.version} · database ${status.data.database}`}
      {status.state === 'offline' && 'API unreachable. It may be waking up; refresh in a moment.'}
    </div>
  );
}
