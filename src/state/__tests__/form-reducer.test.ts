import { describe, expect, it } from 'vitest';
import { computeSizing } from '../../engine';
import { form } from '../../engine/__fixtures__/worked-examples';
import { calcReducer, INITIAL_STATE, type CalcAction, type CalcState } from '../form-reducer';
import { fieldError, fieldWarnings, formErrors, formWarnings } from '../selectors';

const run = (...actions: CalcAction[]): CalcState => actions.reduce(calcReducer, INITIAL_STATE);

describe('calcReducer', () => {
  it('starts blank with % stop and % risk', () => {
    expect(INITIAL_STATE.form.stopMode).toBe('percent');
    expect(INITIAL_STATE.form.riskMode).toBe('percent');
    expect(computeSizing(INITIAL_STATE.form).ok).toBe(false);
  });

  it('stores what was typed, untouched', () => {
    const state = run(
      { type: 'setField', field: 'entry', value: '1,000.5' },
      { type: 'setTarget', slot: 1, value: '120' },
      { type: 'setSymbol', value: 'raymond' },
    );
    expect(state.form.entry).toBe('1,000.5');
    expect(state.form.targets).toEqual(['', '120', '']);
    expect(state.symbol).toBe('raymond');
  });

  it("keeps each mode's value when switching modes", () => {
    const state = run(
      { type: 'setField', field: 'stopPct', value: '7' },
      { type: 'setStopMode', mode: 'atr' },
      { type: 'setField', field: 'atr', value: '3' },
      { type: 'setStopMode', mode: 'percent' },
      { type: 'setRiskMode', mode: 'amount' },
    );
    expect(state.form).toMatchObject({
      stopMode: 'percent',
      stopPct: '7',
      atr: '3',
      riskMode: 'amount',
    });
  });

  it('records touched fields once', () => {
    const once = run({ type: 'touch', field: 'entry' });
    expect(calcReducer(once, { type: 'touch', field: 'entry' })).toBe(once);
    expect([
      ...run({ type: 'touch', field: 'entry' }, { type: 'touch', field: 'equity' }).touched,
    ]).toEqual(['entry', 'equity']);
  });
});

describe('selectors', () => {
  it('shows a field error only after the field is touched (M2-D5)', () => {
    const outcome = computeSizing(
      form({ entry: '100.', equity: '', stopPrice: '93', riskPct: '1' }),
    );
    expect(fieldError(outcome, new Set(), 'equity')).toBeUndefined();
    expect(fieldError(outcome, new Set(['equity']), 'equity')?.code).toBe('required');
    expect(fieldError(outcome, new Set(['entry']), 'entry')).toBeUndefined();
  });

  it('separates form-level errors and warnings from field ones', () => {
    const zero = computeSizing(
      form({ entry: '500', stopPrice: '480', riskPct: '0.01', equity: '1,00,000' }),
    );
    expect(formErrors(zero).map((e) => e.code)).toEqual(['qtyZeroRisk']);
    expect(formWarnings(zero)).toEqual([]);
    expect(fieldWarnings(zero, 'entry')).toEqual([]);

    const nearEdge = computeSizing(
      form({
        entry: '250.02',
        stopPrice: '240',
        riskPct: '1',
        equity: '10,00,000',
        targets: ['', '', ''],
      }),
    );
    expect(formWarnings(nearEdge).map((w) => w.code)).toEqual(['tickEstimateNearBandEdge']);
    expect(fieldWarnings(nearEdge, 'entry').map((w) => w.code)).toEqual(['priceOffTick']);
    expect(formErrors(nearEdge)).toEqual([]);
  });

  it('shows non-blocking target errors on a successful result', () => {
    const outcome = computeSizing(
      form({
        entry: '100',
        stopPrice: '95',
        riskPct: '1',
        equity: '10,00,000',
        targets: ['90', '', ''],
      }),
    );
    expect(outcome.ok).toBe(true);
    expect(fieldError(outcome, new Set(['target1']), 'target1')?.code).toBe('targetNotAboveEntry');
  });
});
