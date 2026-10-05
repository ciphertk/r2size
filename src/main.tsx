import { CSPProvider } from '@base-ui/react/csp-provider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import { AppStoreContext, createAppStore } from './state/app-store';
import { App } from './ui/app/App';

const store = createAppStore();
store.connect();

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
