/**
 * Everything R2Size remembers (profile, presets, settings) as one external store over
 * infra/storage. Every change is validated, saved, then published. If storage is missing
 * the app keeps working in memory (M3-D8).
 */
import { createContext, useContext, useSyncExternalStore } from 'react';
import * as v from 'valibot';
import { defaultDoc } from '../domain/defaults';
import {
  MoneySchema,
  PRESETS_MAX,
  StoredDocSchema,
  type Preset,
  type PresetFields,
  type StoredDoc,
} from '../domain/schema';
import { requestPersistence, type PersistResult } from '../infra/persist';
import { browserStorage, type StorageApi } from '../infra/storage';

export type StorageStatus = 'ok' | 'unavailable' | 'readOnly';

export type AppNotice =
  | 'storageUnavailable'
  | 'storageFull'
  | 'recoveredCorrupt'
  | 'newerData'
  | 'imported'
  | 'importUndone'
  | 'reset';

export interface AppState {
  readonly doc: StoredDoc;
  readonly storage: StorageStatus;
  readonly notice: AppNotice | null;
  readonly canUndoImport: boolean;
}

export interface AppStoreDeps {
  readonly storage: StorageApi;
  readonly now: () => Date;
  readonly persist: () => Promise<PersistResult>;
  readonly newId: () => string;
}

const browserDeps: AppStoreDeps = {
  storage: browserStorage,
  now: () => new Date(),
  persist: requestPersistence,
  newId: () => crypto.randomUUID(),
};

/** Strips grouping commas and spaces; null when blank or not a valid amount. */
const money = (text: string): string | null => {
  const cleaned = text.replace(/[,₹\s]/g, '');
  return cleaned !== '' && v.is(MoneySchema, cleaned) ? cleaned : null;
};

