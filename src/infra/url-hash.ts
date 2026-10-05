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

export const createHashWriter = (delayMs = 300): HashWriter => {
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    if (pending !== null) replaceHash(pending);
    pending = null;
  };
  return {
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
};
