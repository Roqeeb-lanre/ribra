import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-6xl font-extrabold text-brand-400">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-white">Page not found</h1>
      <p className="mt-2 text-slate-400">The page you're looking for doesn't exist or has moved.</p>
      <Link
        to="/"
        className="mt-8 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Back to home
      </Link>
    </div>
  );
}
