import { render } from '@testing-library/preact';
import type { ReactNode } from 'react';
import { AppStoreContext, createAppStore, type AppStore } from '../../state/app-store';
import { browserStorage } from '../../infra/storage';

/** Renders inside a fresh app store backed by (happy-dom) localStorage, as main.tsx does. */
export const renderWithStore = (ui: ReactNode, store: AppStore = freshStore()) => ({
  store,
  ...render(<AppStoreContext.Provider value={store}>{ui}</AppStoreContext.Provider>),
});

export const freshStore = (now: () => Date = () => new Date()): AppStore =>
  createAppStore({
    storage: browserStorage,
    now,
    persist: async () => 'granted',
    newId: (() => {
      let n = 0;
      return () => `test-${(n += 1)}`;
    })(),
  });
