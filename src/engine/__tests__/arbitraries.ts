import fc from 'fast-check';
import { BLANK_FORM } from '../__fixtures__/worked-examples';
import type { RawForm } from '../types';

/** n / 10^places as a plain decimal string, e.g. (12345n, 2) → "123.45". */
export const fixed = (n: bigint, places: number): string => {
  const digits = n.toString().padStart(places + 1, '0');
  return places === 0 ? digits : `${digits.slice(0, -places)}.${digits.slice(-places)}`;
};

const paise = (min: bigint, max: bigint) => fc.bigInt({ min, max }).map((n) => fixed(n, 2));
const percent4 = (min: bigint, max: bigint) => fc.bigInt({ min, max }).map((n) => fixed(n, 4));
const optional = <T>(arb: fc.Arbitrary<T>, blank: T) => fc.option(arb, { nil: blank, freq: 3 });

/** Realistic, valid forms: entry ₹0.05–₹1,00,000; equity ₹10,000–₹10 crore; risk 0.01–5%; cost 0–1%. */
export const validForm: fc.Arbitrary<RawForm> = fc
  .record({
    entryPaise: fc.bigInt({ min: 5n, max: 10_000_000n }),
    stop: fc.oneof(
      fc.record({
        mode: fc.constant('price' as const),
        fraction: fc.integer({ min: 1, max: 999 }),
      }),
      fc.record({ mode: fc.constant('percent' as const), pct: percent4(1n, 300_000n) }),
      fc.record({
        mode: fc.constant('atr' as const),
        atrPermille: fc.integer({ min: 1, max: 150 }),
        multiple: fc.bigInt({ min: 25n, max: 400n }).map((n) => fixed(n, 2)),
      }),
    ),
    tick: optional(fc.constantFrom('0.01', '0.05', '0.10', '0.50', '1', '5'), ''),
    risk: fc.oneof(
      fc.record({ mode: fc.constant('percent' as const), value: percent4(100n, 50_000n) }),
      fc.record({ mode: fc.constant('amount' as const), value: paise(100n, 50_000_000n) }),
    ),
    equity: paise(1_000_000n, 1_000_000_000n),
    cash: optional(paise(100n, 2_000_000_000n), ''),
    alloc: optional(percent4(1_000n, 1_000_000n), ''),
    cost: optional(percent4(0n, 10_000n), ''),
  })
  .map((g): RawForm => {
    const entry = fixed(g.entryPaise, 2);
    const stopFields: Partial<RawForm> =
      g.stop.mode === 'price'
        ? {
            stopMode: 'price',
            stopPrice: fixed((g.entryPaise * BigInt(1000 - g.stop.fraction)) / 1000n, 2),
          }
        : g.stop.mode === 'percent'
          ? { stopMode: 'percent', stopPct: g.stop.pct }
          : {
              stopMode: 'atr',
              atr: fixed((g.entryPaise * 100n * BigInt(g.stop.atrPermille)) / 1000n, 4),
              atrMultiple: g.stop.multiple,
            };
    return {
      ...BLANK_FORM,
      entry,
      ...stopFields,
      tick: g.tick,
      riskMode: g.risk.mode,
      riskPct: g.risk.mode === 'percent' ? g.risk.value : '',
      riskAmount: g.risk.mode === 'amount' ? g.risk.value : '',
      equity: g.equity,
      availableCash: g.cash,
      maxAllocationPct: g.alloc,
      costPct: g.cost,
    };
  });

/** Anything at all: junk strings and every mode. */
export const anyForm: fc.Arbitrary<RawForm> = fc.record({
  entry: fc.string(),
  stopMode: fc.constantFrom('price', 'percent', 'atr'),
  stopPrice: fc.string(),
  stopPct: fc.string(),
  atr: fc.string(),
  atrMultiple: fc.string(),
  tick: fc.string(),
  riskMode: fc.constantFrom('percent', 'amount'),
  riskPct: fc.string(),
  riskAmount: fc.string(),
  equity: fc.string(),
  availableCash: fc.string(),
  maxAllocationPct: fc.string(),
  costPct: fc.string(),
  targets: fc.tuple(fc.string(), fc.string(), fc.string()),
});

/** Strings shaped like numbers, to reach deeper than pure junk does. */
export const numberishForm: fc.Arbitrary<RawForm> = (() => {
  const numberish = fc.oneof(
    fc.stringMatching(/^[0-9]{0,14}([.][0-9]{0,6})?$/),
    fc.constantFrom('', '0', '.', '₹', '1e3', '-5', '100', '99.99', '1,00,000'),
  );
  return fc.record({
    entry: numberish,
    stopMode: fc.constantFrom('price', 'percent', 'atr'),
    stopPrice: numberish,
    stopPct: numberish,
    atr: numberish,
    atrMultiple: numberish,
    tick: numberish,
    riskMode: fc.constantFrom('percent', 'amount'),
    riskPct: numberish,
    riskAmount: numberish,
    equity: numberish,
    availableCash: numberish,
    maxAllocationPct: numberish,
    costPct: numberish,
    targets: fc.tuple(numberish, numberish, numberish),
  });
})();
