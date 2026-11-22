import { useEffect, useState } from 'react';
import { getHealth, type HealthResponse } from '@/lib/api';

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

export default function App() {
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
      {/* Soft brand glow behind the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-brand-500/25 blur-[120px]"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-xl font-bold tracking-tight text-white">Ribra</span>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
          Stage 0 · Foundation
        </span>
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

        <StatusCard status={status} />

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
      </main>
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
    <div className="mx-auto mt-12 max-w-md rounded-card border border-white/10 bg-surface/80 p-5 text-left backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">System status</span>
        <span className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <span className="text-slate-300">
            {status.state === 'loading' && 'Checking…'}
            {status.state === 'online' && 'All systems go'}
            {status.state === 'offline' && 'API unreachable'}
          </span>
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Row label="Frontend" value="Running" good />
        <Row
          label="API"
          value={
            status.state === 'online'
              ? `v${status.data.version}`
              : status.state === 'offline'
                ? 'Down'
                : '…'
          }
          good={status.state === 'online'}
        />
        <Row
          label="Database"
          value={status.state === 'online' ? status.data.database : '…'}
          good={status.state === 'online' && status.data.database === 'connected'}
        />
        <Row
          label="Uptime"
          value={status.state === 'online' ? `${status.data.uptimeSeconds}s` : '…'}
        />
      </dl>

      {status.state === 'offline' && (
        <p className="mt-4 text-xs text-slate-500">
          Start the API with <code className="text-slate-300">npm run dev</code> from the project
          folder. ({status.message})
        </p>
      )}
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 font-medium capitalize ${good ? 'text-success' : 'text-slate-200'}`}>
        {value}
      </dd>
    </div>
  );
}
