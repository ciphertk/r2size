/**
 * Exact fractions on BigInt (ADR-002). Every value is reduced with a positive
 * denominator, so structural equality is numeric equality.
 */
import type { Rational } from './types';

const abs = (x: bigint): bigint => (x < 0n ? -x : x);

const gcd = (a: bigint, b: bigint): bigint => {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
};

export const q = (n: bigint, d = 1n): Rational => {
  if (d === 0n) {
    // eslint-disable-next-line no-restricted-syntax -- programming error, unreachable from validated input
    throw new RangeError('Rational with zero denominator');
  }
  if (n === 0n) return { n: 0n, d: 1n };
  const sign = d < 0n ? -1n : 1n;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
};

export const ZERO = q(0n);
export const ONE = q(1n);
export const HUNDRED = q(100n);

export const add = (a: Rational, b: Rational): Rational => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational): Rational => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational): Rational => q(a.n * b.n, a.d * b.d);
export const neg = (a: Rational): Rational => q(-a.n, a.d);

export const div = (a: Rational, b: Rational): Rational => {
  if (b.n === 0n) {
    // eslint-disable-next-line no-restricted-syntax -- programming error, unreachable from validated input
    throw new RangeError('Division by zero');
  }
  return q(a.n * b.d, a.d * b.n);
};

/** −1, 0 or 1. Denominators are positive, so cross-multiplying keeps the order. */
export const cmp = (a: Rational, b: Rational): -1 | 0 | 1 => {
  const diff = a.n * b.d - b.n * a.d;
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
};

export const eq = (a: Rational, b: Rational): boolean => cmp(a, b) === 0;
export const lt = (a: Rational, b: Rational): boolean => cmp(a, b) < 0;
export const lte = (a: Rational, b: Rational): boolean => cmp(a, b) <= 0;
export const gt = (a: Rational, b: Rational): boolean => cmp(a, b) > 0;
export const gte = (a: Rational, b: Rational): boolean => cmp(a, b) >= 0;
export const min = (a: Rational, b: Rational): Rational => (lte(a, b) ? a : b);
export const max = (a: Rational, b: Rational): Rational => (gte(a, b) ? a : b);
export const isPositive = (a: Rational): boolean => a.n > 0n;

/** Largest integer ≤ a. BigInt division truncates toward zero, so negatives need a step down. */
export const floor = (a: Rational): bigint => {
  const t = a.n / a.d;
  return a.n < 0n && t * a.d !== a.n ? t - 1n : t;
};
