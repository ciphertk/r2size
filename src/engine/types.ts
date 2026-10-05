import type { FieldError, Warning } from './errors';

/** An exact fraction: always reduced, denominator > 0. */
export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}

export type StopMode = 'price' | 'percent' | 'atr';
export type RiskMode = 'percent' | 'amount';

/**
 * The engine's only input: what the user typed, as strings. The UI merges the saved
 * account profile (equity, available cash) into this before calling computeSizing.
 * Fields belonging to an inactive mode are ignored. An empty string means "not given".
 */
export interface RawForm {
  readonly entry: string;
  readonly stopMode: StopMode;
  readonly stopPrice: string;
  readonly stopPct: string;
  readonly atr: string;
  readonly atrMultiple: string;
  /** Empty = use the NSE auto tick. */
  readonly tick: string;
  readonly riskMode: RiskMode;
  readonly riskPct: string;
  readonly riskAmount: string;
  readonly equity: string;
  readonly availableCash: string;
  readonly maxAllocationPct: string;
  readonly costPct: string;
  readonly targets: readonly [string, string, string];
}

export type FieldId =
  | 'entry'
  | 'stopPrice'
  | 'stopPct'
  | 'atr'
  | 'atrMultiple'
  | 'tick'
  | 'riskPct'
  | 'riskAmount'
  | 'equity'
  | 'availableCash'
  | 'maxAllocationPct'
  | 'costPct'
  | 'target1'
  | 'target2'
  | 'target3';

export type TargetIndex = 1 | 2 | 3;

export type StopSpec =
  | { readonly kind: 'price'; readonly price: Rational }
  | { readonly kind: 'percent'; readonly pct: Rational }
  | { readonly kind: 'atr'; readonly atr: Rational; readonly multiple: Rational };

export type RiskSpec =
  | { readonly kind: 'percent'; readonly pct: Rational }
  | { readonly kind: 'amount'; readonly rupees: Rational };

export interface TargetInput {
  readonly index: TargetIndex;
  readonly price: Rational;
}

/** Validated, parsed input. */
export interface SizingInput {
  readonly entry: Rational;
  readonly stop: StopSpec;
  readonly tickOverride?: Rational;
  readonly risk: RiskSpec;
  readonly equity: Rational;
  readonly availableCash?: Rational;
  readonly maxAllocationPct?: Rational;
  /** Round-trip cost as % of entry value; 0 when not given. */
  readonly costPct: Rational;
  readonly targets: readonly TargetInput[];
}

export type Binding = 'risk' | 'allocation' | 'cash';

export interface TickInfo {
  readonly value: Rational;
  readonly source: 'auto' | 'override';
  readonly bandsEffectiveFrom: string;
  /** Only ever true for an auto tick (D11). */
  readonly nearBandEdge: boolean;
}

export interface StopInfo {
  readonly price: Rational;
  /** The stop before tick rounding (equal to price for a typed stop). */
  readonly raw: Rational;
  readonly derived: boolean;
  /** True when a derived stop was moved down onto the tick grid. */
  readonly adjusted: boolean;
}

export interface PerShare {
  /** entry − stop; also the R unit for the R table (D2). */
  readonly priceRisk: Rational;
  /** entry × cost% (D1). */
  readonly cost: Rational;
  readonly total: Rational;
}

export interface Quantities {
  readonly byRisk: bigint;
  readonly byAllocation: bigint | null;
  readonly byCash: bigint | null;
}

export interface RRow {
  readonly kind: 'r1' | 'r2' | 'r3' | 'target' | 'entry' | 'stop';
  readonly index?: TargetIndex;
  readonly price: Rational;
  readonly rMultiple: Rational;
  /** Net of costs (D2). */
  readonly pnl: Rational;
  readonly pnlPctOfEquity: Rational;
  readonly offTick: boolean;
}

export interface SizingResult {
  readonly tick: TickInfo;
  readonly stop: StopInfo;
  readonly perShare: PerShare;
  readonly riskBudget: Rational;
  readonly qty: Quantities;
  readonly quantity: bigint;
  readonly binding: Binding;
  readonly uncappedQuantity: bigint;
  readonly investment: Rational;
  readonly allocationPct: Rational;
  readonly actualRisk: Rational;
  readonly actualRiskPct: Rational;
  /** Highest price first. */
  readonly rTable: readonly RRow[];
  readonly warnings: readonly Warning[];
}

/** What was computed before a blocking error, so the UI can still show it. */
export interface PartialResult {
  readonly tick?: TickInfo;
  readonly stop?: StopInfo;
  readonly perShare?: PerShare;
  readonly riskBudget?: Rational;
  readonly qty?: Quantities;
  readonly binding?: Binding;
}

export type SizingOutcome =
  | {
      readonly ok: true;
      readonly result: SizingResult;
      /** Non-blocking errors only (targets, D8). */
      readonly fieldErrors: readonly FieldError[];
    }
  | {
      readonly ok: false;
      /** All errors, blocking first. */
      readonly errors: readonly FieldError[];
      readonly partial: PartialResult;
    };
