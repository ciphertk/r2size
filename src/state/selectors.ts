/** Derived views of a sizing outcome for the UI. */
import type { FieldError, FieldId, SizingOutcome, Warning } from '../engine';

const allErrors = (outcome: SizingOutcome): readonly FieldError[] =>
  outcome.ok ? outcome.fieldErrors : outcome.errors;

/** The error to show under a field: only once the user has left it (M2-D5). */
export const fieldError = (
  outcome: SizingOutcome,
  touched: ReadonlySet<FieldId>,
  field: FieldId,
): FieldError | undefined =>
  touched.has(field) ? allErrors(outcome).find((e) => e.field === field) : undefined;

/** Form-level problems (zero quantity, an impossible stop): shown as soon as they occur. */
export const formErrors = (outcome: SizingOutcome): readonly FieldError[] =>
  allErrors(outcome).filter((e) => e.field === 'form');

export const fieldWarnings = (outcome: SizingOutcome, field: FieldId): readonly Warning[] =>
  outcome.ok ? outcome.result.warnings.filter((w) => w.field === field) : [];

export const formWarnings = (outcome: SizingOutcome): readonly Warning[] =>
  outcome.ok ? outcome.result.warnings.filter((w) => w.field === undefined) : [];
