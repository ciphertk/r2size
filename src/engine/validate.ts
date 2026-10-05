/**
 * Raw form strings → validated SizingInput, collecting every error at once.
 * Target errors never block sizing (D8).
 */
import { parseDecimal } from './decimal';
import type { ErrorCode, FieldError } from './errors';
import { gt, gte, HUNDRED, isPositive, lt, lte, q, ZERO } from './rational';
import type {
  FieldId,
  Rational,
  RawForm,
  RiskSpec,
  SizingInput,
  StopSpec,
  TargetIndex,
  TargetInput,
} from './types';

/** Maximum decimal places per kind of input (architecture §3). */
export const PLACES = { price: 2, percent: 4, atr: 4, multiple: 2 } as const;

const TEN = q(10n);

type Check = (value: Rational) => ErrorCode | null;

const positive: Check = (v) => (isPositive(v) ? null : 'mustBePositive');
/** 0 < v ≤ 100 */
const percentUpTo100: Check = (v) => (isPositive(v) && lte(v, HUNDRED) ? null : 'outOfRange');
/** 0 < v < 100 */
const percentBelow100: Check = (v) => (isPositive(v) && lt(v, HUNDRED) ? null : 'outOfRange');
/** 0 ≤ v < 10 */
const costPercent: Check = (v) => (gte(v, ZERO) && lt(v, TEN) ? null : 'outOfRange');

export type ValidationResult =
  | { readonly ok: true; readonly input: SizingInput; readonly nonBlocking: readonly FieldError[] }
  | { readonly ok: false; readonly errors: readonly FieldError[] };

export const validate = (raw: RawForm): ValidationResult => {
  const blocking: FieldError[] = [];
  const nonBlocking: FieldError[] = [];

  const read = (
    field: FieldId,
    text: string,
    places: number,
    required: boolean,
    check: Check,
    sink: FieldError[] = blocking,
  ): Rational | undefined => {
    const parsed = parseDecimal(text, places);
    if (parsed.kind === 'empty') {
      if (required) sink.push({ field, code: 'required', blocking: sink === blocking });
      return undefined;
    }
    if (parsed.kind === 'error') {
      sink.push({ field, code: parsed.code, blocking: sink === blocking });
      return undefined;
    }
    const problem = check(parsed.value);
    if (problem !== null) {
      sink.push({ field, code: problem, blocking: sink === blocking });
      return undefined;
    }
    return parsed.value;
  };

  const entry = read('entry', raw.entry, PLACES.price, true, positive);

  let stop: StopSpec | undefined;
  if (raw.stopMode === 'price') {
    const price = read('stopPrice', raw.stopPrice, PLACES.price, true, positive);
    if (price !== undefined) {
      if (entry !== undefined && gte(price, entry)) {
        blocking.push({ field: 'stopPrice', code: 'stopNotBelowEntry', blocking: true });
      } else {
        stop = { kind: 'price', price };
      }
    }
  } else if (raw.stopMode === 'percent') {
    const pct = read('stopPct', raw.stopPct, PLACES.percent, true, percentBelow100);
    if (pct !== undefined) stop = { kind: 'percent', pct };
  } else {
    const atr = read('atr', raw.atr, PLACES.atr, true, positive);
    const multiple = read('atrMultiple', raw.atrMultiple, PLACES.multiple, true, positive);
    if (atr !== undefined && multiple !== undefined) stop = { kind: 'atr', atr, multiple };
  }

  const tickOverride = read('tick', raw.tick, PLACES.price, false, positive);
  const equity = read('equity', raw.equity, PLACES.price, true, positive);

  let risk: RiskSpec | undefined;
  if (raw.riskMode === 'percent') {
    const pct = read('riskPct', raw.riskPct, PLACES.percent, true, percentUpTo100);
    if (pct !== undefined) risk = { kind: 'percent', pct };
  } else {
    const rupees = read('riskAmount', raw.riskAmount, PLACES.price, true, positive);
    if (rupees !== undefined) {
      if (equity !== undefined && gt(rupees, equity)) {
        blocking.push({ field: 'riskAmount', code: 'riskExceedsEquity', blocking: true });
      } else {
        risk = { kind: 'amount', rupees };
      }
    }
  }

  const availableCash = read('availableCash', raw.availableCash, PLACES.price, false, positive);
  const maxAllocationPct = read(
    'maxAllocationPct',
    raw.maxAllocationPct,
    PLACES.percent,
    false,
    percentUpTo100,
  );
  const costPct = read('costPct', raw.costPct, PLACES.percent, false, costPercent) ?? ZERO;

  const targets: TargetInput[] = [];
  raw.targets.forEach((text, i) => {
    const index = (i + 1) as TargetIndex;
    const field = `target${index}` as const;
    const price = read(field, text, PLACES.price, false, positive, nonBlocking);
    if (price === undefined || entry === undefined) return;
    if (lte(price, entry)) {
      nonBlocking.push({ field, code: 'targetNotAboveEntry', blocking: false });
      return;
    }
    targets.push({ index, price });
  });

  if (
    blocking.length > 0 ||
    entry === undefined ||
    stop === undefined ||
    equity === undefined ||
    risk === undefined
  ) {
    return { ok: false, errors: [...blocking, ...nonBlocking] };
  }

  return {
    ok: true,
    input: {
      entry,
      stop,
      risk,
      equity,
      costPct,
      targets,
      ...(tickOverride === undefined ? {} : { tickOverride }),
      ...(availableCash === undefined ? {} : { availableCash }),
      ...(maxAllocationPct === undefined ? {} : { maxAllocationPct }),
    },
    nonBlocking,
  };
};
