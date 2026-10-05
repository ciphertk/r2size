/**
 * The one document R2Size keeps on the device (architecture §4), validated with Valibot.
 * Numbers are stored as decimal strings and checked with the engine's own parser, so a
 * saved value can never be something the calculator would reject.
 */
import * as v from 'valibot';
import { cmp, decimal, isPositive, parseDecimal, PLACES } from '../engine';

const HUNDRED = decimal('100');
const TEN = decimal('10');

type Bound = (value: ReturnType<typeof decimal>) => boolean;

const decimalString = (places: number, bound: Bound, message: string) =>
  v.pipe(
    v.string(),
    v.check((text) => {
      const parsed = parseDecimal(text, places);
      return parsed.kind === 'value' && bound(parsed.value);
    }, message),
  );

const positive: Bound = (x) => isPositive(x);
/** 0 < x ≤ 100 */
const upTo100: Bound = (x) => isPositive(x) && cmp(x, HUNDRED) <= 0;
/** 0 < x < 100 */
const below100: Bound = (x) => isPositive(x) && cmp(x, HUNDRED) < 0;
/** 0 ≤ x < 10 */
const costRange: Bound = (x) => cmp(x, TEN) < 0;

export const MoneySchema = decimalString(PLACES.price, positive, 'Must be a positive amount.');
export const RiskPctSchema = decimalString(
  PLACES.percent,
  upTo100,
  'Use more than 0% and at most 100%.',
);
export const StopPctSchema = decimalString(
  PLACES.percent,
  below100,
  'Use more than 0% and less than 100%.',
);
export const AtrMultipleSchema = decimalString(PLACES.multiple, positive, 'Must be more than 0.');
export const AllocationPctSchema = RiskPctSchema;
export const CostPctSchema = decimalString(
  PLACES.percent,
  costRange,
  'Use from 0% up to, but not including, 10%.',
);

const Timestamp = v.pipe(v.string(), v.isoTimestamp());

export const ProfileSchema = v.object({
  equity: v.nullable(MoneySchema),
  availableCash: v.nullable(MoneySchema),
  lastUpdated: v.nullable(Timestamp),
});

/** A preset never holds a stop price or ATR value: those belong to one stock (D10). */
export const PresetStopSchema = v.variant('kind', [
  v.object({ kind: v.literal('percent'), pct: StopPctSchema }),
  v.object({ kind: v.literal('atr'), multiple: AtrMultipleSchema }),
]);

export const PRESET_NAME_MAX = 40;
export const PRESETS_MAX = 50;

export const PresetNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Give the preset a name.'),
  v.maxLength(PRESET_NAME_MAX, `Keep the name to ${PRESET_NAME_MAX} characters.`),
);

export const PresetFieldsSchema = v.object({
  name: PresetNameSchema,
  riskPct: RiskPctSchema,
  stop: PresetStopSchema,
  maxAllocationPct: v.nullable(AllocationPctSchema),
  costPct: CostPctSchema,
});

export const PresetSchema = v.object({
  ...PresetFieldsSchema.entries,
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});

export const SettingsSchema = v.object({
  staleDays: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(90)),
  defaultPresetId: v.nullable(v.string()),
  persistRequested: v.boolean(),
  /** Added in M4 as optional (default false), so v1 documents and backups need no migration. */
  installHintDismissed: v.optional(v.boolean(), false),
});

export const StoredDocSchema = v.object({
  schemaVersion: v.literal(1),
  profile: ProfileSchema,
  presets: v.pipe(v.array(PresetSchema), v.maxLength(PRESETS_MAX)),
  settings: SettingsSchema,
});

export type Profile = v.InferOutput<typeof ProfileSchema>;
export type PresetStop = v.InferOutput<typeof PresetStopSchema>;
export type PresetFields = v.InferOutput<typeof PresetFieldsSchema>;
export type Preset = v.InferOutput<typeof PresetSchema>;
export type Settings = v.InferOutput<typeof SettingsSchema>;
export type StoredDoc = v.InferOutput<typeof StoredDocSchema>;

export const CURRENT_SCHEMA_VERSION = 1;
