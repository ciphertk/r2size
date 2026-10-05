import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { exact } from '../../engine/__tests__/exact';
import {
  formatMoney,
  formatPct,
  formatPrice,
  formatQty,
  formatR,
  formatRisk,
  formatRiskPct,
  formatSignedMoney,
  formatTyped,
  MINUS,
} from '../format';

describe('format (en-IN, exact)', () => {
  it('groups in lakhs and crores', () => {
    expect(formatMoney(exact('2000000'))).toBe('₹20,00,000.00');
    expect(formatMoney(exact('275800'))).toBe('₹2,75,800.00');
    expect(formatMoney(exact('123456789.5'))).toBe('₹12,34,56,789.50');
    expect(formatMoney(exact('999.995'))).toBe('₹1,000.00');
    expect(formatQty(2758n)).toBe('2,758');
    expect(formatQty(1234567n)).toBe('12,34,567');
    expect(formatQty(0n)).toBe('0');
    expect(formatQty(-5n)).toBe(`${MINUS}5`);
  });

  it('formats prices and percentages to 2 places, half away from zero', () => {
    expect(formatPrice(exact('1000.05'))).toBe('1,000.05');
    expect(formatPrice(exact('93'))).toBe('93.00');
    expect(formatPct(exact('13.79'))).toBe('13.79%');
    expect(formatPct(exact('14.285'))).toBe('14.29%');
    expect(formatR(exact('92/35'))).toBe('2.63');
    expect(formatR(exact('-1'))).toBe(`${MINUS}1.00`);
  });

  it('never understates risk (M2-D4)', () => {
    expect(formatRisk(exact('19995.5'))).toBe('₹19,995.50');
    expect(formatRisk(exact('14999.04237'))).toBe('₹14,999.05');
    expect(formatRiskPct(exact('0.999775'))).toBe('1.00%');
    expect(formatRiskPct(exact('0.99995'))).toBe('1.00%');
    expect(formatRiskPct(exact('0.5'))).toBe('0.50%');
  });

  it('signs P&L with a real minus sign', () => {
    expect(formatSignedMoney(exact('50057.7'))).toBe('+50,057.70');
    expect(formatSignedMoney(exact('-19995.5'))).toBe(`${MINUS}19,995.50`);
    expect(formatSignedMoney(exact('0'))).toBe('0.00');
    expect(formatSignedMoney(exact('0.001'))).toBe('0.00');
  });

  it('groups typed text without changing it', () => {
    expect(formatTyped('2000000')).toBe('20,00,000');
    expect(formatTyped('20,00,000')).toBe('20,00,000');
    expect(formatTyped('100.5')).toBe('100.5');
    expect(formatTyped('100.')).toBe('100.');
    expect(formatTyped('007')).toBe('7');
    expect(formatTyped('')).toBe('');
    expect(formatTyped('abc')).toBe('abc');
    expect(formatTyped('1e3')).toBe('1e3');
  });

  it('keeps the value: removing the separators gives back the exact rounded number', () => {
    fc.assert(
      // Up to ₹9,99,99,99,99,999.99 — the parser's 12-integer-digit limit.
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 14n - 1n }), (paise) => {
        const value = exact(`${paise / 100n}.${(paise % 100n).toString().padStart(2, '0')}`);
        const shown = formatMoney(value).replace(/[₹,]/g, '');
        expect(exact(shown)).toEqual(value);
      }),
    );
  });
});
