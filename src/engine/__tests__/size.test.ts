import { describe, expect, it } from 'vitest';
import {
  bindingConstraint,
  finalQuantity,
  percentOf,
  perShareRisk,
  quantities,
  riskBudget,
  times,
} from '../size';
import type { Quantities } from '../types';
import { exact } from './exact';

describe('perShareRisk (D1)', () => {
  it('adds cost per share = entry × cost% to the price risk', () => {
    expect(perShareRisk(exact('100'), exact('95'), exact('0.25'))).toEqual({
      priceRisk: exact('5'),
      cost: exact('0.25'),
      total: exact('5.25'),
    });
  });
});

describe('riskBudget', () => {
  it('takes a % of equity or a ₹ amount', () => {
    expect(riskBudget({ kind: 'percent', pct: exact('1') }, exact('2000000'))).toEqual(
      exact('20000'),
    );
    expect(riskBudget({ kind: 'amount', rupees: exact('7500') }, exact('2000000'))).toEqual(
      exact('7500'),
    );
  });
});

describe('quantities (D3)', () => {
  it('floors each candidate; the cash cap includes cost per share', () => {
    expect(
      quantities({
        entry: exact('100'),
        equity: exact('1000000'),
        budget: exact('10000'),
        perShare: perShareRisk(exact('100'), exact('98'), exact('0.25')),
        maxAllocationPct: exact('15'),
        availableCash: exact('250000'),
      }),
    ).toEqual({ byRisk: 4444n, byAllocation: 1500n, byCash: 2493n });
  });

  it('leaves absent caps as null', () => {
    expect(
      quantities({
        entry: exact('100'),
        equity: exact('1000000'),
        budget: exact('10000'),
        perShare: perShareRisk(exact('100'), exact('95'), exact('0')),
      }),
    ).toEqual({ byRisk: 2000n, byAllocation: null, byCash: null });
  });
});

describe('bindingConstraint and finalQuantity', () => {
  const qty = (byRisk: bigint, byAllocation: bigint | null, byCash: bigint | null): Quantities => ({
    byRisk,
    byAllocation,
    byCash,
  });

  it.each<[Quantities, string, bigint]>([
    [qty(10n, null, null), 'risk', 10n],
    [qty(10n, 20n, null), 'risk', 10n],
    [qty(10n, null, 20n), 'risk', 10n],
    [qty(10n, 10n, 10n), 'risk', 10n],
    [qty(10n, 5n, null), 'allocation', 5n],
    [qty(10n, null, 5n), 'cash', 5n],
    [qty(10n, 5n, 7n), 'allocation', 5n],
    [qty(10n, 7n, 5n), 'cash', 5n],
    [qty(10n, 5n, 5n), 'cash', 5n],
    [qty(10n, 20n, 5n), 'cash', 5n],
    [qty(10n, 5n, 20n), 'allocation', 5n],
    [qty(0n, 0n, 0n), 'risk', 0n],
  ])('%o → %s, quantity %s', (q, binding, quantity) => {
    expect(bindingConstraint(q)).toBe(binding);
    expect(finalQuantity(q)).toBe(quantity);
  });
});

describe('helpers', () => {
  it('computes exact percentages and products', () => {
    expect(percentOf(exact('275800'), exact('2000000'))).toEqual(exact('13.79'));
    expect(times(2758n, exact('7.25'))).toEqual(exact('19995.5'));
  });
});
