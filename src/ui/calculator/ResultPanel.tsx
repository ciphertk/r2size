import type { SizingOutcome, SizingResult } from '../../engine';
import { copyAllLine, copyPrice, copyQty } from '../../domain/copy-text';
import {
  formatMoney,
  formatPct,
  formatPrice,
  formatQty,
  formatRisk,
  formatRiskPct,
} from '../../domain/format';
import { errorText, FIELD_LABEL } from '../../domain/messages';
import { formErrors } from '../../state/selectors';
import { CopyButton } from '../shared/CopyButton';
import { PriceLadder } from './PriceLadder';
import styles from './ResultPanel.module.css';

const BINDING_TEXT = {
  risk: 'Limited by risk budget',
  allocation: 'Limited by allocation cap',
  cash: 'Limited by available cash',
} as const;

/** Target 1, else the first valid typed target (M2-D1, M2-D2). */
export const firstTarget = (result: SizingResult) =>
  result.rTable
    .filter((row) => row.kind === 'target')
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];

export interface ResultPanelProps {
  readonly outcome: SizingOutcome;
  readonly symbol: string;
}

export function ResultPanel({ outcome, symbol }: ResultPanelProps) {
  return (
    <aside className={styles.panel} aria-label="Result">
      {outcome.ok ? (
        <Ticket result={outcome.result} symbol={symbol} />
      ) : (
        <NoResult outcome={outcome} />
      )}
      {outcome.ok && (
        <>
          <PriceLadder rows={outcome.result.rTable} />
          <p className={styles.note}>
            P&amp;L is after costs. A gap down can open below your stop and lose more than this.
          </p>
        </>
      )}
    </aside>
  );
}

function Ticket({ result, symbol }: { readonly result: SizingResult; readonly symbol: string }) {
  const target = firstTarget(result);
  const capped = result.binding !== 'risk';
  const caps = [
    result.qty.byAllocation === null ? null : `${formatQty(result.qty.byAllocation)} alloc`,
    result.qty.byCash === null ? null : `${formatQty(result.qty.byCash)} cash`,
  ].filter((cap) => cap !== null);

  return (
    <section className={styles.ticket} aria-labelledby="ticket-qty">
      <div className={styles.head}>
        <p className={styles.side}>Buy</p>
        <p className={capped ? styles.bindingCapped : styles.binding}>
          {BINDING_TEXT[result.binding]}
          {capped && ` · uncapped ${formatQty(result.uncappedQuantity)}`}
        </p>
      </div>
      <p className={styles.qty} id="ticket-qty" aria-live="polite" aria-atomic="true">
        <span className={styles.qtyNumber}>{formatQty(result.quantity)}</span>
        <span className={styles.unit}>{result.quantity === 1n ? 'share' : 'shares'}</span>
      </p>
      <p className={styles.line}>
        {symbol.trim() !== '' && `${symbol.trim().toUpperCase()} `}
        <span className={styles.sep}>@</span> {formatPrice(result.entry)}{' '}
        <span className={styles.sep}>SL</span> {formatPrice(result.stop.price)}
      </p>

      <dl className={styles.facts}>
        <div>
          <dt>Risk</dt>
          <dd>
            {formatRisk(result.actualRisk)}
            <span className={styles.sub}>{formatRiskPct(result.actualRiskPct)}</span>
          </dd>
        </div>
        <div>
          <dt>Investment</dt>
          <dd>
            {formatMoney(result.investment)}
            <span className={styles.sub}>{formatPct(result.allocationPct)}</span>
          </dd>
        </div>
        <div>
          <dt>Risk / share</dt>
          <dd>
            {formatRisk(result.perShare.total)}
            {result.perShare.cost.n > 0n && (
              <span className={styles.sub}>incl. {formatMoney(result.perShare.cost)} cost</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Caps</dt>
          <dd>
            {caps.length === 0 ? <span className={styles.none}>None set</span> : caps.join(' · ')}
          </dd>
        </div>
      </dl>

      <div className={styles.copy}>
        <CopyButton variant="primary" what="Quantity" text={copyQty(result.quantity)}>
          Copy qty <span className={styles.copyQty}>{copyQty(result.quantity)}</span>
        </CopyButton>
        <div className={styles.copyMore}>
          <CopyButton what="Entry" text={copyPrice(result.entry)}>
            Entry
          </CopyButton>
          <CopyButton what="Stop" text={copyPrice(result.stop.price)}>
            Stop
          </CopyButton>
          {target && (
            <CopyButton what="Target" text={copyPrice(target.price)}>
              T{target.index}
            </CopyButton>
          )}
          <CopyButton
            what="Trade summary"
            text={copyAllLine({
              symbol,
              quantity: result.quantity,
              entry: result.entry,
              stop: result.stop.price,
              ...(target ? { target: target.price } : {}),
            })}
          >
            All
          </CopyButton>
        </div>
      </div>
    </section>
  );
}

function NoResult({ outcome }: { readonly outcome: Extract<SizingOutcome, { ok: false }> }) {
  const zero = formErrors(outcome).find((e) => e.code.startsWith('qtyZero'));
  const missing = outcome.errors.flatMap((e) =>
    e.code === 'required' && e.field !== 'form' ? [FIELD_LABEL[e.field]] : [],
  );

  if (zero) {
    return (
      <section className={styles.ticket} aria-labelledby="ticket-qty">
        <p className={styles.side}>Buy</p>
        <p className={styles.qty} id="ticket-qty">
          <span className={`${styles.qtyNumber} ${styles.zero}`}>0</span>
          <span className={styles.unit}>shares</span>
        </p>
        <p className={styles.problem} role="alert">
          {errorText(zero.code, 'form')}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.empty}>
      <p className={styles.emptyTitle}>Your quantity appears here</p>
      <p className={styles.emptyText}>
        {missing.length > 0
          ? `Still needed: ${missing.join(', ')}.`
          : 'Check the highlighted fields.'}
      </p>
    </section>
  );
}
