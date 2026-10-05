import type { RRow } from '../../engine';
import { formatPrice, formatR, formatSignedMoney } from '../../domain/format';
import styles from './PriceLadder.module.css';

const LEVEL: Record<Exclude<RRow['kind'], 'target'>, string> = {
  r1: '+1R',
  r2: '+2R',
  r3: '+3R',
  entry: 'Entry',
  stop: 'Stop',
};

const label = (row: RRow): string =>
  row.kind === 'target' ? `T${row.index ?? ''}` : LEVEL[row.kind];

const tone = (row: RRow): string | undefined =>
  row.kind === 'stop' ? styles.down : row.kind === 'entry' ? styles.entry : styles.up;

/** The R table as a price ladder: highest price first, coloured rail, P&L net of costs (D2). */
export function PriceLadder({ rows }: { readonly rows: readonly RRow[] }) {
  return (
    <table className={styles.ladder}>
      <caption>Scenarios, not forecasts</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="vh">Level</span>
          </th>
          <th scope="col">Price</th>
          <th scope="col">R</th>
          <th scope="col">P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.kind}-${row.index ?? ''}`}
            className={[tone(row), row.kind === 'target' ? styles.target : ''].join(' ')}
          >
            <th scope="row">{label(row)}</th>
            <td>
              {formatPrice(row.price)}
              {row.offTick && (
                <span className={styles.offTick} title="Not a multiple of the tick">
                  *<span className="vh"> not on the tick grid</span>
                </span>
              )}
            </td>
            <td>{formatR(row.rMultiple)}</td>
            <td className={styles.pnl}>{formatSignedMoney(row.pnl)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
