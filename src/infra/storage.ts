/**
 * localStorage repository for the one R2Size document (architecture §4, ADR-004).
 * Every call catches its own errors: private browsing, blocked storage or a full quota must
 * never crash the calculator (M3-D8).
 */
import { migrate } from '../domain/migrations';
import type { StoredDoc } from '../domain/schema';

export const KEY = 'r2size';
export const UNDO_KEY = 'r2size:pre-import';
export const CORRUPT_PREFIX = 'r2size:corrupt:';

export type LoadResult =
  | { readonly status: 'ok'; readonly doc: StoredDoc }
  | { readonly status: 'empty' }
  | { readonly status: 'corrupt' }
  | { readonly status: 'newer' }
  | { readonly status: 'unavailable' };

export type SaveResult = 'ok' | 'quota' | 'unavailable';

const store = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const read = (key: string): LoadResult => {
  const storage = store();
  if (storage === null) return { status: 'unavailable' };
  let text: string | null;
  try {
    text = storage.getItem(key);
  } catch {
    return { status: 'unavailable' };
  }
  if (text === null) return { status: 'empty' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: 'corrupt' };
  }
  const migrated = migrate(json);
  if (migrated.ok) return { status: 'ok', doc: migrated.doc };
  return { status: migrated.reason };
};

/** Loads the document. A corrupt one is copied aside, never silently overwritten. */
export const loadDoc = (now: Date): LoadResult => {
  const result = read(KEY);
  if (result.status === 'corrupt') {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw !== null) window.localStorage.setItem(`${CORRUPT_PREFIX}${now.toISOString()}`, raw);
    } catch {
      // Nothing more we can do; the in-memory defaults still work.
    }
  }
  return result;
};

const write = (key: string, doc: StoredDoc): SaveResult => {
  const storage = store();
  if (storage === null) return 'unavailable';
  try {
    storage.setItem(key, JSON.stringify(doc));
    return 'ok';
  } catch (error) {
    return error instanceof DOMException && error.name === 'QuotaExceededError'
      ? 'quota'
      : 'unavailable';
  }
};

export const saveDoc = (doc: StoredDoc): SaveResult => write(KEY, doc);

/** The previous document, kept so an import can be undone (M3-D7). */
export const saveUndo = (doc: StoredDoc): SaveResult => write(UNDO_KEY, doc);

export const loadUndo = (): StoredDoc | null => {
  const result = read(UNDO_KEY);
  return result.status === 'ok' ? result.doc : null;
};

const remove = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore: storage is unavailable, so there is nothing to remove.
  }
};

export const clearUndo = (): void => remove(UNDO_KEY);

/** Removes every R2Size key, including corrupt copies and the undo copy. */
export const clearAll = (): void => {
  const storage = store();
  if (storage === null) return;
  try {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    keys.filter((key): key is string => key !== null && key.startsWith(KEY)).forEach(remove);
  } catch {
    // Ignore, as above.
  }
};

/** Calls back when another tab changes the document. */
export const subscribeToOtherTabs = (onChange: () => void): (() => void) => {
  const listener = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) onChange();
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
};

export interface StorageApi {
  readonly loadDoc: typeof loadDoc;
  readonly saveDoc: typeof saveDoc;
  readonly saveUndo: typeof saveUndo;
  readonly loadUndo: typeof loadUndo;
  readonly clearUndo: typeof clearUndo;
  readonly clearAll: typeof clearAll;
  readonly subscribeToOtherTabs: typeof subscribeToOtherTabs;
}

export const browserStorage: StorageApi = {
  loadDoc,
  saveDoc,
  saveUndo,
  loadUndo,
  clearUndo,
  clearAll,
  subscribeToOtherTabs,
};
