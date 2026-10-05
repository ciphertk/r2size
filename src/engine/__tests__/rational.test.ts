import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  add,
  cmp,
  div,
  eq,
  floor,
  gt,
  gte,
  HUNDRED,
  isPositive,
  lt,
  lte,
  max,
  min,
  mul,
  neg,
  ONE,
  q,
  sub,
  ZERO,
} from '../rational';

const big = fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n });
const nonZero = big.filter((b) => b !== 0n);
const rational = fc.tuple(big, nonZero).map(([n, d]) => q(n, d));
const nonZeroRational = fc.tuple(nonZero, nonZero).map(([n, d]) => q(n, d));

describe('q', () => {
  it('reduces and normalises the sign onto the numerator', () => {
    expect(q(6n, 8n)).toEqual({ n: 3n, d: 4n });
    expect(q(3n, -6n)).toEqual({ n: -1n, d: 2n });
    expect(q(-3n, -6n)).toEqual({ n: 1n, d: 2n });
    expect(q(0n, -7n)).toEqual({ n: 0n, d: 1n });
    expect(q(5n)).toEqual({ n: 5n, d: 1n });
  });

  it('rejects a zero denominator', () => {
    expect(() => q(1n, 0n)).toThrow(new RangeError('Rational with zero denominator'));
  });

  it('always produces a reduced fraction with a positive denominator', () => {
    fc.assert(
      fc.property(big, nonZero, (n, d) => {
        const r = q(n, d);
        expect(r.d > 0n).toBe(true);
        expect(eq(q(r.n * d, r.d * d), r)).toBe(true);
        let a = r.n < 0n ? -r.n : r.n;
        let b = r.d;
        while (b !== 0n) [a, b] = [b, a % b];
        expect(r.n === 0n ? r.d === 1n : a === 1n).toBe(true);
      }),
    );
  });
});

describe('arithmetic', () => {
  it('computes exact sums, differences, products and quotients', () => {
    expect(add(q(1n, 3n), q(1n, 6n))).toEqual(q(1n, 2n));
    expect(sub(q(1n, 2n), q(3n, 4n))).toEqual(q(-1n, 4n));
    expect(mul(q(2n, 3n), q(9n, 4n))).toEqual(q(3n, 2n));
    expect(div(q(1n, 2n), q(-1n, 4n))).toEqual(q(-2n));
    expect(neg(q(3n, 5n))).toEqual(q(-3n, 5n));
    expect(HUNDRED).toEqual(q(100n));
    expect(ONE).toEqual(q(1n));
  });

  it('rejects division by zero', () => {
    expect(() => div(ONE, ZERO)).toThrow(new RangeError('Division by zero'));
  });

  it('satisfies the field laws', () => {
    fc.assert(
      fc.property(rational, rational, rational, (a, b, c) => {
        expect(add(add(a, b), c)).toEqual(add(a, add(b, c)));
        expect(mul(a, add(b, c))).toEqual(add(mul(a, b), mul(a, c)));
        expect(sub(add(a, b), b)).toEqual(a);
      }),
    );
    fc.assert(
      fc.property(rational, nonZeroRational, (a, b) => {
        expect(mul(div(a, b), b)).toEqual(a);
      }),
    );
  });
});

describe('comparison', () => {
  it('orders fractions exactly', () => {
    expect(cmp(q(1n, 3n), q(1n, 3n))).toBe(0);
    expect(cmp(q(1n, 3n), q(1n, 2n))).toBe(-1);
    expect(cmp(q(-1n, 3n), q(-1n, 2n))).toBe(1);
    expect(lt(q(1n, 3n), q(1n, 2n))).toBe(true);
    expect(lt(q(1n, 2n), q(1n, 2n))).toBe(false);
    expect(lte(q(1n, 2n), q(1n, 2n))).toBe(true);
    expect(lte(q(2n, 3n), q(1n, 2n))).toBe(false);
    expect(gt(q(2n, 3n), q(1n, 2n))).toBe(true);
    expect(gt(q(1n, 2n), q(1n, 2n))).toBe(false);
    expect(gte(q(1n, 2n), q(1n, 2n))).toBe(true);
    expect(gte(q(1n, 3n), q(1n, 2n))).toBe(false);
    expect(eq(q(2n, 4n), q(1n, 2n))).toBe(true);
    expect(eq(q(1n, 3n), q(1n, 2n))).toBe(false);
    expect(min(q(1n, 3n), q(1n, 2n))).toEqual(q(1n, 3n));
    expect(min(q(1n, 2n), q(1n, 3n))).toEqual(q(1n, 3n));
    expect(max(q(1n, 3n), q(1n, 2n))).toEqual(q(1n, 2n));
    expect(max(q(1n, 2n), q(1n, 3n))).toEqual(q(1n, 2n));
    expect(isPositive(q(1n, 9n))).toBe(true);
    expect(isPositive(ZERO)).toBe(false);
    expect(isPositive(q(-1n, 9n))).toBe(false);
  });
});

describe('floor', () => {
  it('floors toward negative infinity', () => {
    expect(floor(q(7n, 2n))).toBe(3n);
    expect(floor(q(-7n, 2n))).toBe(-4n);
    expect(floor(q(6n, 2n))).toBe(3n);
    expect(floor(q(-6n, 2n))).toBe(-3n);
    expect(floor(q(1n, 3n))).toBe(0n);
    expect(floor(ZERO)).toBe(0n);
  });

  it('satisfies floor(x) ≤ x < floor(x) + 1', () => {
    fc.assert(
      fc.property(rational, (x) => {
        const f = q(floor(x));
        expect(lte(f, x)).toBe(true);
        expect(lt(x, add(f, ONE))).toBe(true);
      }),
    );
  });
});
