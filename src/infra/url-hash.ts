/** The URL hash, which holds the current setup (architecture §5). */

export const readHash = (): string => {
  try {
    return window.location.hash;
  } catch {
    return '';
  }
};

const replaceHash = (hash: string) => {
  try {
    const { pathname, search } = window.location;
    // The setup belongs to the calculator ("/"). A write that lands after navigating to the
    // Guide must not stamp the setup onto /guide.
    if (pathname !== '/') return;
    if (window.location.hash === hash) return;
    // replaceState, never pushState: typing must not fill the back button's history.
    window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`);
  } catch {
    // Sandboxed or unusual environments: the setup simply isn't kept in the URL.
  }
};

export interface HashWriter {
  readonly write: (hash: string) => void;
  /** Writes any pending hash now (before copying the link or reloading). */
  readonly flush: () => void;
  readonly cancel: () => void;
}

/** The writer of the screen on show, so an app update can save the setup before reloading. */
let active: HashWriter | null = null;

/** Writes any pending setup to the URL now (before an update reload). */
export const flushPendingHash = (): void => active?.flush();

export const createHashWriter = (delayMs = 300): HashWriter => {
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    if (pending !== null) replaceHash(pending);
    pending = null;
  };
  const writer: HashWriter = {
    write: (hash) => {
      pending = hash;
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel: () => {
      clearTimeout(timer);
      pending = null;
    },
  };
  active = writer;
  return writer;
};
