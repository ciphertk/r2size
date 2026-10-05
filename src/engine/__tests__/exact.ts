import { decimal } from '../decimal';
import { div, neg } from '../rational';
import type { Rational } from '../types';

/** Test helper: an exact value from "12.5", "-19995.5" or "92/35". */
export const exact = (text: string): Rational => {
  const negative = text.startsWith('-');
  const [num = '', den] = (negative ? text.slice(1) : text).split('/');
  const magnitude = den === undefined ? decimal(num) : div(decimal(num), decimal(den));
  return negative ? neg(magnitude) : magnitude;
};
