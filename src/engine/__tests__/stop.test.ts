import { describe, expect, it } from 'vitest';
import { computeStop } from '../stop';
import { exact } from './exact';

describe('computeStop', () => {
  it('uses a typed stop as is and warns when it is off the tick grid', () => {
    expect(
      computeStop(exact('300'), { kind: 'price', price: exact('285.02') }, exact('0.05')),
    ).toEqual({
      ok: true,
      stop: { price: exact('285.02'), raw: exact('285.02'), derived: false, adjusted: false },
      warnings: [{ code: 'priceOffTick', field: 'stopPrice' }],
    });
    expect(
      computeStop(exact('300'), { kind: 'price', price: exact('285') }, exact('0.05')),
    ).toMatchObject({
      ok: true,
      warnings: [],
    });
  });

  it('derives a % stop exactly (200 × 95% = 190, not 189.99)', () => {
    expect(computeStop(exact('200'), { kind: 'percent', pct: exact('5') }, exact('0.01'))).toEqual({
      ok: true,
      stop: { price: exact('190'), raw: exact('190'), derived: true, adjusted: false },
      warnings: [],
    });
  });

  it('floors a derived stop away from entry', () => {
    expect(
      computeStop(
        exact('512.35'),
        { kind: 'atr', atr: exact('7.33'), multiple: exact('1.5') },
        exact('0.05'),
      ),
    ).toEqual({
      ok: true,
      stop: { price: exact('501.35'), raw: exact('501.355'), derived: true, adjusted: true },
      warnings: [],
    });
  });

  it('rejects an ATR stop at or below zero', () => {
    const expected = {
      ok: false,
      error: { field: 'form', code: 'derivedStopNotPositive', blocking: true },
    };
    expect(
      computeStop(
        exact('100'),
        { kind: 'atr', atr: exact('50'), multiple: exact('2') },
        exact('0.01'),
      ),
    ).toEqual(expected);
    expect(
      computeStop(
        exact('100'),
        { kind: 'atr', atr: exact('60'), multiple: exact('2') },
        exact('0.01'),
      ),
    ).toEqual(expected);
  });

  it('rejects a derived stop that floors to zero', () => {
    // 0.01 × 50% = 0.005, which floors to 0.00 on the 0.01 grid.
    expect(
      computeStop(exact('0.01'), { kind: 'percent', pct: exact('50') }, exact('0.01')),
    ).toEqual({
      ok: false,
      error: { field: 'form', code: 'derivedStopNotPositive', blocking: true },
    });
  });
});
