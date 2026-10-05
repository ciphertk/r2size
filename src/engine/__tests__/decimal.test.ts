import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decimal, parseDecimal, toDecimalString } from '../decimal';
import { q } from '../rational';

describe('parseDecimal', () => {
  it.each([
    ['100', 2, q(100n)],
    ['100.5', 2, q(201n, 2n)],
    ['1,00,000.50', 2, q(200001n, 2n)],
    ['₹ 250', 2, q(250n)],
    ['₹2,50,000', 2, q(250000n)],
    ['  7  ', 4, q(7n)],
    ['0.0025', 4, q(1n, 400n)],
    ['.5', 2, q(1n, 2n)],
    ['5.', 2, q(5n)],
    ['007.10', 2, q(71n, 10n)],
    ['100.000', 2, q(100n)],
    ['999999999999', 2, q(999999999999n)],
    ['1 000', 2, q(1000n)],
  ])('accepts %j (max %i decimals)', (raw, places, value) => {
    expect(parseDecimal(raw, places)).toEqual({ kind: 'value', value });
  });

  it.each(['', '   ', ',', '₹', '₹ ,'])('treats %j as empty', (raw) => {
    expect(parseDecimal(raw, 2)).toEqual({ kind: 'empty' });
  });

  it.each(['abc', '1e3', '-5', '+5', '1.2.3', '.', '5%', '1_000', '0x10', 'Infinity', 'NaN', '٣'])(
    'rejects %j as not a number',
    (raw) => {
      expect(parseDecimal(raw, 2)).toEqual({ kind: 'error', code: 'notANumber' });
    },
  );

  it('rejects more decimals than the field allows', () => {
    expect(parseDecimal('1.234', 2)).toEqual({ kind: 'error', code: 'tooManyDecimals' });
    expect(parseDecimal('1.23456', 4)).toEqual({ kind: 'error', code: 'tooManyDecimals' });
    expect(parseDecimal('1.2340', 3)).toEqual({ kind: 'value', value: q(617n, 500n) });
  });

  it('rejects more than 12 integer digits', () => {
    expect(parseDecimal('1000000000000', 2)).toEqual({ kind: 'error', code: 'tooManyDigits' });
    // Leading zeros don't count: 999,999,999,999.5 has exactly 12 integer digits.
    expect(parseDecimal('000999999999999.5', 2)).toEqual({
      kind: 'value',
      value: q(1999999999999n, 2n),
    });
  });
});

describe('toDecimalString', () => {
  it.each([
    [q(201n, 2n), 2, '100.50'],
    [q(1n, 3n), 2, '0.33'],
    [q(2n, 3n), 2, '0.67'],
    [q(1n, 200n), 2, '0.01'],
    [q(1n, 201n), 2, '0.00'],
    [q(-1n, 200n), 2, '-0.01'],
    [q(-1n, 3n), 2, '-0.33'],
    [q(-1n, 1000n), 2, '0.00'],
    [q(7n), 0, '7'],
    [q(5n, 2n), 0, '3'],
    [q(123456789n, 100n), 4, '1234567.8900'],
  ])('formats %o to %i places as %s (half away from zero)', (value, places, expected) => {
    expect(toDecimalString(value, places)).toBe(expected);
  });

  it('round-trips through parseDecimal', () => {
    const value = fc
      .tuple(fc.bigInt({ min: 0n, max: 10n ** 12n - 1n }), fc.integer({ min: 0, max: 4 }))
      .map(([n, places]) => ({ value: q(n, 10n ** BigInt(places)), places }));
    fc.assert(
      fc.property(value, ({ value: v, places }) => {
        expect(parseDecimal(toDecimalString(v, places), places)).toEqual({
          kind: 'value',
          value: v,
        });
      }),
    );
  });
});

describe('decimal', () => {
  it('parses trusted literals exactly', () => {
    expect(decimal('0.05')).toEqual(q(1n, 20n));
    expect(decimal('20000')).toEqual(q(20000n));
  });

  it('rejects an untrusted literal', () => {
    expect(() => decimal('1e3')).toThrow(new RangeError('Invalid decimal literal: 1e3'));
  });
});
