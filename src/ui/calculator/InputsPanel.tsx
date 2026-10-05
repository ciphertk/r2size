import { useState } from 'react';
import type { RiskMode, StopMode, StopPreview } from '../../engine';
import { formatPrice } from '../../domain/format';
import { errorText, INFO_TEXT } from '../../domain/messages';
import { formErrors } from '../../state/selectors';
import { InfoTip } from '../shared/InfoTip';
import { NumberField } from '../shared/NumberField';
import { Segmented } from '../shared/Segmented';
import { fieldProps, targetFieldProps, type FieldContext } from './field-props';
import styles from './InputsPanel.module.css';

const TARGET_SLOTS = [0, 1, 2] as const;

const STOP_MODES = [
  { value: 'price', label: 'Price' },
  { value: 'percent', label: '% below' },
  { value: 'atr', label: 'ATR ×' },
] as const satisfies readonly { value: StopMode; label: string }[];

const RISK_MODES = [
  { value: 'percent', label: '% equity' },
  { value: 'amount', label: '₹ amount' },
] as const satisfies readonly { value: RiskMode; label: string }[];

export interface InputsPanelProps extends FieldContext {
  readonly preview: StopPreview | null;
}

export function InputsPanel(props: InputsPanelProps) {
  const { state, dispatch, outcome, preview } = props;
  const [editTick, setEditTick] = useState(false);
  const stopProblem = formErrors(outcome).find((e) => e.code === 'derivedStopNotPositive');
  const showTickField = editTick || state.form.tick !== '';

  return (
    <section className={styles.panel} aria-label="Trade setup">
      <div className={styles.row}>
        <div className={styles.symbol}>
          <label htmlFor="field-symbol" className={styles.label}>
            Symbol <span className={styles.optional}>optional</span>
          </label>
          <input
            id="field-symbol"
            className={styles.symbolInput}
            value={state.symbol}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            onChange={(event) => dispatch({ type: 'setSymbol', value: event.target.value })}
          />
        </div>
        <NumberField
          {...fieldProps(props, 'entry')}
          prefix="₹"
          aside={<InfoTip topic="Entry" text={INFO_TEXT.entry} />}
        />
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>
          Stop <InfoTip topic="Stop" text={INFO_TEXT.stop} />
        </legend>
        <Segmented
          label="Stop method"
          value={state.form.stopMode}
          options={STOP_MODES}
          onValueChange={(mode) => dispatch({ type: 'setStopMode', mode })}
        />
        <div className={styles.row}>
          {state.form.stopMode === 'price' && (
            <NumberField {...fieldProps(props, 'stopPrice')} prefix="₹" />
          )}
          {state.form.stopMode === 'percent' && (
            <NumberField {...fieldProps(props, 'stopPct')} suffix="%" />
          )}
          {state.form.stopMode === 'atr' && (
            <>
              <NumberField {...fieldProps(props, 'atr')} prefix="₹" />
              <NumberField {...fieldProps(props, 'atrMultiple')} suffix="×" />
            </>
          )}
        </div>
        {state.form.stopMode !== 'price' && preview?.stop && (
          <output className={styles.derived} aria-live="polite">
            Stop <b className={styles.stopPrice}>{formatPrice(preview.stop.price)}</b>
          </output>
        )}
        {stopProblem && <p className={styles.error}>{errorText(stopProblem.code, 'form')}</p>}
        {preview && (
          <p className={preview.tick.nearBandEdge ? styles.tickNear : styles.tick}>
            Tick {formatPrice(preview.tick.value)} ·{' '}
            {preview.tick.source === 'override' ? 'your override' : 'NSE estimate'}
            {preview.tick.nearBandEdge && ' · near a price-band edge, check with your broker'}
            {preview.stop?.adjusted && ' · stop rounded down to the tick'}{' '}
            <InfoTip topic="Tick size" text={INFO_TEXT.tick} />
            {!showTickField && (
              <button type="button" className={styles.link} onClick={() => setEditTick(true)}>
                Edit
              </button>
            )}
          </p>
        )}
        {showTickField && (
          <NumberField {...fieldProps(props, 'tick')} prefix="₹" placeholder="Auto" />
        )}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>
          Risk <InfoTip topic="Risk" text={INFO_TEXT.risk} />
        </legend>
        <div className={styles.row}>
          <Segmented
            label="Risk unit"
            value={state.form.riskMode}
            options={RISK_MODES}
            onValueChange={(mode) => dispatch({ type: 'setRiskMode', mode })}
          />
          {state.form.riskMode === 'percent' ? (
            <NumberField {...fieldProps(props, 'riskPct')} suffix="%" />
          ) : (
            <NumberField {...fieldProps(props, 'riskAmount')} prefix="₹" />
          )}
        </div>
      </fieldset>

      <details className={styles.more}>
        <summary>Limits, costs &amp; targets</summary>
        <div className={styles.moreGrid}>
          <NumberField
            {...fieldProps(props, 'maxAllocationPct')}
            suffix="%"
            aside={<InfoTip topic="Max allocation" text={INFO_TEXT.maxAllocationPct} />}
          />
          <NumberField
            {...fieldProps(props, 'costPct')}
            suffix="%"
            aside={<InfoTip topic="Round-trip cost" text={INFO_TEXT.costPct} />}
          />
          {TARGET_SLOTS.map((slot) => (
            <NumberField
              key={slot}
              {...targetFieldProps(props, slot)}
              prefix="₹"
              aside={slot === 0 ? <InfoTip topic="Targets" text={INFO_TEXT.targets} /> : undefined}
            />
          ))}
        </div>
      </details>
    </section>
  );
}
