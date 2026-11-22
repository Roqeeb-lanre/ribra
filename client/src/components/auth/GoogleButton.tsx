import { useEffect, useRef } from 'react';
import { googleSignIn } from '@/features/auth/api';
import { ApiError } from '@/lib/api';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let scriptPromise: Promise<void> | null = null;

/** Loads Google's sign-in script once, the first time a Google button is shown. */
function loadGoogleScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Google's official "Continue with Google" button.
 * Google gives us a signed ID token; the API checks it and logs the user in.
 * Hidden entirely when VITE_GOOGLE_CLIENT_ID isn't set.
 */
export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        const el = container.current;
        if (cancelled || !el || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          ux_mode: 'popup',
          callback: async ({ credential }) => {
            try {
              // On success the auth store updates and the page redirects to the dashboard.
              await googleSignIn(credential);
            } catch (err) {
              onError(
                err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.',
              );
            }
          },
        });
        window.google.accounts.id.renderButton(el, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: Math.min(Math.max(el.offsetWidth, 200), 400),
        });
      })
      .catch(() =>
        onError("Google sign-in couldn't load. Check your connection or use your email instead."),
      );

    return () => {
      cancelled = true;
    };
  }, [onError]);

  if (!CLIENT_ID) return null;

  return (
    <div>
      <div ref={container} className="flex min-h-[44px] justify-center" />
      <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        or with email
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}
