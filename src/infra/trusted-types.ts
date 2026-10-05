/**
 * Trusted Types (architecture §7, M4-D7). The page policy requires them for every script sink.
 * The only one R2Size uses is registering its service worker: Workbox passes the plain string
 * "/sw.js", so a `default` policy vets it. It allows exactly this site's /sw.js and refuses every
 * other script URL; it defines no createHTML or createScript, so HTML and script strings stay
 * blocked. The CSP names this policy (`trusted-types default`), and no other can be created.
 */

/** The one script URL the app may hand to a script sink. */
export const allowScriptUrl = (url: string, origin: string): string => {
  const parsed = new URL(url, origin);
  if (parsed.origin === origin && parsed.pathname === '/sw.js' && parsed.search === '') {
    return url;
  }
  throw new TypeError(`Blocked script URL: ${url}`);
};

interface TrustedTypesFactory {
  createPolicy: (name: string, rules: { createScriptURL: (url: string) => string }) => unknown;
}

/** Installs the default policy before anything registers the worker. Never throws. */
export const installTrustedTypesPolicy = (): void => {
  try {
    const factory = (window as unknown as { trustedTypes?: TrustedTypesFactory }).trustedTypes;
    factory?.createPolicy('default', {
      createScriptURL: (url) => allowScriptUrl(url, window.location.origin),
    });
  } catch {
    // Already installed, or Trusted Types unsupported: nothing to do.
  }
};
