import { formatDaysAgo, formatTyped } from '../../domain/format';
import { INFO_TEXT } from '../../domain/messages';
import { daysSince, isStale } from '../../domain/staleness';
import { useAppState, useAppStore } from '../../state/app-store';
import { fieldProps, type FieldContext } from '../calculator/field-props';
import { InfoTip } from '../shared/InfoTip';
import { NumberField } from '../shared/NumberField';
import styles from './ProfileStrip.module.css';

/**
 * Equity and available cash, saved on this device when a field is left (M3-D1), with the
 * date they were last confirmed and a reminder when that is too long ago (M3-D2, D12).
 */
export function ProfileStrip(context: FieldContext) {
  const store = useAppStore();
  const { doc, storage } = useAppState();
  const { profile, settings } = doc;
  const days = profile.lastUpdated === null ? null : daysSince(profile.lastUpdated, new Date());
  const stale = days !== null && profile.equity !== null && isStale(days, settings.staleDays);

  const save = () =>
    store.actions.saveProfile(context.state.form.equity, context.state.form.availableCash);
  const equityProps = fieldProps(context, 'equity');
  const cashProps = fieldProps(context, 'availableCash');

  return (
    <section className={styles.strip} aria-label="Account">
      {stale && profile.equity !== null && days !== null && (
        <div className={styles.reminder} role="status">
          <p className={styles.reminderText}>
            Equity last updated {formatDaysAgo(days)}. Still ₹{formatTyped(profile.equity)}?
          </p>
          <div className={styles.reminderActions}>
            <button
              type="button"
              className={styles.button}
              onClick={() => store.actions.confirmProfile()}
            >
              Still correct
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => document.getElementById('field-equity')?.focus()}
            >
              Update
            </button>
          </div>
        </div>
      )}
      <div className={styles.fields}>
        <NumberField
          {...equityProps}
          onCommit={() => {
            equityProps.onCommit?.();
            save();
          }}
          prefix="₹"
          aside={<InfoTip topic="Equity" text={INFO_TEXT.equity} />}
        />
        <NumberField
          {...cashProps}
          onCommit={() => {
            cashProps.onCommit?.();
            save();
          }}
          label="Available cash (optional)"
          prefix="₹"
          aside={<InfoTip topic="Available cash" text={INFO_TEXT.availableCash} />}
        />
      </div>
      <p className={stale ? styles.noteStale : styles.note}>
        {storage === 'unavailable'
          ? 'Not saved: this browser is blocking storage.'
          : days === null
            ? 'Saved on this device when you leave the field.'
            : `Saved on this device · updated ${formatDaysAgo(days)}`}
      </p>
    </section>
  );
}
