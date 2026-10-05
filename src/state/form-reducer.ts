/**
 * Calculator state: exactly what the user typed (raw strings, as RawForm), plus which fields
 * they have left, so errors only appear after a field is done (M2-D5). The sizing result is
 * derived from this, never stored.
 */
import type { FieldId, RawForm, RiskMode, StopMode } from '../engine';
import { applyPreset } from '../domain/presets';
import type { PresetFields } from '../domain/schema';
import type { ShareableSetup } from '../domain/share-url';

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
  | { readonly type: 'touch'; readonly field: FieldId }
  | { readonly type: 'applyPreset'; readonly preset: PresetFields }
  | { readonly type: 'loadSetup'; readonly setup: ShareableSetup }
  | { readonly type: 'setProfile'; readonly equity: string; readonly availableCash: string }
  /** Clears the trade, keeping the profile figures. */
  | { readonly type: 'clearTrade' };

/** A shared setup replaces the trade inputs; the trader's own equity and cash stay. */
export const withSetup = (form: RawForm, setup: ShareableSetup): RawForm => ({
  ...form,
  entry: setup.entry,
  stopMode: setup.stopMode,
  stopPrice: setup.stopPrice,
  stopPct: setup.stopPct,
  atr: setup.atr,
  atrMultiple: setup.atrMultiple,
  tick: setup.tick,
  riskMode: setup.riskMode,
  riskPct: setup.riskPct,
  riskAmount: setup.riskAmount,
  maxAllocationPct: setup.maxAllocationPct,
  costPct: setup.costPct,
  targets: setup.targets,
});

/** The trade inputs worth putting in a link: never equity or cash (ADR-005). */
export const setupOf = ({ form, symbol }: CalcState): ShareableSetup => ({
  symbol,
  entry: form.entry,
  stopMode: form.stopMode,
  stopPrice: form.stopPrice,
  stopPct: form.stopPct,
  atr: form.atr,
  atrMultiple: form.atrMultiple,
  tick: form.tick,
  riskMode: form.riskMode,
  riskPct: form.riskPct,
  riskAmount: form.riskAmount,
  maxAllocationPct: form.maxAllocationPct,
  costPct: form.costPct,
  targets: form.targets,
});

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
    case 'applyPreset':
      return { ...state, form: applyPreset(state.form, action.preset) };
    case 'loadSetup':
      return {
        form: withSetup(state.form, action.setup),
        symbol: action.setup.symbol,
        touched: new Set(),
      };
    case 'setProfile':
      return {
        ...state,
        form: { ...state.form, equity: action.equity, availableCash: action.availableCash },
      };
    case 'clearTrade':
      return {
        ...INITIAL_STATE,
        form: {
          ...INITIAL_STATE.form,
          equity: state.form.equity,
          availableCash: state.form.availableCash,
        },
      };
  }
};
