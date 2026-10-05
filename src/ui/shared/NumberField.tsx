import { useState, type ReactNode } from 'react';
import { formatTyped } from '../../domain/format';
import styles from './NumberField.module.css';

export interface NumberFieldProps {
  readonly id: string;
  readonly label: ReactNode;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** Called when the user leaves the field (marks it touched). */
  readonly onCommit?: (() => void) | undefined;
  readonly prefix?: string | undefined;
  readonly suffix?: string | undefined;
  readonly hint?: ReactNode;
  readonly warning?: string | undefined;
  readonly error?: string | undefined;
  /** Rendered next to the label, e.g. an InfoTip. */
  readonly aside?: ReactNode;
  readonly placeholder?: string | undefined;
}

/**
 * A text input with the decimal keypad. Never type="number": it rejects commas, changes on
 * scroll and hides invalid input. What the user types is kept exactly; grouping commas are
 * only shown once the field loses focus, so the value never shifts under their cursor.
 */
export function NumberField({
  id,
  label,
  value,
  onValueChange,
  onCommit,
  prefix,
  suffix,
  hint,
  warning,
  error,
  aside,
  placeholder,
}: NumberFieldProps) {
  const [focused, setFocused] = useState(false);
  const hintId = `${id}-hint`;
  const warningId = `${id}-warning`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint && hintId, warning && warningId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {aside}
      </div>
      <div className={styles.control}>
        {prefix && (
          <span className={styles.prefix} aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          className={[
            styles.input,
            prefix ? styles.withPrefix : '',
            suffix ? styles.withSuffix : '',
            error ? styles.invalid : '',
          ].join(' ')}
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={focused ? value : formatTyped(value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onCommit?.();
          }}
        />
        {suffix && (
          <span className={styles.suffix} aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
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
  );
}
