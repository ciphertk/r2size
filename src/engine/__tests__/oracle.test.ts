import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { WORKED_EXAMPLES } from '../__fixtures__/worked-examples';
import { computeSizing } from '../index';
import type { RawForm, SizingResult } from '../types';
import { validForm } from './arbitraries';
import { oracle, toScaled } from './reference-oracle';

const agree = (form: RawForm, result: SizingResult) => {
  const expected = oracle(form);
  expect(toScaled(result.tick.value), 'tick').toBe(expected.tick);
  expect(toScaled(result.stop.price), 'stop').toBe(expected.stop);
  expect(result.qty, 'quantities').toEqual({
    byRisk: expected.byRisk,
    byAllocation: expected.byAllocation,
    byCash: expected.byCash,
  });
  expect(result.quantity, 'quantity').toBe(expected.quantity);
  expect(result.binding, 'binding').toBe(expected.binding);
  expect(toScaled(result.actualRisk), 'actual risk').toBe(expected.actualRisk);
};

describe('reference cross-check (independent scaled-integer implementation)', () => {
  it.each(
    WORKED_EXAMPLES.filter((example) => example.expect.ok).map(
      (example) => [example.name, example.raw] as const,
    ),
  )('agrees on worked example: %s', (_name, form) => {
    const outcome = computeSizing(form);
    if (!outcome.ok) expect.fail('expected a result');
    agree(form, outcome.result);
  });

  it('agrees on 10,000 random realistic setups', () => {
    let compared = 0;
    fc.assert(
      fc.property(validForm, (form) => {
        const outcome = computeSizing(form);
        if (!outcome.ok) return;
        compared += 1;
        agree(form, outcome.result);
      }),
      { numRuns: 10_000 },
    );
    // Guard against a generator that mostly produces errors and so compares nothing.
    expect(compared).toBeGreaterThan(5_000);
  });
});
