import { useId } from 'react';
import styles from './Segmented.module.css';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly SegmentedOption<T>[];
  readonly onValueChange: (value: T) => void;
}

/**
 * A radio group drawn as pills, built on native radio inputs (architecture §8): real radio
 * semantics and arrow-key navigation from the browser, with no JavaScript. Base UI's RadioGroup
 * measured the page layout on mount, which cost ~0.5 s of start-up on a throttled phone.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: SegmentedProps<T>) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={styles.group}>
      {options.map((option) => (
        <label
          key={option.value}
          className={styles.segment}
          data-checked={option.value === value ? '' : undefined}
        >
          <input
            type="radio"
            className={styles.input}
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onValueChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
