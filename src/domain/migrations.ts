/**
 * Brings any saved document up to the current schema, then validates it.
 * Add a step here (v(n) → v(n+1)) whenever StoredDoc changes shape.
 */
import * as v from 'valibot';
import { CURRENT_SCHEMA_VERSION, StoredDocSchema, type StoredDoc } from './schema';

type Step = (doc: Record<string, unknown>) => Record<string, unknown>;

/** STEPS[n] upgrades a version-n document to version n + 1. None yet: v1 is the first. */
const STEPS: Readonly<Record<number, Step>> = {};

export type MigrateResult =
  | { readonly ok: true; readonly doc: StoredDoc }
  | { readonly ok: false; readonly reason: 'corrupt' | 'newer' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const migrate = (raw: unknown): MigrateResult => {
  if (
    !isRecord(raw) ||
    typeof raw.schemaVersion !== 'number' ||
    !Number.isInteger(raw.schemaVersion)
  ) {
    return { ok: false, reason: 'corrupt' };
  }
  if (raw.schemaVersion > CURRENT_SCHEMA_VERSION) return { ok: false, reason: 'newer' };

  let doc = raw;
  for (let version = raw.schemaVersion; version < CURRENT_SCHEMA_VERSION; version += 1) {
    const step = STEPS[version];
    if (step === undefined) return { ok: false, reason: 'corrupt' };
    doc = { ...step(doc), schemaVersion: version + 1 };
  }

  const parsed = v.safeParse(StoredDocSchema, doc);
  return parsed.success ? { ok: true, doc: parsed.output } : { ok: false, reason: 'corrupt' };
};
