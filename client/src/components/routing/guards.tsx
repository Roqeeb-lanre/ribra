import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center text-brand-300">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

/** Only logged-in users get through; everyone else goes to /login (and comes back after). */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'checking') return <FullPageSpinner />;
  if (status === 'guest')
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Log-in and sign-up pages: already logged-in users go straight to the dashboard. */
export function GuestRoute() {
  const status = useAuthStore((s) => s.status);

  if (status === 'checking') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
