/**
 * After a new deploy, an open tab still runs the old version, whose page files
 * (e.g. JobMatchPage-B1zx.js) no longer exist. The fix is simply to reload once
 * to get the new version. A timestamp stops an endless reload loop.
 */
const KEY = 'ribra:reloaded-for-new-version';

export function isStaleBuildError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    message,
  );
}

/** Reloads the page, unless we already did in the last 30 seconds. Returns true if reloading. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode etc.): still reload once per page load.
  }
  window.location.reload();
  return true;
}
