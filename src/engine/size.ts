/**
 * Risk per share, risk budget, the three candidate quantities and which one binds.
 */
import { add, div, floor, HUNDRED, mul, q, sub } from './rational';
import type { Binding, PerShare, Quantities, Rational, RiskSpec } from './types';

/** D1: cost per share = entry × cost%, and it counts toward risk. */
export const perShareRisk = (entry: Rational, stop: Rational, costPct: Rational): PerShare => {
  const priceRisk = sub(entry, stop);
  const cost = div(mul(entry, costPct), HUNDRED);
  return { priceRisk, cost, total: add(priceRisk, cost) };
};

export const riskBudget = (risk: RiskSpec, equity: Rational): Rational =>
  risk.kind === 'percent' ? div(mul(equity, risk.pct), HUNDRED) : risk.rupees;

export interface QuantityInput {
  readonly entry: Rational;
  readonly equity: Rational;
  readonly budget: Rational;
  readonly perShare: PerShare;
  readonly maxAllocationPct?: Rational;
  readonly availableCash?: Rational;
}

/** D3: the allocation cap uses entry only; the cash cap includes cost per share. */
export const quantities = (input: QuantityInput): Quantities => ({
  byRisk: floor(div(input.budget, input.perShare.total)),
  byAllocation:
    input.maxAllocationPct === undefined
      ? null
      : floor(div(div(mul(input.equity, input.maxAllocationPct), HUNDRED), input.entry)),
  byCash:
    input.availableCash === undefined
      ? null
      : floor(div(input.availableCash, add(input.entry, input.perShare.cost))),
});

const lteBig = (a: bigint, b: bigint | null): boolean => b === null || a <= b;

/**
 * "risk" when no cap is below the risk quantity (ties go to risk: no cap reduced the size);
 * otherwise the smaller cap, with a tie between the two caps reported as "cash".
 */
export const bindingConstraint = (qty: Quantities): Binding => {
  if (lteBig(qty.byRisk, qty.byAllocation) && lteBig(qty.byRisk, qty.byCash)) return 'risk';
  if (qty.byAllocation === null) return 'cash';
  if (qty.byCash === null) return 'allocation';
  return qty.byCash <= qty.byAllocation ? 'cash' : 'allocation';
};

/** The smallest of the risk quantity and any caps. */
export const finalQuantity = (qty: Quantities): bigint =>
  [qty.byAllocation, qty.byCash].reduce<bigint>(
    (lowest, cap) => (cap !== null && cap < lowest ? cap : lowest),
    qty.byRisk,
  );

export const percentOf = (part: Rational, whole: Rational): Rational =>
  mul(div(part, whole), HUNDRED);

/** qty × value, exactly. */
export const times = (qty: bigint, value: Rational): Rational => mul(q(qty), value);
