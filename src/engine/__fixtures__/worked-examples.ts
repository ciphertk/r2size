/**
 * Hand-derived worked examples: the Milestone 1 acceptance gate (PRD M1) and the
 * single source for the Guide's worked example.
 *
 * Every expected value was derived by hand from the sizing rules (PRD D1–D12) and
 * cross-checked with an independent exact-fraction calculation. Values are exact:
 * decimal strings ("19995.5") or fractions ("39991/40000"). Never edit an expected
 * value to make a test pass — re-derive it.
 *
 * Notation: e = entry, s = stop, t = tick, c = cost per share, R = e − s,
 * B = risk budget, Q = quantity.
 */
import type { ErrorCode, WarningCode } from '../errors';
import type { Binding, FieldId, RawForm, RRow } from '../types';

export const BLANK_FORM: RawForm = {
  entry: '',
  stopMode: 'price',
  stopPrice: '',
  stopPct: '',
  atr: '',
  atrMultiple: '',
  tick: '',
  riskMode: 'percent',
  riskPct: '',
  riskAmount: '',
  equity: '',
  availableCash: '',
  maxAllocationPct: '',
  costPct: '',
  targets: ['', '', ''],
};

export const form = (overrides: Partial<RawForm>): RawForm => ({ ...BLANK_FORM, ...overrides });

/** [kind, price, R-multiple, P&L net of costs] — highest price first. */
export type ExpectedRow = readonly [RRow['kind'], string, string, string];

export interface ExpectOk {
  readonly ok: true;
  readonly tick: string;
  readonly stop: string;
  readonly stopAdjusted?: boolean;
  readonly perShareTotal?: string;
  readonly budget?: string;
  readonly byRisk?: bigint;
  readonly byAllocation?: bigint | null;
  readonly byCash?: bigint | null;
  readonly quantity: bigint;
  readonly binding: Binding;
  readonly uncappedQuantity?: bigint;
  readonly investment?: string;
  readonly allocationPct?: string;
  readonly actualRisk?: string;
  readonly actualRiskPct?: string;
  readonly rows?: readonly ExpectedRow[];
  /** Exact set of warning codes (with field, when the warning has one). */
  readonly warnings?: readonly (readonly [WarningCode, FieldId?])[];
  readonly fieldErrors?: readonly (readonly [FieldId | 'form', ErrorCode])[];
}

export interface ExpectError {
  readonly ok: false;
  /** Blocking errors that must be present. */
  readonly errors: readonly (readonly [FieldId | 'form', ErrorCode])[];
  readonly partialQty?: {
    readonly byRisk: bigint;
    readonly byAllocation: bigint | null;
    readonly byCash: bigint | null;
  };
}

export interface WorkedExample {
  readonly name: string;
  readonly raw: RawForm;
  readonly expect: ExpectOk | ExpectError;
}

const EQ_20L = '20,00,000';

