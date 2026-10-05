/**
 * The app's two routes (architecture §8): "/" (calculator) and "/guide". Any other path is the
 * calculator, and its URL is rewritten to "/" keeping the setup hash (PRD decision "Unknown
 * paths", M4-D1), so old or mistyped links still work and shared links are always canonical.
 */

export type Route = 'calculator' | 'guide';

const NAVIGATE = 'r2size:navigate';

/** The canonical path for any pathname: "/guide" for /guide and below, else "/". */
export const canonicalPath = (pathname: string): '/' | '/guide' =>
  /^\/guide(\/|$)/i.test(pathname) ? '/guide' : '/';

export const routeOf = (pathname: string): Route =>
  canonicalPath(pathname) === '/guide' ? 'guide' : 'calculator';

/** Rewrites the current URL to its canonical path (no new history entry). Never throws. */
export const canonicalizeLocation = (): void => {
  try {
    const { pathname, hash } = window.location;
    const path = canonicalPath(pathname);
    if (path === pathname && window.location.search === '') return;
    window.history.replaceState(window.history.state, '', `${path}${hash}`);
  } catch {
    // Sandboxed or unusual environments: the URL simply stays as it was.
  }
};

export const currentRoute = (): Route => {
  try {
    return routeOf(window.location.pathname);
  } catch {
    return 'calculator';
  }
};

const IN_APP = { r2size: 'in-app' } as const;

/** Moves to a route in-app (a new history entry, so Back returns). `hash` may be "" or "#…". */
export const navigate = (path: '/' | '/guide', hash = ''): void => {
  try {
    window.history.pushState(IN_APP, '', `${path}${hash}`);
    window.dispatchEvent(new Event(NAVIGATE));
  } catch {
    window.location.assign(`${path}${hash}`);
  }
};

/** True when this page was reached by `navigate` (so Back returns to the app, not elsewhere). */
export const arrivedInApp = (): boolean => {
  try {
    const state: unknown = window.history.state;
    return typeof state === 'object' && state !== null && 'r2size' in state;
  } catch {
    return false;
  }
};

/** For useSyncExternalStore: Back/Forward and in-app navigation. */
export const subscribeToRoute = (listener: () => void): (() => void) => {
  window.addEventListener('popstate', listener);
  window.addEventListener(NAVIGATE, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(NAVIGATE, listener);
  };
};
