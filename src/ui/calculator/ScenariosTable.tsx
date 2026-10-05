import type { RRow } from '../../engine';
import { formatPrice, formatR, formatSignedMoney } from '../../domain/format';

const LEVEL: Record<Exclude<RRow['kind'], 'target'>, string> = {
  r1: '+1R',
  r2: '+2R',
  r3: '+3R',
  entry: 'Entry',
  stop: 'Stop',
};

const label = (row: RRow): string =>
  row.kind === 'target' ? `T${row.index ?? ''}` : LEVEL[row.kind];

/**
 * The R table (D2) for screen readers: the ladder pane draws these levels, and this table gives
 * the same numbers in reading order, highest price first, with P&L net of costs. It is rendered
 * visually hidden, so it carries no styles of its own.
 */
export function ScenariosTable({ rows }: { readonly rows: readonly RRow[] }) {
  return (
    <table>
      <caption>Scenarios, not forecasts</caption>
      <thead>
        <tr>
          <th scope="col">Level</th>
          <th scope="col">Price</th>
          <th scope="col">R</th>
          <th scope="col">P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.kind}-${row.index ?? ''}`}>
            <th scope="row">{label(row)}</th>
            <td>
              {formatPrice(row.price)}
              {row.offTick && ' (not on the tick grid)'}
            </td>
            <td>{formatR(row.rMultiple)}</td>
            <td>{formatSignedMoney(row.pnl)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
