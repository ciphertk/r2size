import { useState } from 'react';
import { PRESET_NAME_MAX, type PresetFields } from '../../domain/schema';
import { validateDraft, type DraftField, type PresetDraft } from '../../domain/presets';
import { NumberField } from '../shared/NumberField';
import { Segmented } from '../shared/Segmented';
import { Sheet } from '../shared/Sheet';
import styles from './PresetEditor.module.css';

export interface PresetEditorProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Editing an existing preset, or creating one (pre-filled from the current setup). */
  readonly mode: 'new' | 'edit';
  readonly initial: PresetDraft;
  readonly onSave: (fields: PresetFields) => void;
  readonly onDelete?: (() => void) | undefined;
}

const STOP_KINDS = [
  { value: 'percent', label: '% below' },
  { value: 'atr', label: 'ATR ×' },
] as const;

/** Create or edit a preset. Only D10 fields: never a stop price or an ATR value. */
export function PresetEditor(props: PresetEditorProps) {
  return (
    <Sheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.mode === 'new' ? 'New preset' : 'Edit preset'}
      description="A preset fills risk %, the stop method, the allocation cap and costs. Entry and stop prices are never saved."
    >
      {/* Remounts with fresh values each time the sheet opens. */}
      {props.open && <EditorForm {...props} />}
    </Sheet>
  );
}

function EditorForm({ mode, initial, onSave, onDelete, onOpenChange }: PresetEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (field: keyof PresetDraft) => (value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const submit = () => {
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSave(result.fields);
    onOpenChange(false);
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className={styles.field}>
        <label htmlFor="preset-name" className={styles.label}>
          Name
        </label>
        <input
          id="preset-name"
          className={styles.text}
          value={draft.name}
          maxLength={PRESET_NAME_MAX}
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'preset-name-error' : undefined}
          onChange={(event) => set('name')(event.target.value)}
        />
        {errors.name && (
          <p id="preset-name-error" className={styles.error}>
            {errors.name}
          </p>
        )}
      </div>
      <NumberField
        id="preset-risk"
        label="Risk % of equity"
        suffix="%"
        value={draft.riskPct}
        onValueChange={set('riskPct')}
        error={errors.riskPct}
      />
      <div className={styles.field}>
        <span className={styles.label} id="preset-stop-label">
          Stop
        </span>
        <Segmented
          label="Stop method"
          value={draft.stopKind}
          options={STOP_KINDS}
          onValueChange={(kind) => setDraft((d) => ({ ...d, stopKind: kind }))}
        />
      </div>
      <NumberField
        id="preset-stop"
        label={draft.stopKind === 'percent' ? 'Stop % below entry' : 'ATR multiple'}
        suffix={draft.stopKind === 'percent' ? '%' : '×'}
        value={draft.stopValue}
        onValueChange={set('stopValue')}
        error={errors.stopValue}
      />
      <div className={styles.pair}>
        <NumberField
          id="preset-allocation"
          label="Max allocation (optional)"
          suffix="%"
          value={draft.maxAllocationPct}
          onValueChange={set('maxAllocationPct')}
          error={errors.maxAllocationPct}
        />
        <NumberField
          id="preset-cost"
          label="Round-trip cost (optional)"
          suffix="%"
          value={draft.costPct}
          onValueChange={set('costPct')}
          error={errors.costPct}
        />
      </div>

      <div className={styles.actions}>
        {mode === 'edit' && onDelete && (
          <button
            type="button"
            className={styles.delete}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              onDelete();
              onOpenChange(false);
            }}
          >
            {confirmDelete ? 'Tap again to delete' : 'Delete'}
          </button>
        )}
        <button type="submit" className={styles.save}>
          Save preset
        </button>
      </div>
    </form>
  );
}
