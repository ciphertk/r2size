/// <reference types="vite-plugin-pwa/vanillajs" />
/**
 * Service worker registration and the update flow (ADR-007, M4-D4). Registered from this module,
 * never an inline script. When a new version is waiting, `updateWaiting` turns true and the UI
 * offers Reload; the page reloads only after the trader taps it, never on its own (another tab
 * applying the update does not reload this one). Never throws.
 */
import { registerSW } from 'virtual:pwa-register';

type Listener = () => void;

let waiting = false;
let userAskedToReload = false;
let update: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<Listener>();

const setWaiting = (value: boolean) => {
  waiting = value;
  listeners.forEach((listener) => listener());
};

export const startServiceWorker = (): void => {
  try {
    if (!('serviceWorker' in navigator)) return;
    update = registerSW({
      immediate: true,
      onNeedRefresh: () => setWaiting(true),
      // The new worker took control: reload only if this tab asked for it.
      onNeedReload: () => {
        if (userAskedToReload) window.location.reload();
      },
      onRegisterError: () => undefined,
    });
  } catch {
    // No service worker: the app still works online.
  }
};

export const isUpdateWaiting = (): boolean => waiting;

export const subscribeToUpdate = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The trader tapped Reload: save the setup to the URL first, then activate the new version. */
export const applyUpdate = async (beforeReload: () => void): Promise<void> => {
  userAskedToReload = true;
  beforeReload();
  try {
    await update?.(true);
  } catch {
    window.location.reload();
  }
};

/** The trader dismissed the notice; it comes back on the next launch while an update waits. */
export const dismissUpdate = (): void => setWaiting(false);
