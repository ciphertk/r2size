/**
 * An independent, deliberately simple re-implementation of the sizing rules (PRD D1–D12),
 * used only to cross-check the engine. It shares no code with src/engine: its own parser,
 * scaled integers instead of fractions, and its own tick table read from the circular.
 *
 * Every value is an integer count of 10^-18 rupees. Inputs have at most 4 decimals and every
 * product below adds at most 8, so all intermediate values are exact at this scale.
 */
import type { RawForm } from '../types';

const SCALE = 10n ** 18n;

/** Parses a valid decimal string ("1,00,000.50", "₹ 250") into a scaled integer. */
const parse = (text: string): bigint => {
  const cleaned = text.replace(/[,₹\s]/g, '');
  const [int = '0', frac = ''] = cleaned.split('.');
  return BigInt((int || '0') + frac.padEnd(18, '0').slice(0, 18));
};

const mulS = (a: bigint, b: bigint): bigint => (a * b) / SCALE; // exact for our inputs (checked below)
const divFloor = (a: bigint, b: bigint): bigint => a / b; // both positive here

const pct = (value: bigint, percent: bigint): bigint => mulS(value, percent) / 100n;

// NSE/CMTR/67133: below 250 → 0.01; ≥ 250 to 1,000 → 0.05; > 1,000 to 5,000 → 0.10;
// > 5,000 to 10,000 → 0.50; > 10,000 to 20,000 → 1.00; > 20,000 → 5.00.
const nseTick = (price: bigint): bigint => {
  const r = (s: string) => parse(s);
  if (price < r('250')) return r('0.01');
  if (price <= r('1000')) return r('0.05');
  if (price <= r('5000')) return r('0.10');
  if (price <= r('10000')) return r('0.50');
  if (price <= r('20000')) return r('1.00');
  return r('5.00');
};

export interface OracleResult {
  readonly tick: bigint;
  readonly stop: bigint;
  readonly byRisk: bigint;
  readonly byAllocation: bigint | null;
  readonly byCash: bigint | null;
  readonly quantity: bigint;
  readonly binding: 'risk' | 'allocation' | 'cash';
  readonly actualRisk: bigint;
}

/** Assumes the form is valid and sizes to a positive stop; returns scaled integers. */
export const oracle = (form: RawForm): OracleResult => {
  const entry = parse(form.entry);
  const equity = parse(form.equity);
  const tick = form.tick.trim() === '' ? nseTick(entry) : parse(form.tick);

  let stop: bigint;
  if (form.stopMode === 'price') {
    stop = parse(form.stopPrice);
  } else {
    const raw =
      form.stopMode === 'percent'
        ? entry - pct(entry, parse(form.stopPct))
        : entry - mulS(parse(form.atr), parse(form.atrMultiple));
    stop = (raw / tick) * tick; // floor onto the grid (raw > 0)
  }

  const costPerShare = form.costPct.trim() === '' ? 0n : pct(entry, parse(form.costPct));
  const perShare = entry - stop + costPerShare;
  const budget =
    form.riskMode === 'percent' ? pct(equity, parse(form.riskPct)) : parse(form.riskAmount);

  const byRisk = divFloor(budget, perShare);
  const byAllocation =
    form.maxAllocationPct.trim() === ''
      ? null
      : divFloor(pct(equity, parse(form.maxAllocationPct)), entry);
  const byCash =
    form.availableCash.trim() === ''
      ? null
      : divFloor(parse(form.availableCash), entry + costPerShare);

  let quantity = byRisk;
  let binding: OracleResult['binding'] = 'risk';
  if (byAllocation !== null && byAllocation < quantity) {
    quantity = byAllocation;
    binding = 'allocation';
  }
  if (byCash !== null && (byCash < quantity || (binding === 'allocation' && byCash === quantity))) {
    quantity = byCash;
    binding = 'cash';
  }

  return {
    tick,
    stop,
    byRisk,
    byAllocation,
    byCash,
    quantity,
    binding,
    actualRisk: quantity * perShare,
  };
};

/** Converts an exact engine fraction to the oracle's scale; null if it is not exact at 10^-18. */
export const toScaled = (value: { n: bigint; d: bigint }): bigint | null =>
  (value.n * SCALE) % value.d === 0n ? (value.n * SCALE) / value.d : null;
