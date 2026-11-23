import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { isStaleBuildError } from '@/lib/staleBuild';

/** Shown instead of React Router's developer error screen when a page crashes. */
export function RouteError() {
  const error = useRouteError();
  const newVersion = isStaleBuildError(error);
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-5xl font-extrabold text-brand-400">
        {newVersion ? '✨' : notFound ? '404' : 'Oops'}
      </p>
      <h1 className="mt-4 font-display text-2xl font-bold text-white">
        {newVersion
          ? 'Ribra has been updated'
          : notFound
            ? 'Page not found'
            : 'Something went wrong'}
      </h1>
      <p className="mt-2 max-w-md text-slate-400">
        {newVersion
          ? 'A new version is available. Reload the page to continue.'
          : notFound
            ? "The page you're looking for doesn't exist or has moved."
            : 'This page hit an unexpected error. Reloading usually fixes it. Your data is safe.'}
      </p>
      <div className="mt-8 flex gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Reload
        </button>
        <Link
          to="/"
          reloadDocument
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
