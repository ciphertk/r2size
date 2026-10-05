export type PersistResult = 'granted' | 'denied' | 'unsupported';

/** Asks the browser not to evict this site's storage (important on iOS). Never throws. */
export const requestPersistence = async (): Promise<PersistResult> => {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
};

/** Whether storage is already protected, for the settings sheet. */
export const isPersisted = async (): Promise<boolean | null> => {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
};
