import type { Dispatch } from 'react';
import type { FieldId, SizingOutcome } from '../../engine';
import { errorText, FIELD_LABEL, warningText } from '../../domain/messages';
import type { CalcAction, CalcState, TargetSlot, TextField } from '../../state/form-reducer';
import { fieldError, fieldWarnings } from '../../state/selectors';
import type { NumberFieldProps } from '../shared/NumberField';

export interface FieldContext {
  readonly state: CalcState;
  readonly dispatch: Dispatch<CalcAction>;
  readonly outcome: SizingOutcome;
}

type WiredProps = Pick<
  NumberFieldProps,
  'id' | 'label' | 'value' | 'onValueChange' | 'onCommit' | 'error' | 'warning'
>;

const messagesFor = ({ state, outcome }: FieldContext, field: FieldId) => {
  const error = fieldError(outcome, state.touched, field);
  const [warning] = fieldWarnings(outcome, field);
  return {
    error: error && errorText(error.code, field),
    warning: warning && warningText(warning.code),
  };
};

/** Wires a NumberField to the form state, its label, and any error or warning to show. */
export const fieldProps = (context: FieldContext, field: TextField): WiredProps => ({
  id: `field-${field}`,
  label: FIELD_LABEL[field],
  value: context.state.form[field],
  onValueChange: (value) => context.dispatch({ type: 'setField', field, value }),
  onCommit: () => context.dispatch({ type: 'touch', field }),
  ...messagesFor(context, field),
});

/** The same wiring for target 1–3, which live in a tuple. */
const TARGET_FIELDS = ['target1', 'target2', 'target3'] as const satisfies readonly FieldId[];

export const targetFieldProps = (context: FieldContext, slot: TargetSlot): WiredProps => {
  const field = TARGET_FIELDS[slot];
  return {
    id: `field-${field}`,
    label: FIELD_LABEL[field],
    value: context.state.form.targets[slot],
    onValueChange: (value) => context.dispatch({ type: 'setTarget', slot, value }),
    onCommit: () => context.dispatch({ type: 'touch', field }),
    ...messagesFor(context, field),
  };
};
