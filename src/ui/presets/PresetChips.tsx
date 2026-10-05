import type { RawForm } from '../../engine';
import { matchesPreset } from '../../domain/presets';
import type { Preset } from '../../domain/schema';
import styles from './PresetChips.module.css';

export interface PresetChipsProps {
  readonly presets: readonly Preset[];
  readonly form: RawForm;
  readonly onApply: (preset: Preset) => void;
  readonly onNew: () => void;
}

const riskLabel = (preset: Preset) => `${preset.riskPct}%`;

/** One tap fills risk, stop method, cap and cost. "Selected" is derived from the form (M3-D4). */
export function PresetChips({ presets, form, onApply, onNew }: PresetChipsProps) {
  return (
    <div className={styles.row} role="group" aria-label="Presets">
      {presets.map((preset) => {
        const selected = matchesPreset(form, preset);
        return (
          <button
            key={preset.id}
            type="button"
            className={styles.chip}
            aria-pressed={selected}
            onClick={() => onApply(preset)}
          >
            <span className={styles.dot} aria-hidden="true" />
            {preset.name} <span className={styles.detail}>{riskLabel(preset)}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={`${styles.chip} ${styles.add}`}
        onClick={onNew}
        aria-label="New preset from this setup"
      >
        +
      </button>
    </div>
  );
}
