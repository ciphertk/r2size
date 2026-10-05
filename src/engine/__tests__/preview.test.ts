import { describe, expect, it } from 'vitest';
import { form } from '../__fixtures__/worked-examples';
import { previewStop } from '../index';
import { exact } from './exact';

describe('previewStop', () => {
  it('is null until entry is a valid price', () => {
    expect(previewStop(form({}))).toBeNull();
    expect(previewStop(form({ entry: 'abc' }))).toBeNull();
    expect(previewStop(form({ entry: '0' }))).toBeNull();
  });

  it('shows the tick as soon as entry is valid, ignoring equity and risk', () => {
    expect(previewStop(form({ entry: '250', equity: '', riskPct: '' }))).toEqual({
      tick: {
        value: exact('0.05'),
        source: 'auto',
        bandsEffectiveFrom: '2025-04-15',
        nearBandEdge: true,
      },
    });
  });

  it('uses a valid tick override, and ignores an invalid one', () => {
    expect(previewStop(form({ entry: '100', tick: '0.05' }))?.tick).toMatchObject({
      value: exact('0.05'),
      source: 'override',
      nearBandEdge: false,
    });
    expect(previewStop(form({ entry: '100', tick: '0' }))?.tick).toMatchObject({
      value: exact('0.01'),
      source: 'auto',
    });
  });

  it('derives the stop with only entry and stop filled in', () => {
    const preview = previewStop(form({ entry: '100', stopMode: 'percent', stopPct: '7' }));
    expect(preview?.stop).toEqual({
      price: exact('93'),
      raw: exact('93'),
      derived: true,
      adjusted: false,
    });
  });

  it('gives the tick but no stop when the stop is invalid or impossible', () => {
    expect(previewStop(form({ entry: '100', stopPrice: '120' }))).toMatchObject({
      tick: { value: exact('0.01') },
    });
    expect(previewStop(form({ entry: '100', stopPrice: '120' }))?.stop).toBeUndefined();
    const impossible = previewStop(
      form({ entry: '100', stopMode: 'atr', atr: '60', atrMultiple: '2' }),
    );
    expect(impossible?.tick.value).toEqual(exact('0.01'));
    expect(impossible?.stop).toBeUndefined();
  });

  it('agrees with computeSizing once the whole form is valid', async () => {
    const { computeSizing } = await import('../index');
    const raw = form({
      entry: '512.35',
      stopMode: 'atr',
      atr: '7.33',
      atrMultiple: '1.5',
      riskPct: '1',
      equity: '10,00,000',
    });
    const outcome = computeSizing(raw);
    expect(outcome.ok && { tick: outcome.result.tick, stop: outcome.result.stop }).toEqual(
      previewStop(raw),
    );
  });
});
