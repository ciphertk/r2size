import { CSPProvider } from '@base-ui/react/csp-provider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import { isStandalone, watchInstall } from './infra/install';
import { requestPersistence } from './infra/persist';
import { canonicalizeLocation } from './infra/route';
import { flushPendingHash } from './infra/url-hash';
import { startServiceWorker } from './infra/sw';
import { installTrustedTypesPolicy } from './infra/trusted-types';
import { AppStoreContext, createAppStore } from './state/app-store';
import { App } from './ui/app/App';

// Unknown paths become "/" (keeping the setup hash) before anything reads the URL (M4-D1).
canonicalizeLocation();

const store = createAppStore();
store.connect();

// Offline support and the update notice (ADR-007). Dev has no service worker. The Trusted Types
// policy must exist first: registering the worker is the app's only script sink.
installTrustedTypesPolicy();
if (import.meta.env.PROD) startServiceWorker();

// The setup reaches the URL 300 ms after typing stops. Write it at once when the page is hidden
// or unloaded (reload, tab close, iOS backgrounding the app), so the last edit is never lost.
window.addEventListener('pagehide', flushPendingHash);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPendingHash();
});

// Once installed, ask the browser not to evict this app's storage (architecture §4).
watchInstall(() => void requestPersistence());
if (isStandalone()) void requestPersistence();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      {/* No inline <style> tags from Base UI, so the CSP can keep style-src 'self' (ADR-006). */}
      <CSPProvider disableStyleElements>
        <AppStoreContext.Provider value={store}>
          <App />
        </AppStoreContext.Provider>
      </CSPProvider>
    </StrictMode>,
  );
}
