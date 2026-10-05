import { describe, expect, it } from 'vitest';
import { exact } from '../../engine/__tests__/exact';
import { copyAllLine, copyPrice, copyQty } from '../copy-text';
import { errorText, FIELD_LABEL, warningText } from '../messages';

describe('copy text (M2-D1, M2-D3)', () => {
  it('copies plain digits for broker fields', () => {
    expect(copyQty(2758n)).toBe('2758');
    expect(copyQty(123456n)).toBe('123456');
    expect(copyPrice(exact('100'))).toBe('100.00');
    expect(copyPrice(exact('1000.05'))).toBe('1000.05');
    expect(copyPrice(exact('118.4'))).toBe('118.40');
  });

  it('matches the brief\'s "Copy all" example', () => {
    expect(
      copyAllLine({
        symbol: 'RAYMOND',
        quantity: 2857n,
        entry: exact('100'),
        stop: exact('93'),
        target: exact('114'),
      }),
    ).toBe('RAYMOND · BUY 2,857 · LMT ₹100.00 · SL ₹93.00 · TGT ₹114.00');
  });

  it('drops a blank symbol and a missing target, and upper-cases the symbol', () => {
    expect(
      copyAllLine({ symbol: '  ', quantity: 2758n, entry: exact('100'), stop: exact('93') }),
    ).toBe('BUY 2,758 · LMT ₹100.00 · SL ₹93.00');
    expect(
      copyAllLine({ symbol: 'tcs', quantity: 12n, entry: exact('4012.5'), stop: exact('3890') }),
    ).toBe('TCS · BUY 12 · LMT ₹4,012.50 · SL ₹3,890.00');
  });
});

describe('messages', () => {
  it('words field-specific errors', () => {
    expect(errorText('tooManyDecimals', 'entry')).toBe('Use at most 2 decimal places.');
    expect(errorText('tooManyDecimals', 'stopPct')).toBe('Use at most 4 decimal places.');
    expect(errorText('tooManyDecimals', 'form')).toBe('Use at most 2 decimal places.');
    expect(errorText('outOfRange', 'costPct')).toBe('Use from 0% up to, but not including, 10%.');
    expect(errorText('outOfRange', 'entry')).toBe('Out of range.');
    expect(errorText('qtyZeroCash', 'form')).toMatch(/available cash/);
  });

  it('words warnings and labels', () => {
    expect(warningText('highRiskPct')).toMatch(/5%/);
    expect(FIELD_LABEL.maxAllocationPct).toBe('Max allocation');
  });
});
