import { computeSizing, decimal, type SizingResult } from '../../engine';
import { WORKED_EXAMPLES } from '../../engine/__fixtures__/worked-examples';
import {
  formatMoney,
  formatPct,
  formatPrice,
  formatQty,
  formatRisk,
  formatRiskPct,
  formatTyped,
} from '../../domain/format';
import styles from './GuidePage.module.css';

/**
 * The design mockup's setup, computed live by the engine from the same fixture the tests use
 * (ADR-008), so the Guide's arithmetic can never drift from the app's.
 */
const EXAMPLE = WORKED_EXAMPLES.find((e) => e.name.startsWith('mockup'));

function Row({ label, formula, value }: { label: string; formula: string; value: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className={styles.formula}>{formula}</td>
      <td className={styles.value}>{value}</td>
    </tr>
  );
}

export function WorkedExample() {
  if (!EXAMPLE) return null;
  const outcome = computeSizing(EXAMPLE.raw);
  if (!outcome.ok) return null;
  const r: SizingResult = outcome.result;
  const raw = EXAMPLE.raw;
  const equity = formatMoney(decimal(raw.equity.replace(/,/g, '')));

  return (
    <>
      <p className={styles.lede}>
        Equity {equity}, risk {raw.riskPct}%, entry ₹{formatTyped(raw.entry)}, stop {raw.stopPct}%
        below, round-trip cost {raw.costPct}%, max allocation {raw.maxAllocationPct}%, available
        cash ₹{formatTyped(raw.availableCash)}.
      </p>
      {/* Scrolls sideways on narrow phones, so it must be reachable by keyboard. */}
      <div className={styles.tableWrap} role="region" aria-label="Worked example" tabIndex={0}>
        <table className={styles.table}>
          <caption className="vh">Worked example, step by step</caption>
          <tbody>
            <Row
              label="Risk budget"
              formula={`${equity} × ${raw.riskPct}%`}
              value={formatMoney(r.riskBudget)}
            />
            <Row
              label="Stop"
              formula={`${formatPrice(r.entry)} × (1 − ${raw.stopPct}%), down to the ${formatPrice(r.tick.value)} tick`}
              value={formatPrice(r.stop.price)}
            />
            <Row
              label="Risk per share"
              formula={`(${formatPrice(r.entry)} − ${formatPrice(r.stop.price)}) + ${formatPrice(r.entry)} × ${raw.costPct}%`}
              value={formatRisk(r.perShare.total)}
            />
            <Row
              label="By risk"
              formula={`⌊${formatMoney(r.riskBudget)} ÷ ${formatRisk(r.perShare.total)}⌋`}
              value={formatQty(r.qty.byRisk)}
            />
            {r.qty.byAllocation !== null && (
              <Row
                label="Allocation cap"
                formula={`⌊${equity} × ${raw.maxAllocationPct}% ÷ ${formatPrice(r.entry)}⌋`}
                value={formatQty(r.qty.byAllocation)}
              />
            )}
            {r.qty.byCash !== null && (
              <Row
                label="Cash cap"
                formula={`⌊₹${formatTyped(raw.availableCash)} ÷ (${formatPrice(r.entry)} + ${formatPrice(r.perShare.cost)})⌋`}
                value={formatQty(r.qty.byCash)}
              />
            )}
            <Row
              label="Quantity"
              formula="the smallest of the three"
              value={`${formatQty(r.quantity)} shares`}
            />
            <Row
              label="Actual risk"
              formula={`${formatQty(r.quantity)} × ${formatRisk(r.perShare.total)}`}
              value={`${formatRisk(r.actualRisk)} (${formatRiskPct(r.actualRiskPct)})`}
            />
            <Row
              label="Investment"
              formula={`${formatQty(r.quantity)} × ${formatPrice(r.entry)}`}
              value={`${formatMoney(r.investment)} (${formatPct(r.allocationPct)})`}
            />
          </tbody>
        </table>
      </div>
    </>
  );
}