export const WORKED_EXAMPLES: readonly WorkedExample[] = [
  {
    // Brief example. t = 0.01 (e < 250). R = 100 − 93 = 7, c = 0, total 7.
    // B = 20,00,000 × 1% = 20,000. Q = floor(20,000 / 7) = floor(2,857.14) = 2,857.
    // Investment 2,857 × 100 = 2,85,700 → 14.285% of equity. Actual risk 2,857 × 7 = 19,999.
    // +1R = 107, +2R = 114, +3R = 121; P&L at +kR = k × 19,999.
    name: 'brief example: 1% of ₹20L, entry 100, stop 93',
    raw: form({ entry: '100', stopPrice: '93', riskPct: '1', equity: EQ_20L }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '93',
      perShareTotal: '7',
      budget: '20000',
      byRisk: 2857n,
      byAllocation: null,
      byCash: null,
      quantity: 2857n,
      binding: 'risk',
      uncappedQuantity: 2857n,
      investment: '285700',
      allocationPct: '14.285',
      actualRisk: '19999',
      actualRiskPct: '0.99995',
      rows: [
        ['r3', '121', '3', '59997'],
        ['r2', '114', '2', '39998'],
        ['r1', '107', '1', '19999'],
        ['entry', '100', '0', '0'],
        ['stop', '93', '-1', '-19999'],
      ],
      warnings: [],
    },
  },
  {
    // The design mockup. Stop 7% below 100 → 93.00 exactly. c = 100 × 0.25% = 0.25 (D1).
    // Total risk/share = 7 + 0.25 = 7.25. Q by risk = floor(20,000 / 7.25) = floor(2,758.62) = 2,758.
    // Allocation cap: 20% × 20,00,000 / 100 = 4,000. Cash cap: floor(6,40,000 / 100.25) = 6,384 (D3).
    // Binding = risk. Actual risk 2,758 × 7.25 = 19,995.50 (0.999775%).
    // Net P&L (D2): +1R 2,758 × 7 − 689.50 = 18,616.50; T1 118.40: 2,758 × 18.40 − 689.50 = 50,057.70,
    // R-multiple 18.40 / 7 = 92/35. Entry row −689.50 (cost only). Stop row −19,995.50.
    name: 'mockup: 7% stop, 0.25% cost, 20% cap, ₹6.4L cash, one target',
    raw: form({
      entry: '100',
      stopMode: 'percent',
      stopPct: '7',
      riskPct: '1',
      equity: EQ_20L,
      costPct: '0.25',
      maxAllocationPct: '20',
      availableCash: '6,40,000',
      targets: ['118.40', '', ''],
    }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '93',
      stopAdjusted: false,
      perShareTotal: '7.25',
      budget: '20000',
      byRisk: 2758n,
      byAllocation: 4000n,
      byCash: 6384n,
      quantity: 2758n,
      binding: 'risk',
      uncappedQuantity: 2758n,
      investment: '275800',
      allocationPct: '13.79',
      actualRisk: '19995.5',
      actualRiskPct: '0.999775',
      rows: [
        ['r3', '121', '3', '57228.5'],
        ['target', '118.4', '92/35', '50057.7'],
        ['r2', '114', '2', '37922.5'],
        ['r1', '107', '1', '18616.5'],
        ['entry', '100', '0', '-689.5'],
        ['stop', '93', '-1', '-19995.5'],
      ],
      warnings: [],
    },
  },
  {
    // PRD cost decision: c = 100 × 0.25% = 0.25 per share. Total = 5 + 0.25 = 5.25.
    // Q = floor(20,000 / 5.25) = floor(3,809.52) = 3,809. Actual risk 3,809 × 5.25 = 19,997.25.
    name: 'PRD cost example: entry 100, stop 95, cost 0.25%',
    raw: form({ entry: '100', stopPrice: '95', riskPct: '1', equity: EQ_20L, costPct: '0.25' }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '95',
      perShareTotal: '5.25',
      quantity: 3809n,
      binding: 'risk',
      actualRisk: '19997.25',
    },
  },
  {
    // Float trap: in floating point 200 × 0.95 = 189.99999999999997, which would floor to 189.99.
    // Exactly: 200 × (1 − 5/100) = 190, already on the 0.01 grid. R = 10, B = 10,000, Q = 1,000.
    name: 'float trap: entry 200, 5% stop gives exactly 190.00',
    raw: form({
      entry: '200',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '10,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '190',
      stopAdjusted: false,
      quantity: 1000n,
      binding: 'risk',
      actualRisk: '10000',
    },
  },
  {
    // Float trap: 1.15 × 0.9 = 1.035 exactly → floor to 0.01 grid = 1.03 (adjusted).
    // R = 0.12. B = 5,00,000 × 0.3% = 1,500. Q = 1,500 / 0.12 = 12,500 exactly.
    name: 'float trap: entry 1.15, 10% stop floors 1.035 to 1.03; 0.3% risk',
    raw: form({
      entry: '1.15',
      stopMode: 'percent',
      stopPct: '10',
      riskPct: '0.3',
      equity: '5,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '1.03',
      stopAdjusted: true,
      perShareTotal: '0.12',
      budget: '1500',
      quantity: 12500n,
      binding: 'risk',
      actualRisk: '1500',
      investment: '14375',
    },
  },
  {
    // t = 0.05 (250 ≤ e ≤ 1,000). R = 345.65 − 331.10 = 14.55. c = 345.65 × 0.07% = 0.241955.
    // Total 14.791955. B = 15,000. Q = floor(15,000 / 14.791955) = floor(1,014.06) = 1,014.
    // Actual risk 1,014 × 14.791955 = 14,999.04237.
    name: 'small cost: 0.07% on entry 345.65',
    raw: form({
      entry: '345.65',
      stopPrice: '331.10',
      riskPct: '1',
      equity: '15,00,000',
      costPct: '0.07',
    }),
    expect: {
      ok: true,
      tick: '0.05',
      stop: '331.1',
      perShareTotal: '14.791955',
      quantity: 1014n,
      binding: 'risk',
      actualRisk: '14999.04237',
    },
  },

  // NSE band edges (circular NSE/CMTR/67133): "Below 250", "≥ 250 – 1,000", "> 1,000 – 5,000",
  // "> 5,000 – 10,000", "> 10,000 – 20,000", "> 20,000". 5% stop, 1% of ₹1 crore (B = 1,00,000).
  {
    // 249.99 < 250 → 0.01. Raw 237.4905 → 237.49. R = 12.50. Q = 8,000.
    name: 'band edge: 249.99 → tick 0.01',
    raw: form({
      entry: '249.99',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '237.49',
      stopAdjusted: true,
      quantity: 8000n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge']],
    },
  },
  {
    // ≥ 250 → 0.05. Raw 237.5 (on grid). R = 12.5. Q = 8,000.
    name: 'band edge: 250.00 → tick 0.05',
    raw: form({
      entry: '250',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.05',
      stop: '237.5',
      stopAdjusted: false,
      quantity: 8000n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge']],
    },
  },
  {
    // 1,000 is inside "≥ 250 – 1,000" → 0.05. Raw 950. Q = 1,00,000 / 50 = 2,000.
    name: 'band edge: 1,000.00 → tick 0.05 (upper bound inclusive)',
    raw: form({
      entry: '1000',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.05',
      stop: '950',
      quantity: 2000n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge']],
    },
  },
  {
    // > 1,000 → 0.10. Raw 950.0475 → 950.0 (adjusted). R = 50.05. Q = floor(1,998.0) = 1,998.
    name: 'band edge: 1,000.05 → tick 0.10',
    raw: form({
      entry: '1000.05',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.1',
      stop: '950',
      stopAdjusted: true,
      quantity: 1998n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge'], ['priceOffTick', 'entry']],
    },
  },
  {
    // 5,000 is inside "> 1,000 – 5,000" → 0.10. Raw 4,750. Q = 1,00,000 / 250 = 400.
    name: 'band edge: 5,000.00 → tick 0.10 (upper bound inclusive)',
    raw: form({
      entry: '5000',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.1',
      stop: '4750',
      quantity: 400n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge']],
    },
  },
  {
    // > 5,000 → 0.50. Raw 4,750.095 → 4,750.0. R = 250.10. Q = floor(399.84) = 399.
    // 5,000.10 is not a multiple of 0.50, so the typed entry is off-tick (warning only).
    name: 'band edge: 5,000.10 → tick 0.50',
    raw: form({
      entry: '5000.10',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.5',
      stop: '4750',
      stopAdjusted: true,
      quantity: 399n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge'], ['priceOffTick', 'entry']],
    },
  },
  {
    // 10,000 is inside "> 5,000 – 10,000" → 0.50. Raw 9,500. Q = 1,00,000 / 500 = 200.
    name: 'band edge: 10,000.00 → tick 0.50 (upper bound inclusive)',
    raw: form({
      entry: '10000',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.5',
      stop: '9500',
      quantity: 200n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge']],
    },
  },
  {
    // > 10,000 → 1.00. Raw 9,500.475 → 9,500. R = 500.50. Q = floor(199.80) = 199. Entry off the 1.00 grid.
    name: 'band edge: 10,000.50 → tick 1.00',
    raw: form({
      entry: '10000.50',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '1',
      stop: '9500',
      stopAdjusted: true,
      quantity: 199n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge'], ['priceOffTick', 'entry']],
    },
  },
  {
    // 20,000 is inside "> 10,000 – 20,000" → 1.00. Raw 19,000. Q = 1,00,000 / 1,000 = 100.
    name: 'band edge: 20,000.00 → tick 1.00 (upper bound inclusive)',
    raw: form({
      entry: '20000',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '1',
      stop: '19000',
      quantity: 100n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge']],
    },
  },
  {
    // > 20,000 → 5.00. Raw 19,000.95 → 19,000. R = 1,001. Q = floor(99.90) = 99. Entry off the 5.00 grid.
    name: 'band edge: 20,001.00 → tick 5.00',
    raw: form({
      entry: '20001',
      stopMode: 'percent',
      stopPct: '5',
      riskPct: '1',
      equity: '1,00,00,000',
    }),
    expect: {
      ok: true,
      tick: '5',
      stop: '19000',
      stopAdjusted: true,
      quantity: 99n,
      binding: 'risk',
      warnings: [['tickEstimateNearBandEdge'], ['priceOffTick', 'entry']],
    },
  },

  {
    // ATR stop on the grid: 512.35 − 7.3 × 1.5 = 512.35 − 10.95 = 501.40, a multiple of 0.05.
    // R = 10.95. B = 10,000. Q = floor(913.24) = 913.
    name: 'ATR stop landing on the tick grid',
    raw: form({
      entry: '512.35',
      stopMode: 'atr',
      atr: '7.3',
      atrMultiple: '1.5',
      riskPct: '1',
      equity: '10,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.05',
      stop: '501.4',
      stopAdjusted: false,
      quantity: 913n,
      binding: 'risk',
    },
  },
  {
    // ATR stop off the grid: 512.35 − 7.33 × 1.5 = 512.35 − 10.995 = 501.355 → floor to 0.05 = 501.35.
    // R = 11. Q = floor(909.09) = 909. Actual risk 9,999.
    name: 'ATR stop floored onto the tick grid (away from entry)',
    raw: form({
      entry: '512.35',
      stopMode: 'atr',
      atr: '7.33',
      atrMultiple: '1.5',
      riskPct: '1',
      equity: '10,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.05',
      stop: '501.35',
      stopAdjusted: true,
      quantity: 909n,
      binding: 'risk',
      actualRisk: '9999',
    },
  },
  {
    // Override 0.05 beats auto 0.01. Raw 100 × (1 − 3.33%) = 96.67 → 0.05 grid → 96.65.
    // (With the auto 0.01 tick it would stay 96.67.) R = 3.35. Q = floor(2,985.07) = 2,985.
    // +1R = floor(103.35 / 0.05) × 0.05 = 103.35; +2R = 106.70; +3R = 110.05.
    name: 'tick override beats the auto tick',
    raw: form({
      entry: '100',
      stopMode: 'percent',
      stopPct: '3.33',
      tick: '0.05',
      riskPct: '1',
      equity: '10,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.05',
      stop: '96.65',
      stopAdjusted: true,
      quantity: 2985n,
      binding: 'risk',
      rows: [
        ['r3', '110.05', '3', '29999.25'],
        ['r2', '106.7', '2', '19999.5'],
        ['r1', '103.35', '1', '9999.75'],
        ['entry', '100', '0', '0'],
        ['stop', '96.65', '-1', '-9999.75'],
      ],
    },
  },
  {
    // B = 10,00,000 × 2% = 20,000. R = 5 → by risk 4,000. Allocation 10% → 1,00,000 / 500 = 200.
    // Binding = allocation; uncapped quantity 4,000. Actual risk 200 × 5 = 1,000.
    name: 'allocation cap binds',
    raw: form({
      entry: '500',
      stopPrice: '495',
      riskPct: '2',
      equity: '10,00,000',
      maxAllocationPct: '10',
    }),
    expect: {
      ok: true,
      tick: '0.05',
      stop: '495',
      byRisk: 4000n,
      byAllocation: 200n,
      byCash: null,
      quantity: 200n,
      binding: 'allocation',
      uncappedQuantity: 4000n,
      investment: '100000',
      allocationPct: '10',
      actualRisk: '1000',
    },
  },
  {
    // c = 0.25. Total = 2.25. By risk floor(10,000 / 2.25) = 4,444.
    // Cash cap (D3) = floor(2,50,000 / 100.25) = floor(2,493.77) = 2,493. Binding = cash.
    name: 'cash cap binds and includes cost per share',
    raw: form({
      entry: '100',
      stopPrice: '98',
      riskPct: '1',
      equity: '10,00,000',
      availableCash: '2,50,000',
      costPct: '0.25',
    }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '98',
      byRisk: 4444n,
      byAllocation: null,
      byCash: 2493n,
      quantity: 2493n,
      binding: 'cash',
      uncappedQuantity: 4444n,
      actualRisk: '5609.25',
    },
  },
  {
    // By risk 10,000 / 5 = 2,000. Allocation 20% → 2,00,000 / 100 = 2,000. Tie → risk (no cap reduced it).
    name: 'tie between risk and a cap reports risk',
    raw: form({
      entry: '100',
      stopPrice: '95',
      riskPct: '1',
      equity: '10,00,000',
      maxAllocationPct: '20',
    }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '95',
      byRisk: 2000n,
      byAllocation: 2000n,
      quantity: 2000n,
      binding: 'risk',
    },
  },
  {
    // By risk 50,000 / 1 = 50,000. Allocation 10% → 1,000. Cash 1,00,000 / 100 = 1,000. Caps tie → cash.
    name: 'tie between the two caps reports cash',
    raw: form({
      entry: '100',
      stopPrice: '99',
      riskPct: '5',
      equity: '10,00,000',
      maxAllocationPct: '10',
      availableCash: '1,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '99',
      byRisk: 50000n,
      byAllocation: 1000n,
      byCash: 1000n,
      quantity: 1000n,
      binding: 'cash',
      uncappedQuantity: 50000n,
    },
  },
  {
    // B = 1,00,000 × 0.01% = 10. R = 20. floor(0.5) = 0 → qtyZeroRisk (D9).
    name: 'zero quantity: risk budget too small',
    raw: form({ entry: '500', stopPrice: '480', riskPct: '0.01', equity: '1,00,000' }),
    expect: {
      ok: false,
      errors: [['form', 'qtyZeroRisk']],
      partialQty: { byRisk: 0n, byAllocation: null, byCash: null },
    },
  },
  {
    // By risk 1,000 / 50 = 20. Allocation 1% → 1,000 / 1,500 = 0 → qtyZeroAllocation.
    name: 'zero quantity: allocation cap below one share',
    raw: form({
      entry: '1500',
      stopPrice: '1450',
      riskPct: '1',
      equity: '1,00,000',
      maxAllocationPct: '1',
    }),
    expect: {
      ok: false,
      errors: [['form', 'qtyZeroAllocation']],
      partialQty: { byRisk: 20n, byAllocation: 0n, byCash: null },
    },
  },
  {
    // By risk 20. Cash 1,000 / 1,500 = 0 → qtyZeroCash.
    name: 'zero quantity: not enough cash for one share',
    raw: form({
      entry: '1500',
      stopPrice: '1450',
      riskPct: '1',
      equity: '1,00,000',
      availableCash: '1000',
    }),
    expect: {
      ok: false,
      errors: [['form', 'qtyZeroCash']],
      partialQty: { byRisk: 20n, byAllocation: null, byCash: 0n },
    },
  },
  {
    // Risk as ₹5,000. R = 10 → Q = 500. Actual risk % = 5,000 / 10,00,000 = 0.5%.
    name: 'risk as a ₹ amount',
    raw: form({
      entry: '250',
      stopPrice: '240',
      riskMode: 'amount',
      riskAmount: '5,000',
      equity: '10,00,000',
    }),
    expect: {
      ok: true,
      tick: '0.05',
      stop: '240',
      budget: '5000',
      quantity: 500n,
      binding: 'risk',
      actualRiskPct: '0.5',
      allocationPct: '12.5',
      warnings: [['tickEstimateNearBandEdge']],
    },
  },
  {
    name: 'risk amount above equity is an error',
    raw: form({
      entry: '250',
      stopPrice: '240',
      riskMode: 'amount',
      riskAmount: '20,00,000',
      equity: '10,00,000',
    }),
    expect: { ok: false, errors: [['riskAmount', 'riskExceedsEquity']] },
  },
  {
    // 6% of 10,00,000 = 60,000 budget: allowed, with a warning.
    name: 'risk above 5% warns',
    raw: form({ entry: '100', stopPrice: '90', riskPct: '6', equity: '10,00,000' }),
    expect: {
      ok: true,
      tick: '0.01',
      stop: '90',
      quantity: 6000n,
      binding: 'risk',
      warnings: [['highRiskPct', 'riskPct']],
    },
  },
  {
    name: 'typed stop at entry is an error',
    raw: form({ entry: '100', stopPrice: '100', riskPct: '1', equity: '10,00,000' }),
    expect: { ok: false, errors: [['stopPrice', 'stopNotBelowEntry']] },
  },
  {
    // 100 − 50 × 2 = 0 → no positive stop.
    name: 'ATR × multiple ≥ entry is an error',
    raw: form({
      entry: '100',
      stopMode: 'atr',
      atr: '50',
      atrMultiple: '2',
      riskPct: '1',
      equity: '10,00,000',
    }),
    expect: { ok: false, errors: [['form', 'derivedStopNotPositive']] },
  },
  {
    name: 'invalid input reports every field at once',
    raw: form({ entry: '100.123', stopPrice: 'abc', riskPct: '1', equity: '' }),
    expect: {
      ok: false,
      errors: [
        ['entry', 'tooManyDecimals'],
        ['stopPrice', 'notANumber'],
        ['equity', 'required'],
      ],
    },
  },
  {
    // t = 0.05. R = 15. Q = floor(10,000 / 15) = 666. Targets: 330.12 is off the 0.05 grid (warning, kept as typed),
    // R-multiple 30.12 / 15 = 251/125; 290 ≤ entry → non-blocking error, no row; 345 = +3R.
    // Entry 300 is more than 10% from 250 and 1,000, so no band-edge warning.
    name: 'targets: off-tick kept as typed, below entry rejected without blocking',
    raw: form({
      entry: '300',
      stopPrice: '285',
      riskPct: '1',
      equity: '10,00,000',
      targets: ['330.12', '290', '345'],
    }),
    expect: {
      ok: true,
      tick: '0.05',
      stop: '285',
      quantity: 666n,
      binding: 'risk',
      rows: [
        ['r3', '345', '3', '29970'],
        ['target', '345', '3', '29970'],
        ['target', '330.12', '251/125', '20059.92'],
        ['r2', '330', '2', '19980'],
        ['r1', '315', '1', '9990'],
        ['entry', '300', '0', '0'],
        ['stop', '285', '-1', '-9990'],
      ],
      warnings: [['targetOffTick', 'target1']],
      fieldErrors: [['target2', 'targetNotAboveEntry']],
    },
  },
];
