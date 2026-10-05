import { describe, expect, it } from 'vitest';
import { form } from '../__fixtures__/worked-examples';
import type { RawForm } from '../types';
import { validate } from '../validate';
import { exact } from './exact';

const VALID: Partial<RawForm> = {
  entry: '100',
  stopPrice: '95',
  riskPct: '1',
  equity: '10,00,000',
};

const errorsOf = (overrides: Partial<RawForm>) => {
  const result = validate(form({ ...VALID, ...overrides }));
  return result.ok ? [] : result.errors.map((e) => [e.field, e.code, e.blocking]);
};

describe('validate', () => {
  it('builds the input with defaults and without blank optional fields', () => {
    const result = validate(form(VALID));
    expect(result).toEqual({
      ok: true,
      input: {
        entry: exact('100'),
        stop: { kind: 'price', price: exact('95') },
        risk: { kind: 'percent', pct: exact('1') },
        equity: exact('1000000'),
        costPct: exact('0'),
        targets: [],
      },
      nonBlocking: [],
    });
  });

  it('keeps optional fields when given', () => {
    const result = validate(
      form({
        ...VALID,
        tick: '0.05',
        availableCash: '50000',
        maxAllocationPct: '25',
        costPct: '0.1',
        targets: ['', '120', ''],
      }),
    );
    expect(result.ok && result.input).toMatchObject({
      tickOverride: exact('0.05'),
      availableCash: exact('50000'),
      maxAllocationPct: exact('25'),
      costPct: exact('0.1'),
      targets: [{ index: 2, price: exact('120') }],
    });
  });

  it.each<[Partial<RawForm>, unknown[]]>([
    [{ entry: '' }, ['entry', 'required', true]],
    [{ entry: '0' }, ['entry', 'mustBePositive', true]],
    [{ entry: '1000000000000' }, ['entry', 'tooManyDigits', true]],
    [{ stopPrice: '' }, ['stopPrice', 'required', true]],
    [{ stopPrice: '0' }, ['stopPrice', 'mustBePositive', true]],
    [{ stopPrice: '101' }, ['stopPrice', 'stopNotBelowEntry', true]],
    [{ stopMode: 'percent', stopPct: '' }, ['stopPct', 'required', true]],
    [{ stopMode: 'percent', stopPct: '0' }, ['stopPct', 'outOfRange', true]],
    [{ stopMode: 'percent', stopPct: '100' }, ['stopPct', 'outOfRange', true]],
    [{ stopMode: 'percent', stopPct: '1.23456' }, ['stopPct', 'tooManyDecimals', true]],
    [{ stopMode: 'atr', atr: '', atrMultiple: '2' }, ['atr', 'required', true]],
    [{ stopMode: 'atr', atr: '3', atrMultiple: '' }, ['atrMultiple', 'required', true]],
    [{ stopMode: 'atr', atr: '3', atrMultiple: '1.555' }, ['atrMultiple', 'tooManyDecimals', true]],
    [{ tick: '0' }, ['tick', 'mustBePositive', true]],
    [{ riskPct: '' }, ['riskPct', 'required', true]],
    [{ riskPct: '0' }, ['riskPct', 'outOfRange', true]],
    [{ riskPct: '100.0001' }, ['riskPct', 'outOfRange', true]],
    [{ riskMode: 'amount', riskAmount: '' }, ['riskAmount', 'required', true]],
    [{ riskMode: 'amount', riskAmount: '1000000.01' }, ['riskAmount', 'riskExceedsEquity', true]],
    [{ equity: '' }, ['equity', 'required', true]],
    [{ availableCash: '0' }, ['availableCash', 'mustBePositive', true]],
    [{ maxAllocationPct: '0' }, ['maxAllocationPct', 'outOfRange', true]],
    [{ maxAllocationPct: '100.5' }, ['maxAllocationPct', 'outOfRange', true]],
    [{ costPct: '10' }, ['costPct', 'outOfRange', true]],
  ])('%o → %o', (overrides, expected) => {
    expect(errorsOf(overrides)).toEqual([expected]);
  });

  it('accepts the boundary values', () => {
    expect(
      errorsOf({
        riskPct: '100',
        maxAllocationPct: '100',
        costPct: '0',
        stopMode: 'percent',
        stopPct: '99.9999',
      }),
    ).toEqual([]);
    expect(errorsOf({ riskMode: 'amount', riskAmount: '1000000' })).toEqual([]);
  });

  it('ignores fields of inactive modes', () => {
    expect(errorsOf({ stopPct: 'junk', atr: 'junk', riskAmount: 'junk' })).toEqual([]);
  });

  it('reports every field at once, blocking errors first', () => {
    expect(
      errorsOf({ entry: 'x', stopPrice: '', riskPct: '200', equity: '-1', targets: ['y', '', ''] }),
    ).toEqual([
      ['entry', 'notANumber', true],
      ['stopPrice', 'required', true],
      ['equity', 'notANumber', true],
      ['riskPct', 'outOfRange', true],
      ['target1', 'notANumber', false],
    ]);
  });

  it('skips cross-field checks when the other field is invalid', () => {
    expect(errorsOf({ entry: '', stopPrice: '500' })).toEqual([['entry', 'required', true]]);
    expect(errorsOf({ equity: '', riskMode: 'amount', riskAmount: '5000000' })).toEqual([
      ['equity', 'required', true],
    ]);
  });

  it('never blocks on targets', () => {
    const result = validate(form({ ...VALID, targets: ['abc', '100', '0'] }));
    expect(result.ok).toBe(true);
    expect(result.ok && result.nonBlocking.map((e) => [e.field, e.code, e.blocking])).toEqual([
      ['target1', 'notANumber', false],
      ['target2', 'targetNotAboveEntry', false],
      ['target3', 'mustBePositive', false],
    ]);
  });

  it('drops targets silently when entry is invalid', () => {
    const result = validate(form({ ...VALID, entry: '', targets: ['120', '', ''] }));
    expect(result.ok ? [] : result.errors.map((e) => e.field)).toEqual(['entry']);
  });
});
