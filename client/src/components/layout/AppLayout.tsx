import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { logout } from '@/features/auth/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/cv', label: 'CV Analyzer' },
  { to: '/jobs', label: 'Job Match' },
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
        <nav className="flex gap-1 border-t border-white/5 px-4 py-2 sm:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'flex-1 rounded-lg px-3 py-2 text-center text-sm',
                  isActive ? 'bg-white/10 text-white' : 'text-slate-400',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
