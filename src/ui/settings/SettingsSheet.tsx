import { useEffect, useRef, useState } from 'react';
import { backupFileName, parseBackup, toBackup } from '../../domain/backup';
import { formatShortDate, formatTyped } from '../../domain/format';
import { BACKUP_PROBLEM_TEXT } from '../../domain/messages';
import type { Preset, StoredDoc } from '../../domain/schema';
import { saveTextFile } from '../../infra/download';
import { isPersisted } from '../../infra/persist';
import { useAppState, useAppStore } from '../../state/app-store';
import { Confirm, Sheet } from '../shared/Sheet';
import styles from './SettingsSheet.module.css';

export interface SettingsSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onEditPreset: (preset: Preset) => void;
}

const shortDate = (iso: string | null) => (iso === null ? 'never' : formatShortDate(iso));

/** Reminder interval, presets, backup and reset: everything kept on this device. */
export function SettingsSheet({ open, onOpenChange, onEditPreset }: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Settings & data">
      {open && <SettingsBody onEditPreset={onEditPreset} />}
    </Sheet>
  );
}

function SettingsBody({ onEditPreset }: Pick<SettingsSheetProps, 'onEditPreset'>) {
  const store = useAppStore();
  const { doc, canUndoImport, storage } = useAppState();
  const [staleText, setStaleText] = useState(String(doc.settings.staleDays));
  const [staleError, setStaleError] = useState<string | null>(null);
  const [preview, setPreview] = useState<StoredDoc | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void isPersisted().then((value) => {
      if (live) setPersisted(value);
    });
    return () => {
      live = false;
    };
  }, []);

  const commitStaleDays = () => {
    const days = /^[0-9]{1,2}$/.test(staleText.trim()) ? Number(staleText.trim()) : NaN;
    if (!(days >= 1 && days <= 90)) {
      setStaleError('Use a whole number of days from 1 to 90.');
      return;
    }
    setStaleError(null);
    store.actions.setStaleDays(days);
  };

  const exportBackup = async () => {
    const now = new Date();
    const result = await saveTextFile(backupFileName(now), toBackup(doc, now));
    setExportResult(
      result === 'failed'
        ? 'Could not save the file.'
        : result === 'cancelled'
          ? null
          : 'Backup saved.',
    );
  };

  const readFile = async (file: File) => {
    setImportError(null);
    setPreview(null);
    const result = parseBackup(await file.text());
    if (result.ok) setPreview(result.doc);
    else setImportError(BACKUP_PROBLEM_TEXT[result.problem]);
  };

  return (
    <div className={styles.body}>
      <section className={styles.section} aria-labelledby="settings-reminder">
        <h3 id="settings-reminder" className={styles.heading}>
          Equity reminder
        </h3>
        <label className={styles.inline} htmlFor="stale-days">
          Remind me to check my equity after
          <input
            id="stale-days"
            className={styles.days}
            inputMode="numeric"
            value={staleText}
            aria-invalid={staleError ? true : undefined}
            aria-describedby={staleError ? 'stale-days-error' : undefined}
            onChange={(event) => setStaleText(event.target.value)}
            onBlur={commitStaleDays}
          />
          days
        </label>
        {staleError && (
          <p id="stale-days-error" className={styles.error}>
            {staleError}
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="settings-presets">
        <h3 id="settings-presets" className={styles.heading}>
          Presets
        </h3>
        {doc.presets.length === 0 ? (
          <p className={styles.muted}>No presets. Use the + chip to save one from a setup.</p>
        ) : (
          <ul className={styles.list}>
            {doc.presets.map((preset) => (
              <li key={preset.id} className={styles.item}>
                <span>
                  {preset.name}{' '}
                  <span className={styles.muted}>
                    {preset.riskPct}% risk ·{' '}
                    {preset.stop.kind === 'percent'
                      ? `${preset.stop.pct}% stop`
                      : `${preset.stop.multiple}× ATR`}
                  </span>
                </span>
                <button type="button" className={styles.small} onClick={() => onEditPreset(preset)}>
                  Edit<span className="vh"> {preset.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="settings-backup">
        <h3 id="settings-backup" className={styles.heading}>
          Backup
        </h3>
        <p className={styles.muted}>
          Everything stays on this device. Export a backup to move to another phone, or before
          clearing your browser.
        </p>
        <div className={styles.buttons}>
          <button type="button" className={styles.button} onClick={() => void exportBackup()}>
            Export backup
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => fileInput.current?.click()}
          >
            Import backup…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="vh"
            tabIndex={-1}
            aria-label="Backup file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void readFile(file);
            }}
          />
        </div>
        {exportResult && (
          <p role="status" className={styles.muted}>
            {exportResult}
          </p>
        )}
        {importError && (
          <p role="alert" className={styles.error}>
            {importError}
          </p>
        )}
        {preview && (
          <div className={styles.preview} role="group" aria-label="Import preview">
            <p>
              Replace your data with: equity{' '}
              {preview.profile.equity === null
                ? 'not set'
                : `₹${formatTyped(preview.profile.equity)}`}{' '}
              (updated {shortDate(preview.profile.lastUpdated)}), {preview.presets.length} preset
              {preview.presets.length === 1 ? '' : 's'}?
            </p>
            <div className={styles.buttons}>
              <button type="button" className={styles.button} onClick={() => setPreview(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  store.actions.importDoc(preview);
                  setPreview(null);
                }}
              >
                Replace my data
              </button>
            </div>
          </div>
        )}
        {canUndoImport && !preview && (
          <button
            type="button"
            className={styles.button}
            onClick={() => store.actions.undoImport()}
          >
            Undo import
          </button>
        )}
      </section>

      <section className={styles.section} aria-labelledby="settings-storage">
        <h3 id="settings-storage" className={styles.heading}>
          Storage
        </h3>
        <p className={styles.muted}>
          {storage === 'unavailable'
            ? 'This browser is not letting R2Size save anything.'
            : storage === 'readOnly'
              ? 'Read-only: your saved data is from a newer version.'
              : persisted === true
                ? 'Protected: the browser will not clear it on its own.'
                : 'Saved, but the browser may clear it if space runs low. Installing the app helps; keep a backup.'}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="settings-reset">
        <h3 id="settings-reset" className={styles.heading}>
          Reset
        </h3>
        <button type="button" className={styles.danger} onClick={() => setConfirmReset(true)}>
          Delete all data on this device
        </button>
        <Confirm
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title="Delete all data?"
          description="Your equity, cash, presets and settings will be removed from this device. Export a backup first if you want to keep them."
          confirmLabel="Delete everything"
          onConfirm={() => store.actions.resetAll()}
        />
      </section>
    </div>
  );
}
