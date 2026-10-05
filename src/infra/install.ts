/**
 * Installing the app (architecture §6, M4-D5). Chromium offers a real install prompt
 * (`beforeinstallprompt`); iOS Safari has none, so the UI shows a one-time "Add to Home Screen"
 * hint instead. Never throws.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Listener = () => void;

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((listener) => listener());

/** Starts listening for the install prompt; `onInstalled` runs once the app is installed. */
export const watchInstall = (onInstalled: () => void): void => {
  try {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault(); // we show our own "Install app" action instead of the mini-bar
      deferred = event as BeforeInstallPromptEvent;
      emit();
    });
    window.addEventListener('appinstalled', () => {
      deferred = null;
      emit();
      onInstalled();
    });
  } catch {
    // No install support: nothing to offer.
  }
};

export const canPromptInstall = (): boolean => deferred !== null;

export const subscribeToInstall = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
  const event = deferred;
  if (event === null) return 'unavailable';
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null; // a prompt can only be used once
    emit();
    return outcome;
  } catch {
    return 'unavailable';
  }
};

/** Running as an installed app (home screen or desktop window). */
export const isStandalone = (): boolean => {
  try {
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
};

/**
 * Safari on iPhone or iPad, where installing means Share → Add to Home Screen. iPadOS reports a
 * Mac user agent, so a touch-capable "Macintosh" counts too. Chrome/Firefox/Edge on iOS are
 * excluded: they can't add web apps to the home screen the same way.
 */
export const isIosSafari = (
  userAgent: string = navigator.userAgent,
  maxTouchPoints: number = navigator.maxTouchPoints,
): boolean => {
  const ios =
    /iP(hone|ad|od)/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios && /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
};
