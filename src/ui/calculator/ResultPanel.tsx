import { useEffect, useRef, useState } from 'react';
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
import { copyText } from '../../infra/clipboard';
import { formErrors } from '../../state/selectors';
import { CopyButton } from '../shared/CopyButton';
import { firstTarget } from './first-target';
import { ScenariosTable } from './ScenariosTable';
import styles from './ResultPanel.module.css';

const BINDING_TEXT = {
  risk: 'Risk-bound',
  allocation: 'Allocation cap',
  cash: 'Cash cap',
} as const;

const FEEDBACK_MS = 1400;

export interface ResultPanelProps {
  readonly outcome: SizingOutcome;
  readonly symbol: string;
  /** Builds the link for this setup at the moment Share is tapped (never includes the profile). */
  readonly shareLink: () => string;
}

export function ResultPanel({ outcome, symbol, shareLink }: ResultPanelProps) {
  return (
    <aside className={styles.panel} aria-label="Result">
      {outcome.ok ? (
        <Ticket result={outcome.result} symbol={symbol} />
      ) : (
        <NoResult outcome={outcome} />
      )}
      {outcome.ok && (
        <>
          <p className={styles.note}>
            P&amp;L is after costs. A gap down can open below your stop and lose more than this.
          </p>
          {/* The ladder pane draws these; the table gives screen readers the same numbers. */}
          <div className="vh">
            <ScenariosTable rows={outcome.result.rTable} />
          </div>
          <div className={styles.share}>
            <CopyButton what="Setup link" text={shareLink}>
              Copy setup link
            </CopyButton>
            <p className={styles.shareNote}>Shares trade inputs only, never your equity or cash.</p>
          </div>
        </>
      )}
    </aside>
  );
}

interface CopyAction {
  /** The keyboard shortcut, also the identity of the row. */
  readonly key: 'c' | 'e' | 's' | 't' | 'a';
  readonly label: string;
  readonly what: string;
  readonly text: string;
  /** Shown at the end of the row, so you see what you're about to copy. */
  readonly shown: string;
}

const actionsFor = (result: SizingResult, symbol: string): CopyAction[] => {
  const target = firstTarget(result);
  return [
    {
      key: 'c',
      label: 'Copy quantity',
      what: 'Quantity',
      text: copyQty(result.quantity),
      shown: copyQty(result.quantity),
    },
    {
      key: 'e',
      label: 'Copy entry',
      what: 'Entry',
      text: copyPrice(result.entry),
      shown: copyPrice(result.entry),
    },
    {
      key: 's',
      label: 'Copy stop',
      what: 'Stop',
      text: copyPrice(result.stop.price),
      shown: copyPrice(result.stop.price),
    },
    ...(target
      ? [
          {
            key: 't' as const,
            label: `Copy target ${target.index ?? ''}`.trim(),
            what: 'Target',
            text: copyPrice(target.price),
            shown: copyPrice(target.price),
          },
        ]
      : []),
    {
      key: 'a',
      label: 'Copy order line',
      what: 'Trade summary',
      text: copyAllLine({
        symbol,
        quantity: result.quantity,
        entry: result.entry,
        stop: result.stop.price,
        ...(target ? { target: target.price } : {}),
      }),
      shown: '',
    },
  ];
};

/** Keys belong to whatever has focus first: fields, sliders and dialogs keep theirs. */
const shortcutAllowed = (event: KeyboardEvent): boolean => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return false;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.closest('input, textarea, select, [contenteditable], [role="slider"]')) return false;
  return document.querySelector('[role="dialog"], [role="alertdialog"]') === null;
};

function CopyActions({ actions }: { readonly actions: readonly CopyAction[] }) {
  const [state, setState] = useState<{ key: string; ok: boolean; what: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = async (action: CopyAction) => {
    const ok = await copyText(action.text);
    setState({ key: action.key, ok, what: action.what });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), FEEDBACK_MS);
  };

  // The key handler is registered once; it reads the current actions through this ref.
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!shortcutAllowed(event)) return;
      const action = latest.current.find((a) => a.key === event.key.toLowerCase());
      if (!action) return;
      event.preventDefault();
      void run(action);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <ul className={styles.actions}>
        {actions.map((action, i) => {
          const done = state?.key === action.key;
          return (
            <li key={action.key}>
              <button
                type="button"
                aria-label={action.label}
                aria-keyshortcuts={action.key.toUpperCase()}
                className={i === 0 ? `${styles.action} ${styles.primary}` : styles.action}
                data-state={done ? (state.ok ? 'copied' : 'failed') : undefined}
                onClick={() => void run(action)}
              >
                <span key={done ? 'done' : 'idle'} className={styles.actionLabel}>
                  {done ? (state.ok ? 'Copied ✓' : 'Copy failed') : action.label}
                </span>
                <span className={styles.actionValue}>{action.shown}</span>
                <kbd className={styles.kbd} aria-hidden="true">
                  {action.key.toUpperCase()}
                </kbd>
              </button>
            </li>
          );
        })}
      </ul>
      <span role="status" className="vh">
        {state === null ? '' : state.ok ? `${state.what} copied` : `Could not copy ${state.what}`}
      </span>
    </>
  );
}

function Ticket({ result, symbol }: { readonly result: SizingResult; readonly symbol: string }) {
  const capped = result.binding !== 'risk';
  const caps = [
    result.qty.byAllocation === null ? null : `${formatQty(result.qty.byAllocation)} alloc`,
    result.qty.byCash === null ? null : `${formatQty(result.qty.byCash)} cash`,
  ].filter((cap) => cap !== null);

  return (
    <section className={styles.ticket} aria-labelledby="ticket-qty">
      <div className={styles.head}>
        <p className={styles.side}>Buy</p>
        <p className={capped ? `${styles.badge} ${styles.capped}` : styles.badge}>
          <span className={styles.badgeDot} aria-hidden="true" />
          {BINDING_TEXT[result.binding]}
          {capped && ` · ${formatQty(result.uncappedQuantity)} uncapped`}
        </p>
      </div>
      <p className={styles.qty} id="ticket-qty" aria-live="polite" aria-atomic="true">
        <span key={String(result.quantity)} className={styles.qtyNumber}>
          {formatQty(result.quantity)}
        </span>
        <span className={styles.unit}>{result.quantity === 1n ? 'share' : 'shares'}</span>
      </p>
      <p className={styles.line}>
        {symbol.trim() !== '' && `${symbol.trim().toUpperCase()} `}
        <span className={styles.sep}>@</span> {formatPrice(result.entry)}{' '}
        <span className={styles.sep}>· SL</span> {formatPrice(result.stop.price)}
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
          <dt>Per share</dt>
          <dd>
            {formatRisk(result.perShare.total)}
            {result.perShare.cost.n > 0n && (
              <span className={styles.sub}>incl. {formatMoney(result.perShare.cost)}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Caps</dt>
          <dd>
            {caps.length === 0 ? <span className={styles.sub}>None set</span> : caps.join(' · ')}
          </dd>
        </div>
      </dl>

      <CopyActions actions={actionsFor(result, symbol)} />
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
    <section className={`${styles.ticket} ${styles.empty}`}>
      <p className={styles.emptyTitle}>Your quantity appears here</p>
      <p className={styles.emptyText}>
        {missing.length > 0
          ? `Still needed: ${missing.join(', ')}.`
          : 'Check the highlighted fields.'}
      </p>
      <p className={styles.emptyText}>
        Or type a line above, like <code>tcs 4012.50 sl 3890 risk 1%</code>
      </p>
    </section>
  );
}
