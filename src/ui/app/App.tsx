import { useState } from 'react';
import { readHash } from '../../infra/url-hash';
import { useAppStore } from '../../state/app-store';
import { startupState } from '../../state/startup';
import { CalculatorScreen } from '../calculator/CalculatorScreen';
import styles from './App.module.css';

export function App() {
  const store = useAppStore();
  // Worked out once, on launch (M3-D5): a link wins, then the last preset, then blank.
  const [startup] = useState(() => startupState(store.getState().doc, readHash()));
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className={styles.bar}>
        <span className={styles.mark} aria-hidden="true">
          R2
        </span>
        <span className={styles.wordmark}>R2Size</span>
        <span className={styles.tagline}>Position size · NSE cash · long only</span>
        <button
          type="button"
          className={styles.icon}
          aria-label="Settings and data"
          onClick={() => setSettingsOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
        </button>
      </header>
      <main>
        <h1 className="vh">R2Size position size calculator</h1>
        <CalculatorScreen
          initial={startup.state}
          startupNotice={startup.notice}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
        />
      </main>
    </>
  );
}
