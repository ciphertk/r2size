/**
 * Calculator state: exactly what the user typed (raw strings, as RawForm), plus which fields
 * they have left, so errors only appear after a field is done (M2-D5). The sizing result is
 * derived from this, never stored.
 */
import type { FieldId, RawForm, RiskMode, StopMode } from '../engine';

export type TextField = Exclude<keyof RawForm, 'stopMode' | 'riskMode' | 'targets'>;
export type TargetSlot = 0 | 1 | 2;

export interface CalcState {
  readonly form: RawForm;
  /** Free-text label; never used in a calculation. */
  readonly symbol: string;
  readonly touched: ReadonlySet<FieldId>;
}

export type CalcAction =
  | { readonly type: 'setField'; readonly field: TextField; readonly value: string }
  | { readonly type: 'setTarget'; readonly slot: TargetSlot; readonly value: string }
  | { readonly type: 'setSymbol'; readonly value: string }
  | { readonly type: 'setStopMode'; readonly mode: StopMode }
  | { readonly type: 'setRiskMode'; readonly mode: RiskMode }
  | { readonly type: 'touch'; readonly field: FieldId };

export const INITIAL_STATE: CalcState = {
  form: {
    entry: '',
    stopMode: 'percent',
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
  },
  symbol: '',
  touched: new Set(),
};

export const calcReducer = (state: CalcState, action: CalcAction): CalcState => {
  switch (action.type) {
    case 'setField':
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case 'setTarget': {
      const targets = [...state.form.targets] as [string, string, string];
      targets[action.slot] = action.value;
      return { ...state, form: { ...state.form, targets } };
    }
    case 'setSymbol':
      return { ...state, symbol: action.value };
    // Each mode keeps its own typed value, so switching back and forth loses nothing.
    case 'setStopMode':
      return { ...state, form: { ...state.form, stopMode: action.mode } };
    case 'setRiskMode':
      return { ...state, form: { ...state.form, riskMode: action.mode } };
    case 'touch':
      return state.touched.has(action.field)
        ? state
        : { ...state, touched: new Set([...state.touched, action.field]) };
  }
};
