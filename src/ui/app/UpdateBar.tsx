import { useState } from 'react';
import { APP_TEXT } from '../../domain/messages';
import { applyUpdate, dismissUpdate } from '../../infra/sw';
import { flushPendingHash } from '../../infra/url-hash';
import styles from './UpdateBar.module.css';

/**
 * "New version ready" (ADR-007, M4-D4). Floating, so it never moves the screen under the
 * trader's thumb; it reloads only on Reload, after saving the setup to the URL.
 */
export function UpdateBar() {
  const [reloading, setReloading] = useState(false);
  return (
    <div className={styles.bar} role="status">
      <p className={styles.text}>{APP_TEXT.updateReady}</p>
      <button
        type="button"
        className={styles.reload}
        disabled={reloading}
        onClick={() => {
          setReloading(true);
          void applyUpdate(flushPendingHash);
        }}
      >
        {reloading ? 'Reloading…' : 'Reload'}
      </button>
      <button type="button" className={styles.later} onClick={dismissUpdate}>
        Later
      </button>
    </div>
  );
}
