import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
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

/** A radio group drawn as a segmented control: real radio semantics, arrow-key navigation. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: SegmentedProps<T>) {
  return (
    <RadioGroup
      aria-label={label}
      className={styles.group}
      value={value}
      onValueChange={(next) => {
        const match = options.find((option) => option.value === next);
        if (match) onValueChange(match.value);
      }}
    >
      {options.map((option) => (
        <Radio.Root key={option.value} value={option.value} className={styles.segment}>
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