export const createAppStore = (deps: AppStoreDeps = browserDeps) => {
  const initial = (): AppState => {
    const loaded = deps.storage.loadDoc(deps.now());
    switch (loaded.status) {
      case 'ok':
        return {
          doc: loaded.doc,
          storage: 'ok',
          notice: null,
          canUndoImport: deps.storage.loadUndo() !== null,
        };
      case 'empty':
        return { doc: defaultDoc(deps.now()), storage: 'ok', notice: null, canUndoImport: false };
      case 'corrupt':
        return {
          doc: defaultDoc(deps.now()),
          storage: 'ok',
          notice: 'recoveredCorrupt',
          canUndoImport: false,
        };
      case 'newer':
        return {
          doc: defaultDoc(deps.now()),
          storage: 'readOnly',
          notice: 'newerData',
          canUndoImport: false,
        };
      case 'unavailable':
        return {
          doc: defaultDoc(deps.now()),
          storage: 'unavailable',
          notice: 'storageUnavailable',
          canUndoImport: false,
        };
    }
  };

  let state = initial();
  const listeners = new Set<() => void>();
  const publish = (next: AppState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  /** Validates, saves (unless read-only) and publishes. Invalid documents are never written. */
  const commit = (doc: StoredDoc, extra: Partial<AppState> = {}) => {
    if (!v.is(StoredDocSchema, doc)) return;
    if (state.storage === 'readOnly') {
      publish({ ...state, ...extra, doc });
      return;
    }
    const saved = deps.storage.saveDoc(doc);
    publish({
      ...state,
      ...extra,
      doc,
      storage: saved === 'ok' ? 'ok' : 'unavailable',
      ...(saved === 'ok'
        ? {}
        : { notice: saved === 'quota' ? 'storageFull' : 'storageUnavailable' }),
    });
  };

  const updatePresets = (presets: Preset[], defaultPresetId = state.doc.settings.defaultPresetId) =>
    commit({ ...state.doc, presets, settings: { ...state.doc.settings, defaultPresetId } });

  const actions = {
    /** M3-D1: saves valid values; the date moves only when something actually changed. */
    saveProfile(equityText: string, cashText: string) {
      const equity = money(equityText);
      const availableCash = money(cashText);
      const { profile, settings } = state.doc;
      // An invalid entry is left on screen for the trader to fix and is not saved.
      const nextEquity = equityText.trim() === '' ? null : (equity ?? profile.equity);
      const nextCash = cashText.trim() === '' ? null : (availableCash ?? profile.availableCash);
      if (nextEquity === profile.equity && nextCash === profile.availableCash) return;
      const firstSave = !settings.persistRequested;
      commit({
        ...state.doc,
        profile: {
          equity: nextEquity,
          availableCash: nextCash,
          lastUpdated: deps.now().toISOString(),
        },
        settings: { ...settings, persistRequested: true },
      });
      if (firstSave) void deps.persist();
    },

    /** "Still correct": refreshes the date without changing the figures (M3-D2). */
    confirmProfile() {
      if (state.doc.profile.equity === null) return;
      commit({
        ...state.doc,
        profile: { ...state.doc.profile, lastUpdated: deps.now().toISOString() },
      });
    },

    createPreset(fields: PresetFields): string | null {
      if (state.doc.presets.length >= PRESETS_MAX) return null;
      const at = deps.now().toISOString();
      const preset: Preset = { ...fields, id: deps.newId(), createdAt: at, updatedAt: at };
      updatePresets([...state.doc.presets, preset]);
      return preset.id;
    },

    updatePreset(id: string, fields: PresetFields) {
      updatePresets(
        state.doc.presets.map((p) =>
          p.id === id ? { ...p, ...fields, updatedAt: deps.now().toISOString() } : p,
        ),
      );
    },

    deletePreset(id: string) {
      const defaultId =
        state.doc.settings.defaultPresetId === id ? null : state.doc.settings.defaultPresetId;
      updatePresets(
        state.doc.presets.filter((p) => p.id !== id),
        defaultId,
      );
    },

    /** M3-D5: the last-applied preset is applied again on the next launch. */
    setDefaultPreset(id: string | null) {
      if (state.doc.settings.defaultPresetId === id) return;
      commit({ ...state.doc, settings: { ...state.doc.settings, defaultPresetId: id } });
    },

    /** The one-time "Add to Home Screen" hint on iOS Safari (M4-D5). */
    dismissInstallHint() {
      if (state.doc.settings.installHintDismissed) return;
      commit({ ...state.doc, settings: { ...state.doc.settings, installHintDismissed: true } });
    },

    setStaleDays(days: number) {
      commit({ ...state.doc, settings: { ...state.doc.settings, staleDays: days } });
    },

    /** M3-D7: replace, keeping the previous document for Undo. */
    importDoc(doc: StoredDoc) {
      deps.storage.saveUndo(state.doc);
      commit(doc, { notice: 'imported', canUndoImport: true });
    },

    undoImport() {
      const previous = deps.storage.loadUndo();
      if (previous === null) return;
      deps.storage.clearUndo();
      commit(previous, { notice: 'importUndone', canUndoImport: false });
    },

    resetAll() {
      deps.storage.clearAll();
      const doc = defaultDoc(deps.now());
      commit(doc, { notice: 'reset', canUndoImport: false });
    },

    dismissNotice() {
      if (state.notice !== null) publish({ ...state, notice: null });
    },

    /** Another tab saved a change: take it. */
    reloadFromStorage() {
      const loaded = deps.storage.loadDoc(deps.now());
      if (loaded.status === 'ok') publish({ ...state, doc: loaded.doc });
    },
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions,
    /** Starts listening to other tabs; returns the stop function. */
    connect: () => deps.storage.subscribeToOtherTabs(actions.reloadFromStorage),
  };
};

export type AppStore = ReturnType<typeof createAppStore>;

export const AppStoreContext = createContext<AppStore | null>(null);

export const useAppStore = (): AppStore => {
  const store = useContext(AppStoreContext);
  if (store === null) throw new Error('AppStoreContext is missing');
  return store;
};

/** The current app state; re-renders on every change. */
export const useAppState = (): AppState => {
  const store = useAppStore();
  return useSyncExternalStore(store.subscribe, store.getState);
};
