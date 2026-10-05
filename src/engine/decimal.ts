/**
 * The only way numbers enter the engine: decimal strings parsed straight into exact
 * fractions, never through floating point (ADR-002). Extra precision is an error,
 * never silently rounded.
 */
import { q } from './rational';
import type { Rational } from './types';

export type ParseError = 'notANumber' | 'tooManyDecimals' | 'tooManyDigits';

export type ParseResult =
  | { readonly kind: 'value'; readonly value: Rational }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly code: ParseError };

const MAX_INTEGER_DIGITS = 12;

/** Grouping commas, the rupee sign and whitespace (\s covers no-break spaces) are ignored. */
const IGNORED = /[,₹\s]/g;
/** ASCII digits with at most one point, and at least one digit: "5", "5.", ".5", "5.25". */
const DECIMAL = /^(?=[.]?[0-9])[0-9]*(?:[.][0-9]*)?$/;

export const parseDecimal = (raw: string, maxDecimals: number): ParseResult => {
  const cleaned = raw.replace(IGNORED, '');
  if (cleaned === '') return { kind: 'empty' };
  if (!DECIMAL.test(cleaned)) return { kind: 'error', code: 'notANumber' };

  const point = cleaned.indexOf('.');
  const intDigits = (point < 0 ? cleaned : cleaned.slice(0, point)).replace(/^0+/, '');
  const fracDigits = (point < 0 ? '' : cleaned.slice(point + 1)).replace(/0+$/, '');
  if (intDigits.length > MAX_INTEGER_DIGITS) return { kind: 'error', code: 'tooManyDigits' };
  if (fracDigits.length > maxDecimals) return { kind: 'error', code: 'tooManyDecimals' };

  return {
    kind: 'value',
    value: q(BigInt(intDigits + fracDigits), 10n ** BigInt(fracDigits.length)),
  };
};

/** Parses a decimal literal written in source code (e.g. the NSE tick table). */
export const decimal = (literal: string): Rational => {
  const result = parseDecimal(literal, literal.length);
  if (result.kind !== 'value') {
    // eslint-disable-next-line no-restricted-syntax -- invalid source literal, caught by tests at build time
    throw new RangeError(`Invalid decimal literal: ${literal}`);
  }
  return result.value;
};

/**
 * How to round to the last displayed digit:
 * - 'halfUp': half away from zero (money, prices, percentages)
 * - 'up': away from zero, so a displayed risk is never smaller than the real one (M2-D4)
 */
export type Rounding = 'halfUp' | 'up';

/** Exact fixed-point string, e.g. 19995.5 → "19995.50". domain/format.ts adds grouping and symbols. */
export const toDecimalString = (
  value: Rational,
  places: number,
  rounding: Rounding = 'halfUp',
): string => {
  const scale = 10n ** BigInt(places);
  const magnitude = value.n < 0n ? -value.n : value.n;
  const scaled =
    rounding === 'up'
      ? (magnitude * scale + value.d - 1n) / value.d
      : (2n * magnitude * scale + value.d) / (2n * value.d);
  const digits = scaled.toString().padStart(places + 1, '0');
  const sign = value.n < 0n && scaled !== 0n ? '-' : '';
  if (places === 0) return sign + digits;
  return `${sign}${digits.slice(0, -places)}.${digits.slice(-places)}`;
};
