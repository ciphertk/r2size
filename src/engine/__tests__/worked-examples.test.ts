import { describe, expect, it } from 'vitest';
import { WORKED_EXAMPLES, type ExpectOk } from '../__fixtures__/worked-examples';
import { computeSizing } from '../index';
import type { Rational, SizingResult } from '../types';
import { exact } from './exact';

const expectExact = (actual: Rational | undefined, expected: string | undefined, label: string) => {
  if (expected === undefined) return;
  expect(actual, label).toEqual(exact(expected));
};

const checkOk = (
  result: SizingResult,
  fieldErrors: readonly { field: string; code: string }[],
  e: ExpectOk,
) => {
  expectExact(result.tick.value, e.tick, 'tick');
  expectExact(result.stop.price, e.stop, 'stop');
  if (e.stopAdjusted !== undefined)
    expect(result.stop.adjusted, 'stop adjusted').toBe(e.stopAdjusted);
  expectExact(result.perShare.total, e.perShareTotal, 'risk per share');
  expectExact(result.riskBudget, e.budget, 'risk budget');
  if (e.byRisk !== undefined) expect(result.qty.byRisk, 'qty by risk').toBe(e.byRisk);
  if (e.byAllocation !== undefined)
    expect(result.qty.byAllocation, 'qty by allocation').toBe(e.byAllocation);
  if (e.byCash !== undefined) expect(result.qty.byCash, 'qty by cash').toBe(e.byCash);
  expect(result.quantity, 'quantity').toBe(e.quantity);
  expect(result.binding, 'binding').toBe(e.binding);
  if (e.uncappedQuantity !== undefined)
    expect(result.uncappedQuantity, 'uncapped').toBe(e.uncappedQuantity);
  expectExact(result.investment, e.investment, 'investment');
  expectExact(result.allocationPct, e.allocationPct, 'allocation %');
  expectExact(result.actualRisk, e.actualRisk, 'actual risk');
  expectExact(result.actualRiskPct, e.actualRiskPct, 'actual risk %');
  if (e.rows !== undefined) {
    expect(
      result.rTable.map((row) => [row.kind, row.price, row.rMultiple, row.pnl]),
      'R table',
    ).toEqual(e.rows.map(([kind, price, r, pnl]) => [kind, exact(price), exact(r), exact(pnl)]));
  }
  if (e.warnings !== undefined) {
    const key = (code: string, field?: string) => (field === undefined ? code : `${code}:${field}`);
    expect(result.warnings.map((w) => key(w.code, w.field)).sort(), 'warnings').toEqual(
      e.warnings.map(([code, field]) => key(code, field)).sort(),
    );
  }
  expect(
    fieldErrors.map((f) => [f.field, f.code]),
    'field errors',
  ).toEqual(e.fieldErrors ?? []);
};

describe('worked examples (hand-derived, PRD Milestone 1 gate)', () => {
  it.each(WORKED_EXAMPLES.map((example) => [example.name, example] as const))(
    '%s',
    (_name, example) => {
      const outcome = computeSizing(example.raw);
      const e = example.expect;
      if (e.ok) {
        if (!outcome.ok)
          expect.fail(
            `expected a result, got errors ${JSON.stringify(outcome.errors.map((x) => x.code))}`,
          );
        checkOk(outcome.result, outcome.fieldErrors, e);
        return;
      }
      if (outcome.ok) expect.fail(`expected errors, got quantity ${outcome.result.quantity}`);
      expect(
        outcome.errors.filter((err) => err.blocking).map((err) => [err.field, err.code]),
        'blocking errors',
      ).toEqual(e.errors);
      if (e.partialQty !== undefined)
        expect(outcome.partial.qty, 'partial quantities').toEqual(e.partialQty);
    },
  );
});
