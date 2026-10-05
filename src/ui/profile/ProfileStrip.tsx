import { INFO_TEXT } from '../../domain/messages';
import { fieldProps, type FieldContext } from '../calculator/field-props';
import { InfoTip } from '../shared/InfoTip';
import { NumberField } from '../shared/NumberField';
import styles from './ProfileStrip.module.css';

/** Equity and available cash. Kept on screen only until saving arrives in Milestone 3 (M2-D6). */
export function ProfileStrip(context: FieldContext) {
  return (
    <section className={styles.strip} aria-label="Account">
      <div className={styles.fields}>
        <NumberField
          {...fieldProps(context, 'equity')}
          prefix="₹"
          aside={<InfoTip topic="Equity" text={INFO_TEXT.equity} />}
        />
        <NumberField
          {...fieldProps(context, 'availableCash')}
          label="Available cash (optional)"
          prefix="₹"
          aside={<InfoTip topic="Available cash" text={INFO_TEXT.availableCash} />}
        />
      </div>
      <p className={styles.note}>Kept on this screen only. Saving is coming soon.</p>
    </section>
  );
}
