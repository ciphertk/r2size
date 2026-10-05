/**
 * The only place numbers become display text (en-IN: ₹20,00,000). Values are rounded
 * exactly by the engine, then Intl groups the integer part as a BigInt, so no figure
 * ever passes through floating point.
 */
import { toDecimalString, type Rational, type Rounding } from '../engine';

const GROUPING = new Intl.NumberFormat('en-IN', { useGrouping: true });

/** U+2212, not a hyphen (design doc number rules). */
export const MINUS = '−';

const group = (digits: string): string => GROUPING.format(BigInt(digits));

/** "1234567.5" → "12,34,567.5" (keeps whatever decimals it is given). */
const groupDecimalString = (text: string): string => {
  const negative = text.startsWith('-');
  const [int = '0', frac] = (negative ? text.slice(1) : text).split('.');
  return `${negative ? MINUS : ''}${group(int)}${frac === undefined ? '' : `.${frac}`}`;
};

const fixed = (value: Rational, places: number, rounding: Rounding = 'halfUp'): string =>
  groupDecimalString(toDecimalString(value, places, rounding));

/** 2758n → "2,758" */
export const formatQty = (qty: bigint): string =>
  qty < 0n ? MINUS + group((-qty).toString()) : group(qty.toString());

/** 1000.05 → "1,000.05" */
export const formatPrice = (value: Rational): string => fixed(value, 2);

/** 275800 → "₹2,75,800.00" */
export const formatMoney = (value: Rational): string => `₹${fixed(value, 2)}`;

/** 13.79 → "13.79%" */
export const formatPct = (value: Rational): string => `${fixed(value, 2)}%`;

/** Risk is never understated: 19995.501 → "₹19,995.51" (M2-D4). */
export const formatRisk = (value: Rational): string => `₹${fixed(value, 2, 'up')}`;

/** 0.999775 → "1.00%" — risk % rounds up too. */
export const formatRiskPct = (value: Rational): string => `${fixed(value, 2, 'up')}%`;

/** P&L with an explicit sign: "+50,057.70", "−19,995.50", "0.00". */
export const formatSignedMoney = (value: Rational): string => {
  const text = fixed(value, 2);
  return value.n > 0n && text !== '0.00' ? `+${text}` : text;
};

/** R-multiples: "3.00", "2.63", "−1.00". */
export const formatR = (value: Rational): string => fixed(value, 2);

/**
 * Groups what the user typed without changing its value: "2000000" → "20,00,000",
 * "100.5" → "100.5". Anything that isn't a plain decimal is returned untouched.
 */
export const formatTyped = (text: string): string => {
  const cleaned = text.replace(/[,\s]/g, '');
  if (!/^[0-9]+([.][0-9]*)?$/.test(cleaned)) return text;
  return groupDecimalString(cleaned.replace(/^0+(?=[0-9])/, ''));
};
