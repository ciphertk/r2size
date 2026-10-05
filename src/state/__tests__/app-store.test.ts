import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDoc } from '../../domain/defaults';
import type { PresetFields, StoredDoc } from '../../domain/schema';
import { createHashWriter, readHash } from '../../infra/url-hash';
import {
  browserStorage,
  CORRUPT_PREFIX,
  KEY,
  UNDO_KEY,
  type StorageApi,
} from '../../infra/storage';
import { createAppStore, type AppStoreDeps } from '../app-store';

let now = new Date('2026-10-05T10:00:00.000Z');
let ids = 0;
const persist = vi.fn(async () => 'granted' as const);

const deps = (storage: StorageApi = browserStorage): AppStoreDeps => ({
  storage,
  now: () => now,
  persist,
  newId: () => `id-${(ids += 1)}`,
});

const saved = (): StoredDoc => JSON.parse(localStorage.getItem(KEY) ?? 'null') as StoredDoc;

const FIELDS: PresetFields = {
  name: 'Breakout',
  riskPct: '0.75',
  stop: { kind: 'atr', multiple: '1.5' },
  maxAllocationPct: '25',
  costPct: '0.2',
};

beforeEach(() => {
  localStorage.clear();
  now = new Date('2026-10-05T10:00:00.000Z');
  ids = 0;
  persist.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loading', () => {
  it('starts with defaults and seeded presets on first run', () => {
    const store = createAppStore(deps());
    expect(store.getState()).toEqual({
      doc: defaultDoc(now),
      storage: 'ok',
      notice: null,
      canUndoImport: false,
    });
    expect(store.getState().doc.presets.map((p) => p.name)).toEqual(['Standard', 'Conservative']);
  });

  it('loads a saved document', () => {
    const doc = {
      ...defaultDoc(now),
      profile: { equity: '500000', availableCash: null, lastUpdated: now.toISOString() },
    };
    localStorage.setItem(KEY, JSON.stringify(doc));
    expect(createAppStore(deps()).getState().doc).toEqual(doc);
  });

  it('copies corrupt data aside instead of overwriting it', () => {
    localStorage.setItem(KEY, '{"schemaVersion":1,"profile":');
    const store = createAppStore(deps());
    expect(store.getState().notice).toBe('recoveredCorrupt');
    expect(localStorage.getItem(`${CORRUPT_PREFIX}${now.toISOString()}`)).toBe(
      '{"schemaVersion":1,"profile":',
    );
  });

  it('opens newer data read-only and never writes over it', () => {
    const newer = JSON.stringify({ ...defaultDoc(now), schemaVersion: 2 });
    localStorage.setItem(KEY, newer);
    const store = createAppStore(deps());
    expect(store.getState()).toMatchObject({ storage: 'readOnly', notice: 'newerData' });
    store.actions.saveProfile('100000', '');
    expect(store.getState().doc.profile.equity).toBe('100000');
    expect(localStorage.getItem(KEY)).toBe(newer);
  });

  /** Replaces window.localStorage for one test (happy-dom's methods aren't on Storage.prototype). */
  const withLocalStorage = (replacement: PropertyDescriptor, run: () => void) => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, ...replacement });
    try {
      run();
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  };

  it('keeps working in memory when storage is unavailable (M3-D8)', () => {
    withLocalStorage(
      {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      },
      () => {
        const store = createAppStore(deps());
        expect(store.getState()).toMatchObject({
          storage: 'unavailable',
          notice: 'storageUnavailable',
        });
        store.actions.saveProfile('200000', '');
        expect(store.getState().doc.profile.equity).toBe('200000');
        store.actions.resetAll();
        expect(store.getState().doc.profile.equity).toBeNull();
      },
    );
  });

  it('reports a full quota', () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      removeItem: () => undefined,
      key: () => null,
      length: 0,
    };
    withLocalStorage({ value: full }, () => {
      const store = createAppStore(deps());
      store.actions.saveProfile('200000', '');
      expect(store.getState()).toMatchObject({ storage: 'unavailable', notice: 'storageFull' });
    });
  });
});

describe('profile (M3-D1, M3-D2)', () => {
  it('saves valid figures, stamps the date and asks for persistent storage once', () => {
    const store = createAppStore(deps());
    store.actions.saveProfile('20,00,000', '6,40,000.50');
    expect(saved().profile).toEqual({
      equity: '2000000',
      availableCash: '640000.50',
      lastUpdated: now.toISOString(),
    });
    expect(persist).toHaveBeenCalledTimes(1);
    store.actions.saveProfile('2500000', '');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(saved().profile.availableCash).toBeNull();
  });

  it('does not move the date when nothing changed, and keeps the last valid value', () => {
    const store = createAppStore(deps());
    store.actions.saveProfile('2000000', '');
    const first = saved().profile.lastUpdated;
    now = new Date('2026-10-09T10:00:00.000Z');
    store.actions.saveProfile('20,00,000', '');
    expect(saved().profile.lastUpdated).toBe(first);
    store.actions.saveProfile('abc', '');
    expect(saved().profile.equity).toBe('2000000');
  });

  it('"Still correct" refreshes the date only', () => {
    const store = createAppStore(deps());
    store.actions.confirmProfile();
    expect(store.getState().doc.profile.lastUpdated).toBeNull();
    store.actions.saveProfile('2000000', '');
    now = new Date('2026-10-20T10:00:00.000Z');
    store.actions.confirmProfile();
    expect(saved().profile).toEqual({
      equity: '2000000',
      availableCash: null,
      lastUpdated: now.toISOString(),
    });
  });
});

