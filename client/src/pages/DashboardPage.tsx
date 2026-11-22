import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { logout } from '@/features/auth/api';
import { useAuthStore } from '@/stores/auth';

const comingSoon = [
  {
    stage: 'Stage 3',
    title: 'CV analyzer',
    text: 'Upload your CV and get an ATS-style score with fixes.',
  },
  { stage: 'Stage 4', title: 'Job match', text: 'Compare your CV with any job description.' },
  { stage: 'Stage 5', title: 'Application tracker', text: 'Track every application on one board.' },
  {
    stage: 'Stage 6',
    title: 'Cover letters & interview prep',
    text: 'Tailored letters and practice questions.',
  },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)!;
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const firstName = user.name.split(' ')[0];

  async function handleLogout() {
    setLoggingOut(true);
    await logout().catch(() => undefined);
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo to="/dashboard" />
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <div
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-sm font-semibold text-brand-200"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <Button variant="secondary" onClick={handleLogout} loading={loggingOut}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-brand-300">Dashboard</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
          Welcome, {firstName} 👋
        </h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Your account is ready. Ribra's AI tools will appear here as we build each stage.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Plan" value={user.plan === 'pro' ? 'Pro' : 'Free'} />
          <Stat label="Email" value={user.emailVerified ? 'Verified' : 'Not verified yet'} />
          <Stat
            label="Member since"
            value={new Date(user.createdAt).toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          />
        </div>

        <h2 className="mt-12 font-display text-lg font-semibold text-white">Coming next</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {comingSoon.map((item) => (
            <div key={item.title} className="rounded-card border border-white/10 bg-surface/70 p-5">
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                {item.stage}
              </span>
              <h3 className="mt-3 font-display text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-white/10 bg-surface/70 p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
