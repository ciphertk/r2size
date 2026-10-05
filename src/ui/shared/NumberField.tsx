import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { formatTyped } from '../../domain/format';
import styles from './NumberField.module.css';

export interface NumberFieldProps {
  readonly id: string;
  /** The full accessible name, e.g. "Stop % below entry". */
  readonly label: string;
  /** A shorter visible label when the unit already says the rest, e.g. "Stop" + "% below". */
  readonly short?: string | undefined;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** Called when the user leaves the field (marks it touched). */
  readonly onCommit?: (() => void) | undefined;
  readonly prefix?: string | undefined;
  readonly suffix?: string | undefined;
  /** Shown at the far end of the row, e.g. the stop price a % stop works out to. */
  readonly trail?: ReactNode;
  readonly hint?: ReactNode;
  readonly warning?: string | undefined;
  readonly error?: string | undefined;
  /** Rendered next to the label, e.g. an InfoTip. */
  readonly aside?: ReactNode;
  readonly placeholder?: string | undefined;
}

/** Enter moves to the next field, like a spreadsheet; the last one keeps focus. */
const nextOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const scope = event.currentTarget.closest('[data-field-scope]') ?? document;
  const all = [...scope.querySelectorAll<HTMLInputElement>('input[data-number-field]')];
  const next = all[all.indexOf(event.currentTarget) + 1];
  if (next) {
    next.focus();
    next.select();
  }
};

/**
 * One property row: label on the left, the value with its units on the right. A text input
 * with the decimal keypad, never type="number" (it rejects commas, changes on scroll and hides
 * invalid input). What the user types is kept exactly; grouping commas are only shown once the
 * field loses focus, so the value never shifts under the cursor.
 */
export function NumberField({
  id,
  label,
  short,
  value,
  onValueChange,
  onCommit,
  prefix,
  suffix,
  trail,
  hint,
  warning,
  error,
  aside,
  placeholder = '—',
}: NumberFieldProps) {
  const [focused, setFocused] = useState(false);
  const hintId = `${id}-hint`;
  const warningId = `${id}-warning`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint && hintId, warning && warningId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field} data-invalid={error ? '' : undefined}>
      <div className={styles.labelCell}>
        <label htmlFor={id} className={styles.label}>
          {short ?? label}
        </label>
        {aside}
      </div>
      <div className={styles.control}>
        {prefix && (
          <span className={styles.unit} aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          data-number-field=""
          className={styles.input}
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-label={short !== undefined && short !== label ? label : undefined}
          value={focused ? value : formatTyped(value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={nextOnEnter}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onCommit?.();
          }}
        />
        {suffix && (
          <span className={styles.unit} aria-hidden="true">
            {suffix}
          </span>
        )}
        {trail && <span className={styles.trail}>{trail}</span>}
      </div>
      {(hint || warning || error) && (
        <div className={styles.messages}>
          {hint && (
            <p id={hintId} className={styles.hint}>
              {hint}
            </p>
          )}
          {warning && (
            <p id={warningId} className={styles.warning}>
              {warning}
            </p>
          )}
          {error && (
            <p id={errorId} className={styles.error}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
