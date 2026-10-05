/**
 * The R table: scenarios, not forecasts. R = entry − stop (price-based, D2); P&L is net of
 * the same cost per share used for sizing, so the stop row equals −actual risk.
 */
import { add, cmp, div, mul, neg, q, sub } from './rational';
import { floorToTick, isOnTick } from './tick-bands';
import { percentOf, times } from './size';
import type { PerShare, Rational, RRow, TargetInput } from './types';

export interface RTableInput {
  readonly entry: Rational;
  readonly stop: Rational;
  readonly tick: Rational;
  readonly perShare: PerShare;
  readonly quantity: bigint;
  readonly equity: Rational;
  readonly targets: readonly TargetInput[];
}

const R_MULTIPLES = [
  ['r1', 1n],
  ['r2', 2n],
  ['r3', 3n],
] as const;

export const buildRTable = (input: RTableInput): readonly RRow[] => {
  const { entry, stop, tick, perShare, quantity, equity } = input;
  const r = perShare.priceRisk;
  const totalCost = times(quantity, perShare.cost);

  const row = (
    kind: RRow['kind'],
    price: Rational,
    offTick: boolean,
    rMultiple?: Rational,
  ): RRow => {
    const pnl = sub(times(quantity, sub(price, entry)), totalCost);
    return {
      kind,
      price,
      rMultiple: rMultiple ?? div(sub(price, entry), r),
      pnl,
      pnlPctOfEquity: percentOf(pnl, equity),
      offTick,
    };
  };

  const rows: RRow[] = [
    // D4: +kR prices are floored onto the tick (toward entry), so they are never optimistic.
    ...R_MULTIPLES.map(([kind, k]) =>
      row(kind, floorToTick(add(entry, mul(q(k), r)), tick), false),
    ),
    ...input.targets.map((t) => ({
      ...row('target', t.price, !isOnTick(t.price, tick)),
      index: t.index,
    })),
    row('entry', entry, false, q(0n)),
    row('stop', stop, !isOnTick(stop, tick), neg(q(1n))),
  ];

  // Highest price first; Array.prototype.sort is stable, so equal prices keep the order above.
  return rows.sort((a, b) => cmp(b.price, a.price));
};
