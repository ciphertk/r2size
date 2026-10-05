import type { FieldId } from './types';

/** Error codes only; the UI words them. */
export type ErrorCode =
  | 'required'
  | 'notANumber'
  | 'tooManyDecimals'
  | 'tooManyDigits'
  | 'mustBePositive'
  | 'outOfRange'
  | 'stopNotBelowEntry'
  | 'derivedStopNotPositive'
  | 'riskExceedsEquity'
  | 'qtyZeroRisk'
  | 'qtyZeroAllocation'
  | 'qtyZeroCash'
  | 'targetNotAboveEntry';

export type WarningCode =
  | 'tickEstimateNearBandEdge'
  | 'priceOffTick'
  | 'targetOffTick'
  | 'highRiskPct'
  | 'cashExceedsEquity';

export interface FieldError {
  readonly field: FieldId | 'form';
  readonly code: ErrorCode;
  /** Blocking errors stop sizing. Target errors never block (D8). */
  readonly blocking: boolean;
}

export interface Warning {
  readonly code: WarningCode;
  readonly field?: FieldId;
}
