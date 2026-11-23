import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { VerifyEmailBanner } from '@/components/auth/VerifyEmailBanner';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { logout } from '@/features/auth/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/cv', label: 'CV Analyzer' },
  { to: '/jobs', label: 'Job Match' },
  { to: '/applications', label: 'Tracker' },
  { to: '/prep', label: 'Prep' },
];

/** Header + navigation shared by every page inside the app. */
export function AppLayout() {
  const user = useAuthStore((s) => s.user)!;
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout().catch(() => undefined);
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-8">
            <Logo to="/dashboard" />
            <nav className="hidden items-center gap-1 sm:flex">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user.plan === 'pro' ? (
              <Link
                to="/billing"
                title="Your plan"
                className="rounded-md bg-brand-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-600"
              >
                Pro
              </Link>
            ) : (
              <Link
                to="/billing"
                className="rounded-lg border border-brand-400/40 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-200 hover:bg-brand-500/20"
              >
                Upgrade
              </Link>
            )}
            <div className="hidden text-right md:block">
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

        {/* Mobile navigation */}
        <nav className="flex gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 sm:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'shrink-0 rounded-lg px-3 py-2 text-center text-sm whitespace-nowrap',
                  isActive ? 'bg-white/10 text-white' : 'text-slate-400',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <VerifyEmailBanner />
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