describe('presets', () => {
  it('creates, updates, deletes and remembers the default', () => {
    const store = createAppStore(deps());
    const id = store.actions.createPreset(FIELDS);
    expect(id).toBe('id-1');
    expect(saved().presets.at(-1)).toMatchObject({ ...FIELDS, id: 'id-1' });

    now = new Date('2026-10-06T10:00:00.000Z');
    store.actions.updatePreset('id-1', { ...FIELDS, name: 'Breakout 2' });
    expect(saved().presets.at(-1)).toMatchObject({
      name: 'Breakout 2',
      updatedAt: now.toISOString(),
    });

    store.actions.setDefaultPreset('id-1');
    expect(saved().settings.defaultPresetId).toBe('id-1');
    store.actions.deletePreset('id-1');
    expect(saved().presets.map((p) => p.id)).toEqual(['standard', 'conservative']);
    expect(saved().settings.defaultPresetId).toBeNull();
  });

  it('refuses invalid presets and more than 50', () => {
    const store = createAppStore(deps());
    store.actions.createPreset({ ...FIELDS, riskPct: '500' });
    expect(store.getState().doc.presets).toHaveLength(2);
    for (let i = 0; i < 48; i += 1) store.actions.createPreset(FIELDS);
    expect(store.actions.createPreset(FIELDS)).toBeNull();
    expect(store.getState().doc.presets).toHaveLength(50);
  });
});

describe('import, undo and reset (M3-D7)', () => {
  const imported: StoredDoc = {
    ...defaultDoc(now),
    profile: { equity: '900000', availableCash: null, lastUpdated: '2026-09-01T00:00:00.000Z' },
    presets: [],
  };

  it('replaces the data and can undo once', () => {
    const store = createAppStore(deps());
    store.actions.saveProfile('2000000', '');
    const before = saved();
    store.actions.importDoc(imported);
    expect(saved()).toEqual(imported);
    expect(store.getState()).toMatchObject({ notice: 'imported', canUndoImport: true });
    expect(createAppStore(deps()).getState().canUndoImport).toBe(true);

    store.actions.undoImport();
    expect(saved()).toEqual(before);
    expect(localStorage.getItem(UNDO_KEY)).toBeNull();
    expect(store.getState()).toMatchObject({ notice: 'importUndone', canUndoImport: false });
    store.actions.undoImport();
    expect(saved()).toEqual(before);
  });

  it('resets everything to defaults, including the undo copy and corrupt copies', () => {
    localStorage.setItem(`${CORRUPT_PREFIX}x`, 'junk');
    localStorage.setItem('other-app', 'keep');
    const store = createAppStore(deps());
    store.actions.importDoc(imported);
    store.actions.resetAll();
    expect(saved()).toEqual(defaultDoc(now));
    expect(localStorage.getItem(UNDO_KEY)).toBeNull();
    expect(localStorage.getItem(`${CORRUPT_PREFIX}x`)).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('keep');
    expect(store.getState()).toMatchObject({ notice: 'reset', canUndoImport: false });
  });
});

describe('subscriptions', () => {
  it('notifies listeners and picks up changes from another tab', () => {
    const store = createAppStore(deps());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const disconnect = store.connect();
    store.actions.setStaleDays(14);
    expect(listener).toHaveBeenCalledTimes(1);

    const other = { ...saved(), settings: { ...saved().settings, staleDays: 3 } };
    localStorage.setItem(KEY, JSON.stringify(other));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(store.getState().doc.settings.staleDays).toBe(3);

    store.actions.dismissNotice();
    unsubscribe();
    disconnect();
    store.actions.setStaleDays(20);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('url hash writer', () => {
  it('debounces with replaceState and flushes on demand', () => {
    vi.useFakeTimers();
    const replace = vi.spyOn(window.history, 'replaceState');
    const writer = createHashWriter(300);
    writer.write('#v=1&e=100');
    writer.write('#v=1&e=101');
    expect(replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(readHash()).toBe('#v=1&e=101');

    writer.write('#v=1&e=102');
    writer.flush();
    expect(readHash()).toBe('#v=1&e=102');
    writer.write('#v=1&e=103');
    writer.cancel();
    vi.advanceTimersByTime(300);
    expect(readHash()).toBe('#v=1&e=102');
    vi.useRealTimers();
  });
});
