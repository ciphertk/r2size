import { useMemo, useState } from 'react';
import { computeSizing } from '../../engine';
import {
  formatPrice,
  formatQty,
  formatR,
  formatRisk,
  formatRiskPct,
  formatSignedMoney,
} from '../../domain/format';
import styles from './LadderPane.module.css';
import { useLadder, type Ladder, type LadderInput } from './use-ladder';

/** Round price gridlines (1, 2, 2.5 or 5 × 10ⁿ), about six across the visible range. */
const gridlines = (low: number, high: number): number[] => {
  const raw = (high - low) / 6;
  if (!(raw > 0)) return [];
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const lines: number[] = [];
  for (let v = Math.ceil(low / step) * step; v < high; v += step) {
    lines.push(Math.round(v * 100) / 100);
  }
  return lines;
};

/** "What if": the quantity with the stop at the hovered price, or the R of a target there. */
function Ghost({
  input,
  ladder,
  price,
}: {
  input: LadderInput;
  ladder: Omit<Ladder, 'box'>;
  price: number;
}) {
  const below = price < ladder.entry;
  const snapped = ladder.snap(price);
  const form = input.state.form;
  const quantity = useMemo(() => {
    if (!below) return null;
    const outcome = computeSizing({ ...form, stopMode: 'price', stopPrice: snapped });
    return outcome.ok ? outcome.result.quantity : null;
  }, [below, snapped, form]);
  const rMultiple = (Number(snapped) - ladder.entry) / ladder.r;
  return (
    <div
      className={styles.ghost}
      data-side={below ? 'loss' : 'gain'}
      style={ladder.place(Number(snapped))}
      aria-hidden="true"
    >
      <span className={styles.ghostTag}>
        {below ? 'Stop' : 'Target'} {snapped}
        <span className={styles.ghostArrow}>→</span>
        {below
          ? quantity === null
            ? 'no size'
            : `${formatQty(quantity)} sh`
          : `${rMultiple.toFixed(2)}R`}
        <span className={styles.ghostHint}>click to set</span>
      </span>
    </div>
  );
}

