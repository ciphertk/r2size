import styles from './NoticeBar.module.css';

export interface NoticeBarProps {
  readonly text: string;
  readonly tone?: 'info' | 'caution';
  readonly onDismiss: () => void;
}

/** A one-line message about the app itself (storage, imports, links), dismissible. */
export function NoticeBar({ text, tone = 'info', onDismiss }: NoticeBarProps) {
  return (
    <div className={tone === 'caution' ? styles.caution : styles.info} role="status">
      <p className={styles.text}>{text}</p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>
  );
}
