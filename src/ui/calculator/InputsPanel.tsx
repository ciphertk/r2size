import { useState, type ReactNode } from 'react';
import type { RiskMode, StopMode, StopPreview } from '../../engine';
import { formatPrice } from '../../domain/format';
import { errorText, INFO_TEXT } from '../../domain/messages';
import { formErrors } from '../../state/selectors';
import { InfoTip } from '../shared/InfoTip';
import { NumberField } from '../shared/NumberField';
import field from '../shared/NumberField.module.css';
import { Segmented } from '../shared/Segmented';
import { fieldProps, targetFieldProps, type FieldContext } from './field-props';
import styles from './InputsPanel.module.css';

const STOP_MODES = [
  { value: 'price', label: 'Price' },
  { value: 'percent', label: '% below' },
  { value: 'atr', label: 'ATR ×' },
] as const satisfies readonly { value: StopMode; label: string }[];

const RISK_MODES = [
  { value: 'percent', label: '% equity' },
  { value: 'amount', label: '₹ amount' },
] as const satisfies readonly { value: RiskMode; label: string }[];

/** A labelled row holding a control that isn't a NumberField (pills, the symbol). */
function Row({
  label,
  aside,
  children,
}: {
  label: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={field.field}>
      <div className={field.labelCell}>
        <span className={field.label}>{label}</span>
        {aside}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

export interface InputsPanelProps extends FieldContext {
  readonly preview: StopPreview | null;
  /** The account rows (equity, cash), placed after risk. */
  readonly account: ReactNode;
}

export function InputsPanel(props: InputsPanelProps) {
  const { state, dispatch, outcome, preview, account } = props;
  const [editTick, setEditTick] = useState(false);
  const stopProblem = formErrors(outcome).find((e) => e.code === 'derivedStopNotPositive');
  const showTickField = editTick || state.form.tick !== '';
  const derivedStop = preview?.stop && state.form.stopMode !== 'price' && (
    <output aria-live="polite" className={styles.derived}>
      Stop <b>{formatPrice(preview.stop.price)}</b>
    </output>
  );

  return (
    <div className={styles.panel} data-field-scope="">
      <section className={styles.section} aria-label="Trade setup">
        <h2 className={styles.title}>Trade</h2>
        <div className={field.field}>
          <div className={field.labelCell}>
            <label htmlFor="field-symbol" className={field.label}>
              Symbol
            </label>
          </div>
          <div className={field.control}>
            <input
              id="field-symbol"
              data-number-field=""
              className={`${field.input} ${styles.symbol}`}
              value={state.symbol}
              placeholder="optional"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              enterKeyHint="next"
              onChange={(event) => dispatch({ type: 'setSymbol', value: event.target.value })}
            />
          </div>
        </div>
        <NumberField
          {...fieldProps(props, 'entry')}
          prefix="₹"
          aside={<InfoTip topic="Entry" text={INFO_TEXT.entry} />}
        />
        <Row label="Stop by" aside={<InfoTip topic="Stop" text={INFO_TEXT.stop} />}>
          <Segmented
            label="Stop method"
            value={state.form.stopMode}
            options={STOP_MODES}
            onValueChange={(mode) => dispatch({ type: 'setStopMode', mode })}
          />
        </Row>
        {state.form.stopMode === 'price' && (
          <NumberField {...fieldProps(props, 'stopPrice')} short="Stop" prefix="₹" />
        )}
        {state.form.stopMode === 'percent' && (
          <NumberField
            {...fieldProps(props, 'stopPct')}
            short="Stop"
            suffix="% below"
            trail={derivedStop}
          />
        )}
        {state.form.stopMode === 'atr' && (
          <>
            <NumberField {...fieldProps(props, 'atr')} prefix="₹" />
            <NumberField
              {...fieldProps(props, 'atrMultiple')}
              short="Multiple"
              suffix="×"
              trail={derivedStop}
            />
          </>
        )}
        {stopProblem && <p className={styles.error}>{errorText(stopProblem.code, 'form')}</p>}
        <NumberField
          {...targetFieldProps(props, 0)}
          short="Target"
          prefix="₹"
          aside={<InfoTip topic="Targets" text={INFO_TEXT.targets} />}
        />
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
          <NumberField {...fieldProps(props, 'tick')} short="Tick" prefix="₹" placeholder="Auto" />
        )}
      </section>

      <section className={styles.section} aria-label="Risk">
        <h2 className={styles.title}>Risk</h2>
        <Row label="Risk by" aside={<InfoTip topic="Risk" text={INFO_TEXT.risk} />}>
          <Segmented
            label="Risk unit"
            value={state.form.riskMode}
            options={RISK_MODES}
            onValueChange={(mode) => dispatch({ type: 'setRiskMode', mode })}
          />
        </Row>
        {state.form.riskMode === 'percent' ? (
          <NumberField {...fieldProps(props, 'riskPct')} short="Risk" suffix="% of equity" />
        ) : (
          <NumberField {...fieldProps(props, 'riskAmount')} short="Risk" prefix="₹" />
        )}
      </section>

      {account}

      <details className={styles.more}>
        <summary>Limits, costs &amp; targets</summary>
        <NumberField
          {...fieldProps(props, 'maxAllocationPct')}
          short="Max alloc."
          suffix="% of equity"
          aside={<InfoTip topic="Max allocation" text={INFO_TEXT.maxAllocationPct} />}
        />
        <NumberField
          {...fieldProps(props, 'costPct')}
          short="Cost"
          suffix="% round trip"
          aside={<InfoTip topic="Round-trip cost" text={INFO_TEXT.costPct} />}
        />
        <NumberField {...targetFieldProps(props, 1)} prefix="₹" />
        <NumberField {...targetFieldProps(props, 2)} prefix="₹" />
      </details>
    </div>
  );
}
