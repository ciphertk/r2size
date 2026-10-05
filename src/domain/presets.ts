/**
 * Presets fill the parts of a setup that a trader repeats: risk %, the stop method with its
 * % or ATR multiple, the allocation cap and cost % (D10). Nothing stock-specific.
 */
import * as v from 'valibot';
import { parseDecimal, PLACES, type RawForm } from '../engine';
import { PresetFieldsSchema, type Preset, type PresetFields } from './schema';

/** M3-D3: entry, stop price, ATR value, targets and symbol are never touched. */
export const applyPreset = (form: RawForm, preset: PresetFields): RawForm => ({
  ...form,
  riskMode: 'percent',
  riskPct: preset.riskPct,
  stopMode: preset.stop.kind,
  ...(preset.stop.kind === 'percent'
    ? { stopPct: preset.stop.pct }
    : { atrMultiple: preset.stop.multiple }),
  maxAllocationPct: preset.maxAllocationPct ?? '',
  costPct: preset.costPct,
});

/** Equal as numbers ("1" = "1.00"); a blank cost counts as 0, as the engine does. */
const sameNumber = (a: string, b: string, places: number, blankIsZero = false): boolean => {
  const read = (text: string) => {
    const parsed = parseDecimal(text === '' && blankIsZero ? '0' : text, places);
    return parsed.kind === 'value' ? `${parsed.value.n}/${parsed.value.d}` : parsed.kind;
  };
  return read(a) === read(b);
};

/** M3-D4: a chip is selected while the form still matches its preset. */
export const matchesPreset = (form: RawForm, preset: PresetFields): boolean =>
  form.riskMode === 'percent' &&
  sameNumber(form.riskPct, preset.riskPct, PLACES.percent) &&
  form.stopMode === preset.stop.kind &&
  (preset.stop.kind === 'percent'
    ? sameNumber(form.stopPct, preset.stop.pct, PLACES.percent)
    : sameNumber(form.atrMultiple, preset.stop.multiple, PLACES.multiple)) &&
  sameNumber(form.maxAllocationPct, preset.maxAllocationPct ?? '', PLACES.percent) &&
  sameNumber(form.costPct, preset.costPct, PLACES.percent, true);

/** What the editor is filled with: raw strings, possibly invalid. */
export interface PresetDraft {
  readonly name: string;
  readonly riskPct: string;
  readonly stopKind: 'percent' | 'atr';
  readonly stopValue: string;
  readonly maxAllocationPct: string;
  readonly costPct: string;
}

const strip = (text: string) => text.replace(/[,\s]/g, '');

/** "Save current as preset": pre-fills the editor from the form. */
export const draftFromForm = (form: RawForm, name = ''): PresetDraft => ({
  name,
  riskPct: form.riskMode === 'percent' ? strip(form.riskPct) : '',
  stopKind: form.stopMode === 'atr' ? 'atr' : 'percent',
  stopValue:
    form.stopMode === 'atr'
      ? strip(form.atrMultiple)
      : form.stopMode === 'percent'
        ? strip(form.stopPct)
        : '',
  maxAllocationPct: strip(form.maxAllocationPct),
  costPct: strip(form.costPct),
});

export const draftFromPreset = (preset: Preset): PresetDraft => ({
  name: preset.name,
  riskPct: preset.riskPct,
  stopKind: preset.stop.kind,
  stopValue: preset.stop.kind === 'percent' ? preset.stop.pct : preset.stop.multiple,
  maxAllocationPct: preset.maxAllocationPct ?? '',
  costPct: preset.costPct === '0' ? '' : preset.costPct,
});

export type DraftField = 'name' | 'riskPct' | 'stopValue' | 'maxAllocationPct' | 'costPct';

export type DraftResult =
  | { readonly ok: true; readonly fields: PresetFields }
  | { readonly ok: false; readonly errors: Partial<Record<DraftField, string>> };

const ISSUE_FIELD: Record<string, DraftField> = {
  name: 'name',
  riskPct: 'riskPct',
  stop: 'stopValue',
  pct: 'stopValue',
  multiple: 'stopValue',
  maxAllocationPct: 'maxAllocationPct',
  costPct: 'costPct',
};

export const validateDraft = (draft: PresetDraft): DraftResult => {
  const candidate = {
    name: draft.name,
    riskPct: strip(draft.riskPct),
    stop:
      draft.stopKind === 'percent'
        ? { kind: 'percent', pct: strip(draft.stopValue) }
        : { kind: 'atr', multiple: strip(draft.stopValue) },
    maxAllocationPct: strip(draft.maxAllocationPct) === '' ? null : strip(draft.maxAllocationPct),
    costPct: strip(draft.costPct) === '' ? '0' : strip(draft.costPct),
  };
  const parsed = v.safeParse(PresetFieldsSchema, candidate);
  if (parsed.success) return { ok: true, fields: parsed.output };

  const errors: Partial<Record<DraftField, string>> = {};
  for (const issue of parsed.issues) {
    const key = [...(issue.path ?? [])]
      .reverse()
      .find((item) => typeof item.key === 'string' && item.key in ISSUE_FIELD)?.key as
      string | undefined;
    const field = key === undefined ? undefined : ISSUE_FIELD[key];
    if (field !== undefined && errors[field] === undefined) {
      errors[field] = issue.message.startsWith('Invalid') ? 'Enter a valid number.' : issue.message;
    }
  }
  return { ok: false, errors };
};
