import { describe, expect, it } from 'vitest';
import { decimal } from '../decimal';
import { lt } from '../rational';
import { autoTick, floorToTick, isOnTick, nearBandEdge, NSE_TICK_TABLE } from '../tick-bands';

describe('NSE_TICK_TABLE', () => {
  it('cites the circular and its effective date', () => {
    expect(NSE_TICK_TABLE.effectiveFrom).toBe('2025-04-15');
    expect(NSE_TICK_TABLE.source).toContain('NSE/CMTR/67133');
    expect(NSE_TICK_TABLE.sourceUrl).toMatch(/^https:\/\/nsearchives\.nseindia\.com\//);
  });

  it('has strictly increasing bounds and ticks, with only the last band open-ended', () => {
    const bands = NSE_TICK_TABLE.bands;
    bands.forEach((band, i) => {
      expect(band.upTo === null).toBe(i === bands.length - 1);
      const next = bands[i + 1];
      if (next === undefined) return;
      expect(lt(decimal(band.tick), decimal(next.tick))).toBe(true);
      if (band.upTo !== null && next.upTo !== null) {
        expect(lt(decimal(band.upTo), decimal(next.upTo))).toBe(true);
      }
    });
  });
});

describe('autoTick (boundaries per NSE/CMTR/67133)', () => {
  it.each([
    ['0.05', '0.01'],
    ['249.99', '0.01'],
    ['250', '0.05'],
    ['999.95', '0.05'],
    ['1000', '0.05'],
    ['1000.05', '0.10'],
    ['5000', '0.10'],
    ['5000.10', '0.50'],
    ['10000', '0.50'],
    ['10000.50', '1.00'],
    ['20000', '1.00'],
    ['20000.01', '5.00'],
    ['20001', '5.00'],
    ['150000', '5.00'],
  ])('price %s → tick %s', (price, tick) => {
    expect(autoTick(decimal(price))).toEqual(decimal(tick));
  });
});

describe('nearBandEdge (±10% of a boundary)', () => {
  it.each([
    ['224.99', false],
    ['225', true],
    ['240', true],
    ['275', true],
    ['275.01', false],
    ['300', false],
    ['900', true],
    ['1100', true],
    ['4500', true],
    ['5500', true],
    ['7000', false],
    ['9000', true],
    ['18000', true],
    ['22000', true],
    ['22000.01', false],
    ['100', false],
  ])('%s → %s', (price, expected) => {
    expect(nearBandEdge(decimal(price))).toBe(expected);
  });
});

describe('floorToTick / isOnTick', () => {
  it.each([
    ['501.355', '0.05', '501.35'],
    ['501.40', '0.05', '501.40'],
    ['1.035', '0.01', '1.03'],
    ['19000.95', '5', '19000'],
    ['96.67', '0.05', '96.65'],
  ])('floor %s to %s grid = %s', (price, tick, expected) => {
    expect(floorToTick(decimal(price), decimal(tick))).toEqual(decimal(expected));
  });

  it('detects prices on and off the grid', () => {
    expect(isOnTick(decimal('330'), decimal('0.05'))).toBe(true);
    expect(isOnTick(decimal('330.12'), decimal('0.05'))).toBe(false);
    expect(isOnTick(decimal('5000.10'), decimal('0.50'))).toBe(false);
  });
});
