/**
 * The sizing engine: pure, exact and total (architecture §3).
 * computeSizing never throws; every problem comes back as an error code.
 */
import type { FieldError, Warning } from './errors';
import { parseDecimal } from './decimal';
import { div, gt, HUNDRED, isPositive, mul, q } from './rational';
import { buildRTable } from './r-table';
import {
  bindingConstraint,
  finalQuantity,
  percentOf,
  perShareRisk,
  quantities,
  riskBudget,
  times,
} from './size';
import { computeStop } from './stop';
import { autoTick, isOnTick, nearBandEdge, NSE_TICK_TABLE } from './tick-bands';
import type { Binding, Rational, RawForm, SizingOutcome, StopInfo, TickInfo } from './types';
import { PLACES, validate } from './validate';

export type { ErrorCode, FieldError, Warning, WarningCode } from './errors';
export type * from './types';
export { NSE_TICK_TABLE } from './tick-bands';
export { decimal, parseDecimal, toDecimalString } from './decimal';
export type { Rounding } from './decimal';
export { PLACES } from './validate';

/** Risk above this % of equity is allowed but warned about. */
const HIGH_RISK_PCT = q(5n);

const tickInfo = (entry: Rational, override: Rational | undefined): TickInfo => ({
  value: override ?? autoTick(entry),
  source: override === undefined ? 'auto' : 'override',
  bandsEffectiveFrom: NSE_TICK_TABLE.effectiveFrom,
  nearBandEdge: override === undefined && nearBandEdge(entry),
});

export interface StopPreview {
  readonly tick: TickInfo;
  readonly stop?: StopInfo;
}

/** Values that make every non-stop field valid, so a preview depends only on entry, stop and tick. */
const NEUTRAL: Partial<RawForm> = {
  riskMode: 'percent',
  riskPct: '1',
  riskAmount: '',
  equity: '1',
  availableCash: '',
  maxAllocationPct: '',
  costPct: '',
  targets: ['', '', ''],
};

/**
 * The tick and stop as soon as entry and stop are valid, before equity or risk are filled in,
 * so the trader sees "Stop 93.00" while still typing. Null until entry is a valid price.
 */
export const previewStop = (raw: RawForm): StopPreview | null => {
  const validation = validate({ ...raw, ...NEUTRAL });
  if (validation.ok) {
    const tick = tickInfo(validation.input.entry, validation.input.tickOverride);
    const stop = computeStop(validation.input.entry, validation.input.stop, tick.value);
    return stop.ok ? { tick, stop: stop.stop } : { tick };
  }
  const entry = parseDecimal(raw.entry, PLACES.price);
  if (entry.kind !== 'value' || !isPositive(entry.value)) return null;
  const override = parseDecimal(raw.tick, PLACES.price);
  return {
    tick: tickInfo(
      entry.value,
      override.kind === 'value' && isPositive(override.value) ? override.value : undefined,
    ),
  };
};

const ZERO_QTY_CODE = {
  risk: 'qtyZeroRisk',
  allocation: 'qtyZeroAllocation',
  cash: 'qtyZeroCash',
} as const satisfies Record<Binding, FieldError['code']>;

export const computeSizing = (raw: RawForm): SizingOutcome => {
  const validation = validate(raw);
  if (!validation.ok) return { ok: false, errors: validation.errors, partial: {} };
  const { input, nonBlocking } = validation;

  const tick = tickInfo(input.entry, input.tickOverride);

  const stopOutcome = computeStop(input.entry, input.stop, tick.value);
  if (!stopOutcome.ok)
    return { ok: false, errors: [stopOutcome.error, ...nonBlocking], partial: { tick } };
  const { stop } = stopOutcome;

  const perShare = perShareRisk(input.entry, stop.price, input.costPct);
  const budget = riskBudget(input.risk, input.equity);
  const qty = quantities({
    entry: input.entry,
    equity: input.equity,
    budget,
    perShare,
    ...(input.maxAllocationPct === undefined ? {} : { maxAllocationPct: input.maxAllocationPct }),
    ...(input.availableCash === undefined ? {} : { availableCash: input.availableCash }),
  });
  const binding = bindingConstraint(qty);
  const quantity = finalQuantity(qty);

  if (quantity < 1n) {
    return {
      ok: false,
      errors: [{ field: 'form', code: ZERO_QTY_CODE[binding], blocking: true }, ...nonBlocking],
      partial: { tick, stop, perShare, riskBudget: budget, qty, binding },
    };
  }

  const investment = times(quantity, input.entry);
  const actualRisk = times(quantity, perShare.total);

  const warnings: Warning[] = [
    ...(tick.nearBandEdge ? [{ code: 'tickEstimateNearBandEdge' } as const] : []),
    ...(isOnTick(input.entry, tick.value)
      ? []
      : [{ code: 'priceOffTick', field: 'entry' } as const]),
    ...stopOutcome.warnings,
    ...input.targets
      .filter((t) => !isOnTick(t.price, tick.value))
      .map((t) => ({ code: 'targetOffTick', field: `target${t.index}` }) as const),
    ...(gt(budget, div(mul(input.equity, HIGH_RISK_PCT), HUNDRED))
      ? [
          {
            code: 'highRiskPct',
            field: input.risk.kind === 'percent' ? 'riskPct' : 'riskAmount',
          } as const,
        ]
      : []),
    ...(input.availableCash !== undefined && gt(input.availableCash, input.equity)
      ? [{ code: 'cashExceedsEquity', field: 'availableCash' } as const]
      : []),
  ];

  return {
    ok: true,
    result: {
      entry: input.entry,
      tick,
      stop,
      perShare,
      riskBudget: budget,
      qty,
      quantity,
      binding,
      uncappedQuantity: qty.byRisk,
      investment,
      allocationPct: percentOf(investment, input.equity),
      actualRisk,
      actualRiskPct: percentOf(actualRisk, input.equity),
      rTable: buildRTable({
        entry: input.entry,
        stop: stop.price,
        tick: tick.value,
        perShare,
        quantity,
        equity: input.equity,
        targets: input.targets,
      }),
      warnings,
    },
    fieldErrors: nonBlocking,
  };
};
