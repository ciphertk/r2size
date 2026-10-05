/**
 * Every word the trader reads about an input or a problem. The engine returns codes only;
 * `satisfies Record<…>` makes a new engine code a type error until it is worded here.
 */
import { PLACES, type ErrorCode, type FieldId, type WarningCode } from '../engine';

export const FIELD_LABEL = {
  entry: 'Entry',
  stopPrice: 'Stop price',
  stopPct: 'Stop % below entry',
  atr: 'ATR',
  atrMultiple: 'ATR multiple',
  tick: 'Tick size',
  riskPct: 'Risk % of equity',
  riskAmount: 'Risk amount',
  equity: 'Equity',
  availableCash: 'Available cash',
  maxAllocationPct: 'Max allocation',
  costPct: 'Round-trip cost',
  target1: 'Target 1',
  target2: 'Target 2',
  target3: 'Target 3',
} as const satisfies Record<FieldId, string>;

const DECIMALS = {
  entry: PLACES.price,
  stopPrice: PLACES.price,
  stopPct: PLACES.percent,
  atr: PLACES.atr,
  atrMultiple: PLACES.multiple,
  tick: PLACES.price,
  riskPct: PLACES.percent,
  riskAmount: PLACES.price,
  equity: PLACES.price,
  availableCash: PLACES.price,
  maxAllocationPct: PLACES.percent,
  costPct: PLACES.percent,
  target1: PLACES.price,
  target2: PLACES.price,
  target3: PLACES.price,
} as const satisfies Record<FieldId, number>;

const RANGE = {
  stopPct: 'Use more than 0% and less than 100%.',
  riskPct: 'Use more than 0% and at most 100%.',
  maxAllocationPct: 'Use more than 0% and at most 100%.',
  costPct: 'Use from 0% up to, but not including, 10%.',
} as const;

const ERROR_TEXT = {
  required: () => 'Required.',
  notANumber: () => 'Enter a number, like 1250.50.',
  tooManyDecimals: (field) => {
    const places = field === 'form' ? PLACES.price : DECIMALS[field];
    return `Use at most ${places} decimal places.`;
  },
  tooManyDigits: () => 'That number is too large.',
  mustBePositive: () => 'Must be more than 0.',
  outOfRange: (field) => (field in RANGE ? RANGE[field as keyof typeof RANGE] : 'Out of range.'),
  stopNotBelowEntry: () => 'The stop must be below entry (long trades only).',
  derivedStopNotPositive: () =>
    'This stop would be at or below ₹0. Use a smaller % or ATR multiple.',
  riskExceedsEquity: () => "Risk can't be more than your equity.",
  qtyZeroRisk: () => 'Your risk budget is too small for 1 share at this stop.',
  qtyZeroAllocation: () => 'Max allocation is too small to buy 1 share at this entry.',
  qtyZeroCash: () => 'Not enough available cash to buy 1 share at this entry.',
  targetNotAboveEntry: () => 'A target must be above entry. This one is ignored.',
} as const satisfies Record<ErrorCode, (field: FieldId | 'form') => string>;

export const errorText = (code: ErrorCode, field: FieldId | 'form'): string =>
  ERROR_TEXT[code](field);

const WARNING_TEXT = {
  tickEstimateNearBandEdge:
    "Near an NSE price-band edge. NSE sets the tick from last month's close, so check it with your broker.",
  priceOffTick: 'Not a multiple of the tick. Your broker may reject this price.',
  targetOffTick: 'Not a multiple of the tick. Your broker may reject this price.',
  highRiskPct: "That's more than 5% of your equity on one trade.",
  cashExceedsEquity: 'Available cash is more than equity. Check both numbers.',
} as const satisfies Record<WarningCode, string>;

export const warningText = (code: WarningCode): string => WARNING_TEXT[code];

/** Short explanations behind each "i" button. The full Guide arrives in Milestone 4. */
export const INFO_TEXT = {
  entry: 'The price you plan to buy at, usually your limit price.',
  stop: 'Where you will exit if the trade goes wrong. Type a price, a % below entry, or a multiple of ATR (average true range, which you look up on your chart). A derived stop is rounded down onto the tick.',
  tick: 'The smallest price step NSE allows for this stock, estimated from your entry price. NSE sets it each month from the last close, so near a band edge it may differ. BSE may differ. You can override it.',
  risk: 'How much you are willing to lose if the stop is hit, as a % of equity or a ₹ amount. Costs are included.',
  equity: 'Your total trading capital. Risk % and the allocation cap are worked out from this.',
  availableCash:
    'Cash you can actually spend now. The size is capped so the order fits, including costs.',
  maxAllocationPct:
    'The most of your equity you want in one stock. The size is capped to stay under it.',
  costPct:
    'Your round-trip charges (brokerage, STT, fees) as a % of the entry value. Added to the risk per share.',
  targets: 'Prices where you might take profit. Shown in the R table with the P&L at each.',
} as const;
