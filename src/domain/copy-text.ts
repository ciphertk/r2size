/**
 * What lands on the clipboard. Single values are plain digits so they paste cleanly into a
 * broker's number field (brief §3.4, M2-D3); "Copy all" is a readable line for notes or chat.
 */
import { toDecimalString, type Rational } from '../engine';
import { formatPrice, formatQty } from './format';

/** 2758n → "2758" */
export const copyQty = (qty: bigint): string => qty.toString();

/** 100 → "100.00" */
export const copyPrice = (price: Rational): string => toDecimalString(price, 2);

export interface CopyAllInput {
  readonly symbol: string;
  readonly quantity: bigint;
  readonly entry: Rational;
  readonly stop: Rational;
  /** Target 1, when typed (M2-D1). */
  readonly target?: Rational;
}

/** "RAYMOND · BUY 2,758 · LMT ₹100.00 · SL ₹93.00 · TGT ₹118.40" */
export const copyAllLine = ({ symbol, quantity, entry, stop, target }: CopyAllInput): string =>
  [
    symbol.trim().toUpperCase(),
    `BUY ${formatQty(quantity)}`,
    `LMT ₹${formatPrice(entry)}`,
    `SL ₹${formatPrice(stop)}`,
    target === undefined ? '' : `TGT ₹${formatPrice(target)}`,
  ]
    .filter((part) => part !== '')
    .join(' · ');
