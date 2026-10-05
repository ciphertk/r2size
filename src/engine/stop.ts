/**
 * Stop price by price, % below entry, or ATR × multiple. Derived stops are floored onto
 * the tick grid, i.e. away from entry for a long trade (D6). Typed stops are never rounded.
 */
import type { FieldError, Warning } from './errors';
import { div, eq, HUNDRED, isPositive, mul, ONE, sub } from './rational';
import { floorToTick, isOnTick } from './tick-bands';
import type { Rational, StopInfo, StopSpec } from './types';

export type StopOutcome =
  | { readonly ok: true; readonly stop: StopInfo; readonly warnings: readonly Warning[] }
  | { readonly ok: false; readonly error: FieldError };

const NOT_POSITIVE: StopOutcome = {
  ok: false,
  error: { field: 'form', code: 'derivedStopNotPositive', blocking: true },
};

/** Assumes a validated spec: a typed price stop is already known to be below entry. */
export const computeStop = (entry: Rational, spec: StopSpec, tick: Rational): StopOutcome => {
  if (spec.kind === 'price') {
    const warnings: Warning[] = isOnTick(spec.price, tick)
      ? []
      : [{ code: 'priceOffTick', field: 'stopPrice' }];
    return {
      ok: true,
      stop: { price: spec.price, raw: spec.price, derived: false, adjusted: false },
      warnings,
    };
  }

  const raw =
    spec.kind === 'percent'
      ? mul(entry, sub(ONE, div(spec.pct, HUNDRED)))
      : sub(entry, mul(spec.atr, spec.multiple));
  if (!isPositive(raw)) return NOT_POSITIVE;

  const price = floorToTick(raw, tick);
  if (!isPositive(price)) return NOT_POSITIVE;

  return { ok: true, stop: { price, raw, derived: true, adjusted: !eq(price, raw) }, warnings: [] };
};
