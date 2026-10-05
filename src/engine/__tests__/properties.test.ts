import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decimal } from '../decimal';
import { computeSizing } from '../index';
import { add, div, gt, HUNDRED, lte, lt, mul, neg, q, sub } from '../rational';
import { isOnTick } from '../tick-bands';
import type { RawForm, SizingResult } from '../types';
import { anyForm, fixed, numberishForm, validForm } from './arbitraries';

const RUNS = { numRuns: 1000 };

const sized = (form: RawForm): SizingResult | null => {
  const outcome = computeSizing(form);
  return outcome.ok ? outcome.result : null;
};

const pctOf = (value: string, percent: string) =>
  div(mul(decimal(value), decimal(percent)), HUNDRED);

describe('totality', () => {
  it('never throws, whatever the input', () => {
    fc.assert(
      fc.property(anyForm, (form) => void computeSizing(form)),
      RUNS,
    );
    fc.assert(
      fc.property(numberishForm, (form) => void computeSizing(form)),
      RUNS,
    );
  });

  it('returns either a quantity of at least 1 or at least one blocking error', () => {
    fc.assert(
      fc.property(fc.oneof(validForm, numberishForm), (form) => {
        const outcome = computeSizing(form);
        if (outcome.ok) {
          expect(outcome.result.quantity >= 1n).toBe(true);
          expect(outcome.fieldErrors.every((e) => !e.blocking)).toBe(true);
        } else {
          expect(outcome.errors.some((e) => e.blocking)).toBe(true);
        }
      }),
      RUNS,
    );
  });
});

describe('sizing invariants (architecture §9)', () => {
  it('never risks more than the budget, and uses the whole budget when risk binds', () => {
    fc.assert(
      fc.property(validForm, (form) => {
        const r = sized(form);
        if (r === null) return;
        expect(lte(r.actualRisk, r.riskBudget)).toBe(true);
        expect(r.uncappedQuantity >= r.quantity).toBe(true);
        if (r.binding === 'risk') {
          expect(gt(mul(q(r.quantity + 1n), r.perShare.total), r.riskBudget)).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('respects the allocation and cash caps', () => {
    fc.assert(
      fc.property(validForm, (form) => {
        const r = sized(form);
        if (r === null) return;
        const entry = decimal(form.entry);
        if (form.maxAllocationPct !== '') {
          expect(lte(r.investment, pctOf(form.equity, form.maxAllocationPct))).toBe(true);
        }
        if (form.availableCash !== '') {
          expect(
            lte(mul(q(r.quantity), add(entry, r.perShare.cost)), decimal(form.availableCash)),
          ).toBe(true);
        }
        const candidates = [r.qty.byRisk, r.qty.byAllocation, r.qty.byCash].filter(
          (x): x is bigint => x !== null,
        );
        expect(r.quantity).toBe(candidates.reduce((a, b) => (b < a ? b : a)));
      }),
      RUNS,
    );
  });

  it('puts a derived stop on the tick grid, within one tick below the raw stop', () => {
    fc.assert(
      fc.property(validForm, (form) => {
        const r = sized(form);
        if (r === null || !r.stop.derived) return;
        expect(isOnTick(r.stop.price, r.tick.value)).toBe(true);
        expect(lte(r.stop.price, r.stop.raw)).toBe(true);
        expect(lt(sub(r.stop.raw, r.tick.value), r.stop.price)).toBe(true);
      }),
      RUNS,
    );
  });

  it('makes the stop row P&L exactly −actual risk, and orders the R table by price', () => {
    fc.assert(
      fc.property(validForm, (form) => {
        const r = sized(form);
        if (r === null) return;
        const stopRow = r.rTable.find((row) => row.kind === 'stop');
        expect(stopRow?.pnl).toEqual(neg(r.actualRisk));
        r.rTable.slice(1).forEach((row, i) => {
          const previous = r.rTable[i];
          expect(previous !== undefined && lte(row.price, previous.price)).toBe(true);
        });
      }),
      RUNS,
    );
  });
});

describe('monotonicity', () => {
  const bump = (text: string, delta: bigint, places: number): string =>
    fixed((decimal(text).n * 10n ** BigInt(places)) / decimal(text).d + delta, places);

  it('a higher risk % never lowers the quantity', () => {
    fc.assert(
      fc.property(validForm, fc.bigInt({ min: 1n, max: 5000n }), (form, delta) => {
        if (form.riskMode !== 'percent') return;
        const lower = sized(form);
        const higher = sized({ ...form, riskPct: bump(form.riskPct, delta, 4) });
        if (lower === null || higher === null) return;
        expect(higher.quantity >= lower.quantity).toBe(true);
      }),
      RUNS,
    );
  });

  it('a wider stop never raises the quantity', () => {
    fc.assert(
      fc.property(validForm, fc.bigInt({ min: 1n, max: 5000n }), (form, delta) => {
        if (form.stopMode !== 'percent') return;
        const tight = sized(form);
        const wide = sized({ ...form, stopPct: bump(form.stopPct, delta, 4) });
        if (tight === null || wide === null) return;
        expect(wide.quantity <= tight.quantity).toBe(true);
      }),
      RUNS,
    );
  });

  it('a higher cost never raises the quantity', () => {
    fc.assert(
      fc.property(validForm, fc.bigInt({ min: 1n, max: 5000n }), (form, delta) => {
        const base = form.costPct === '' ? '0' : form.costPct;
        const cheap = sized({ ...form, costPct: base });
        const dear = sized({ ...form, costPct: bump(base, delta, 4) });
        if (cheap === null || dear === null) return;
        expect(dear.quantity <= cheap.quantity).toBe(true);
      }),
      RUNS,
    );
  });

  it('a tighter allocation cap never raises the quantity', () => {
    fc.assert(
      fc.property(validForm, fc.bigInt({ min: 1n, max: 5000n }), (form, delta) => {
        if (form.maxAllocationPct === '') return;
        const loose = sized(form);
        const lowered =
          (decimal(form.maxAllocationPct).n * 10_000n) / decimal(form.maxAllocationPct).d - delta;
        if (lowered <= 0n) return;
        const tight = sized({ ...form, maxAllocationPct: fixed(lowered, 4) });
        if (loose === null || tight === null) return;
        expect(tight.quantity <= loose.quantity).toBe(true);
      }),
      RUNS,
    );
  });
});
