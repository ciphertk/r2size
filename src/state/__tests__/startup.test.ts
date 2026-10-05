import { describe, expect, it } from 'vitest';
import { defaultDoc } from '../../domain/defaults';
import type { StoredDoc } from '../../domain/schema';
import { startupState } from '../startup';

const NOW = new Date('2026-10-05T10:00:00.000Z');
const doc: StoredDoc = {
  ...defaultDoc(NOW),
  profile: { equity: '2000000', availableCash: '640000', lastUpdated: NOW.toISOString() },
  settings: {
    staleDays: 7,
    defaultPresetId: 'conservative',
    persistRequested: true,
    installHintDismissed: false,
  },
};

describe('startupState (M3-D5)', () => {
  it('fills the saved profile and applies the last preset when there is no link', () => {
    const { state, notice } = startupState(doc, '');
    expect(notice).toBeNull();
    expect(state.form).toMatchObject({
      equity: '20,00,000',
      availableCash: '6,40,000',
      riskPct: '0.5',
      stopMode: 'percent',
      stopPct: '5',
    });
  });

  it("lets a link win over the preset, keeping the trader's own equity", () => {
    const { state, notice } = startupState(
      doc,
      '#v=1&sym=TCS&e=4012.50&sm=price&s=3890&rm=pct&r=1&eq=99',
    );
    expect(notice).toBeNull();
    expect(state.symbol).toBe('TCS');
    expect(state.form).toMatchObject({
      entry: '4012.50',
      stopMode: 'price',
      stopPrice: '3890',
      riskPct: '1',
      equity: '20,00,000',
    });
  });

  it('reports ignored values, newer links and unreadable links', () => {
    expect(startupState(doc, '#v=1&e=100&sp=abc').notice).toEqual({
      kind: 'ignoredValues',
      fields: ['stopPct'],
    });
    expect(startupState(doc, '#v=9&e=100').notice).toEqual({ kind: 'newerLink' });
    const invalid = startupState(doc, `#v=1&sym=${'A'.repeat(600)}`);
    expect(invalid.notice).toEqual({ kind: 'invalidLink' });
    expect(invalid.state.form.riskPct).toBe('0.5');
  });

  it('starts blank on first run', () => {
    const { state } = startupState(defaultDoc(NOW), '');
    expect(state.form.equity).toBe('');
    expect(state.form.riskPct).toBe('');
  });
});