function Chart(input: LadderInput) {
  const { box: chartRef, ...ladder } = useLadder(input);
  const { result } = input;
  const [hover, setHover] = useState<number | null>(null);

  if (!ladder.ready) {
    return (
      <div className={styles.empty}>
        <p>Enter an entry and a stop to draw the trade.</p>
      </div>
    );
  }

  const stopRow = result?.rTable.find((row) => row.kind === 'stop');
  const targetRow = result?.rTable.find((row) => row.kind === 'target' && row.index === 1);
  const rewardTop = ladder.hasTarget ? ladder.target : ladder.entry + 2 * ladder.r;
  const band = (from: number, to: number) => ({
    top: `${ladder.pos(from)}%`,
    height: `${ladder.pos(to) - ladder.pos(from)}%`,
  });

  return (
    <div
      ref={chartRef}
      className={styles.chart}
      data-dragging={ladder.dragging ? '' : undefined}
      onPointerMove={(event) => {
        if (event.pointerType !== 'mouse' || ladder.dragging) return;
        const price = ladder.priceAt(event);
        const onLine = [ladder.stop, ladder.entry, ladder.target].some(
          (p) => Number.isFinite(p) && Math.abs(ladder.pos(p) - ladder.pos(price)) < 2.5,
        );
        setHover(onLine || !(price > 0) ? null : price);
      }}
      onPointerLeave={() => setHover(null)}
      onClick={(event) => {
        // Mouse only: it places exactly what the preview showed. A tap on a phone never moves
        // a line by accident (and click events round clientY to whole pixels anyway).
        if (hover === null) return;
        if ((event.target as HTMLElement).closest('[role="slider"], button')) return;
        ladder.placeAt(hover);
        setHover(null);
      }}
    >
      {gridlines(ladder.domain.low, ladder.domain.high).map((v) => (
        <span key={v} className={styles.grid} style={ladder.place(v)} aria-hidden="true">
          <span>{v.toFixed(2)}</span>
        </span>
      ))}

      <div className={styles.zoneLoss} style={band(ladder.entry, ladder.stop)} aria-hidden="true">
        {result && (
          <span className={styles.zoneLabel}>
            Risk {formatRisk(result.actualRisk)} · {formatRiskPct(result.actualRiskPct)}
          </span>
        )}
      </div>
      <div
        className={styles.zoneGain}
        data-ghost={ladder.hasTarget ? undefined : ''}
        style={band(rewardTop, ladder.entry)}
        aria-hidden="true"
      >
        <span className={styles.zoneLabel}>
          {targetRow
            ? `Reward ${formatSignedMoney(targetRow.pnl)} · ${formatR(targetRow.rMultiple)}R`
            : 'No target yet'}
        </span>
      </div>

      {ladder.levels
        .filter(({ price }) => !ladder.crowded(price))
        .map(({ row, price }) => (
          <div
            key={row.kind}
            className={styles.level}
            style={ladder.place(price)}
            aria-hidden="true"
          >
            <span>
              +{row.kind.slice(1)}R · {formatPrice(row.price)} <i>{formatSignedMoney(row.pnl)}</i>
            </span>
          </div>
        ))}

      {ladder.hasTarget && (
        <div className={styles.handle} {...ladder.handle('target', 'Target')}>
          <span className={styles.line} />
          <span className={styles.tag}>
            <span className={styles.grip} aria-hidden="true" />
            Target <b>{ladder.target.toFixed(2)}</b>
            {targetRow && <span className={styles.tagDetail}>{formatR(targetRow.rMultiple)}R</span>}
          </span>
        </div>
      )}
      <div className={styles.handle} {...ladder.handle('entry', 'Entry')}>
        <span className={styles.line} />
        <span className={styles.tag}>
          <span className={styles.grip} aria-hidden="true" />
          Entry <b>{ladder.entry.toFixed(2)}</b>
          {result && <span className={styles.tagDetail}>{formatQty(result.quantity)} sh</span>}
        </span>
      </div>
      <div className={styles.handle} {...ladder.handle('stop', 'Stop')}>
        <span className={styles.line} />
        <span className={styles.tag}>
          <span className={styles.grip} aria-hidden="true" />
          Stop <b>{ladder.stop.toFixed(2)}</b>
          {stopRow && <span className={styles.tagDetail}>{formatSignedMoney(stopRow.pnl)}</span>}
        </span>
      </div>

      {!ladder.hasTarget && (
        <button
          type="button"
          className={styles.addTarget}
          style={ladder.place(ladder.entry + 2 * ladder.r)}
          onClick={ladder.addTarget}
        >
          + Target at 2R
        </button>
      )}

      {hover !== null && !ladder.dragging && <Ghost input={input} ladder={ladder} price={hover} />}
    </div>
  );
}

/**
 * The trade on a price axis: drag the stop, entry and target lines (snapped to the tick), or
 * focus one and use ↑↓ (Shift for 10 ticks). Hover previews; click places a stop or target.
 * Collapsible on narrow screens, where it sits between the command bar and the fields.
 */
export function LadderPane(input: LadderInput) {
  const [open, setOpen] = useState(true);
  const stop = input.preview?.stop ? formatPrice(input.preview.stop.price) : null;
  return (
    <section className={styles.pane} data-open={open ? '' : undefined} aria-label="Price ladder">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls="ladder-body"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Price ladder</span>
        <span className={styles.toggleMeta}>
          {stop !== null && input.state.form.entry !== ''
            ? `${input.state.form.entry} → SL ${stop}`
            : ''}
          <span className={styles.chevron} aria-hidden="true" />
        </span>
      </button>
      <p className={styles.help}>Drag a line, or focus it and use ↑↓ (⇧ ×10). Click to place.</p>
      <div id="ladder-body" className={styles.body}>
        <Chart {...input} />
      </div>
      {input.state.form.stopMode !== 'price' && (
        <p className={styles.note}>Moving the stop line switches the stop to a price.</p>
      )}
    </section>
  );
}
