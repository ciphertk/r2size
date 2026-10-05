import type { SizingResult } from '../../engine';
import { copyQty } from '../../domain/copy-text';
import { formatQty, formatRisk } from '../../domain/format';
import { CopyButton } from '../shared/CopyButton';
import styles from './Dock.module.css';

/** Phone-only bar: the quantity and Copy stay in thumb reach while typing (design doc layout). */
export function Dock({ result }: { readonly result: SizingResult }) {
  return (
    <section className={styles.dock} aria-label="Quick copy">
      <p className={styles.qty}>
        <span className={styles.side}>Buy</span> {formatQty(result.quantity)}
      </p>
      <p className={styles.risk}>risk {formatRisk(result.actualRisk)}</p>
      <div className={styles.action}>
        <CopyButton variant="primary" what="Quantity" text={copyQty(result.quantity)}>
          Copy quantity
        </CopyButton>
      </div>
    </section>
  );
}
