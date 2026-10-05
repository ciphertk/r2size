import { lazy, Suspense, useState, useSyncExternalStore } from 'react';
import { APP_TEXT } from '../../domain/messages';
import { isIosSafari, isStandalone } from '../../infra/install';
import { navigate } from '../../infra/route';
import { isUpdateWaiting, subscribeToUpdate } from '../../infra/sw';
import { readHash } from '../../infra/url-hash';
import { useAppState, useAppStore } from '../../state/app-store';
import { startupState } from '../../state/startup';
import { CalculatorScreen } from '../calculator/CalculatorScreen';
import { NoticeBar } from '../shared/NoticeBar';
import styles from './App.module.css';
import { UpdateBar } from './UpdateBar';
import { useRoute } from './use-route';
import { Wordmark } from './Wordmark';

// ADR-008: the Guide is its own chunk, loaded on demand (and precached for offline use).
const GuidePage = lazy(() => import('../guide/GuidePage').then((m) => ({ default: m.GuidePage })));

const go =
  (path: '/' | '/guide') =>
  (event: { preventDefault: () => void }): void => {
    event.preventDefault();
    navigate(path);
  };

/**
 * The calculator, set up from the URL hash each time it is shown (M3-D5): on launch, and when
 * coming back from the Guide, so Back restores the setup.
 */
function CalculatorRoute(props: {
  readonly settingsOpen: boolean;
  readonly onSettingsOpenChange: (open: boolean) => void;
}) {
  const store = useAppStore();
  const [startup] = useState(() => startupState(store.getState().doc, readHash()));
  return (
    <>
      <h1 className="vh">R2Size position size calculator</h1>
      <CalculatorScreen
        initial={startup.state}
        startupNotice={startup.notice}
        settingsOpen={props.settingsOpen}
        onSettingsOpenChange={props.onSettingsOpenChange}
      />
    </>
  );
}

export function App() {
  const route = useRoute();
  const store = useAppStore();
  const { doc } = useAppState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const updateWaiting = useSyncExternalStore(subscribeToUpdate, isUpdateWaiting, () => false);
  const showInstallHint =
    route === 'calculator' &&
    !doc.settings.installHintDismissed &&
    isIosSafari() &&
    !isStandalone();

  return (
    <>
      <header className={styles.bar}>
        <a href="/" className={styles.brand} onClick={go('/')}>
          <Wordmark height={15} />
        </a>
        <span className={styles.tagline}>Position size · NSE cash · long only</span>
        <a
          href="/guide"
          className={styles.link}
          aria-current={route === 'guide' ? 'page' : undefined}
          onClick={go('/guide')}
        >
          Guide
        </a>
        {route === 'calculator' && (
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
        )}
      </header>
      {showInstallHint && (
        <div className={styles.hint}>
          <NoticeBar
            text={APP_TEXT.iosInstallHint}
            tone="info"
            onDismiss={() => store.actions.dismissInstallHint()}
          />
        </div>
      )}
      <main>
        {route === 'guide' ? (
          <Suspense fallback={<p className={styles.loading}>Loading the Guide…</p>}>
            <GuidePage />
          </Suspense>
        ) : (
          <CalculatorRoute settingsOpen={settingsOpen} onSettingsOpenChange={setSettingsOpen} />
        )}
      </main>
      {updateWaiting && <UpdateBar />}
    </>
  );
}
