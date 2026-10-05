import { describe, expect, it } from 'vitest';
import { form } from '../__fixtures__/worked-examples';
import { computeSizing } from '../index';
import type { RawForm } from '../types';
import { exact } from './exact';

const BASE: Partial<RawForm> = { entry: '100', stopPrice: '95', riskPct: '1', equity: '10,00,000' };

const warningsOf = (overrides: Partial<RawForm>) => {
  const outcome = computeSizing(form({ ...BASE, ...overrides }));
  return outcome.ok ? outcome.result.warnings : [];
};

describe('computeSizing', () => {
  it('returns no partial result when validation fails', () => {
    expect(computeSizing(form({ ...BASE, equity: '' }))).toEqual({
      ok: false,
      errors: [{ field: 'equity', code: 'required', blocking: true }],
      partial: {},
    });
  });

  it('returns the tick, and keeps non-blocking errors, when the stop cannot be derived', () => {
    const outcome = computeSizing(
      form({ ...BASE, stopMode: 'atr', atr: '60', atrMultiple: '2', targets: ['abc', '', ''] }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.map((e) => [e.field, e.code])).toEqual([
      ['form', 'derivedStopNotPositive'],
      ['target1', 'notANumber'],
    ]);
    expect(outcome.partial.tick?.value).toEqual(exact('0.01'));
    expect(outcome.partial.stop).toBeUndefined();
  });

  it('returns everything computed so far when the quantity is zero', () => {
    const outcome = computeSizing(form({ ...BASE, riskPct: '0.0001', targets: ['90', '', ''] }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.map((e) => e.code)).toEqual(['qtyZeroRisk', 'targetNotAboveEntry']);
    expect(outcome.partial).toMatchObject({
      binding: 'risk',
      riskBudget: exact('1'),
      qty: { byRisk: 0n },
    });
  });

  it('marks an override tick and never flags it as near a band edge', () => {
    const outcome = computeSizing(form({ ...BASE, entry: '250', stopPrice: '240', tick: '0.05' }));
    expect(outcome.ok && outcome.result.tick).toEqual({
      value: exact('0.05'),
      source: 'override',
      bandsEffectiveFrom: '2025-04-15',
      nearBandEdge: false,
    });
    expect(outcome.ok && outcome.result.warnings).toEqual([]);
  });

  it('warns when available cash exceeds equity', () => {
    expect(warningsOf({ availableCash: '10,00,000.01' })).toEqual([
      { code: 'cashExceedsEquity', field: 'availableCash' },
    ]);
    expect(warningsOf({ availableCash: '10,00,000' })).toEqual([]);
  });

  it('warns about high risk on the field the user typed', () => {
    expect(warningsOf({ riskPct: '5' })).toEqual([]);
    expect(warningsOf({ riskPct: '5.0001' })).toEqual([{ code: 'highRiskPct', field: 'riskPct' }]);
    expect(warningsOf({ riskMode: 'amount', riskAmount: '50,000.01' })).toEqual([
      { code: 'highRiskPct', field: 'riskAmount' },
    ]);
  });

  it('warns about typed prices off the tick grid without rounding them', () => {
    const outcome = computeSizing(
      form({ ...BASE, entry: '300.02', stopPrice: '285.01', targets: ['', '', '330.03'] }),
    );
    expect(outcome.ok && outcome.result.warnings).toEqual([
      { code: 'priceOffTick', field: 'entry' },
      { code: 'priceOffTick', field: 'stopPrice' },
      { code: 'targetOffTick', field: 'target3' },
    ]);
    expect(outcome.ok && outcome.result.stop.price).toEqual(exact('285.01'));
    const stopRow = outcome.ok
      ? outcome.result.rTable.find((row) => row.kind === 'stop')
      : undefined;
    expect(stopRow?.offTick).toBe(true);
    const target = outcome.ok
      ? outcome.result.rTable.find((row) => row.kind === 'target')
      : undefined;
    expect(target).toMatchObject({ index: 3, price: exact('330.03'), offTick: true });
  });

  it('reports P&L as a % of equity and the stop row as exactly −actual risk', () => {
    // Total risk/share 5 + 0.25 = 5.25; Q = floor(10,000 / 5.25) = 1,904; actual risk 1,904 × 5.25 = 9,996.
    const outcome = computeSizing(form({ ...BASE, costPct: '0.25' }));
    if (!outcome.ok) expect.fail('expected a result');
    const stopRow = outcome.result.rTable.find((row) => row.kind === 'stop');
    expect(outcome.result.actualRisk).toEqual(exact('9996'));
    expect(stopRow?.pnl).toEqual(exact('-9996'));
    expect(stopRow?.pnlPctOfEquity).toEqual(exact('-0.9996'));
  });
});
