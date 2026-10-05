import { useMemo, useReducer } from 'react';
import { computeSizing, previewStop } from '../../engine';
import { calcReducer, INITIAL_STATE, type CalcState } from '../../state/form-reducer';
import { ProfileStrip } from '../profile/ProfileStrip';
import styles from './CalculatorScreen.module.css';
import { Dock } from './Dock';
import { InputsPanel } from './InputsPanel';
import { ResultPanel } from './ResultPanel';

/** The single screen: the result is derived from what was typed on every keystroke. */
export function CalculatorScreen({ initial = INITIAL_STATE }: { readonly initial?: CalcState }) {
  const [state, dispatch] = useReducer(calcReducer, initial);
  const outcome = useMemo(() => computeSizing(state.form), [state.form]);
  const preview = useMemo(() => previewStop(state.form), [state.form]);
  const context = { state, dispatch, outcome };

  return (
    <div className={styles.screen}>
      <div className={styles.layout}>
        <div className={styles.inputs}>
          <ProfileStrip {...context} />
          <InputsPanel {...context} preview={preview} />
        </div>
        <div className={styles.result}>
          <ResultPanel outcome={outcome} symbol={state.symbol} />
        </div>
      </div>
      {outcome.ok && <Dock result={outcome.result} />}
    </div>
  );
}
