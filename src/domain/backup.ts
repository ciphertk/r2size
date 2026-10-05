/** Export/Import: a self-describing JSON file holding the whole local document (architecture §4). */
import { migrate } from './migrations';
import { CURRENT_SCHEMA_VERSION, type StoredDoc } from './schema';

export const MAX_BACKUP_BYTES = 256 * 1024;

export interface BackupFile {
  readonly app: 'r2size';
  readonly kind: 'backup';
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly data: StoredDoc;
}

export const toBackup = (doc: StoredDoc, now: Date): string =>
  JSON.stringify(
    {
      app: 'r2size',
      kind: 'backup',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      data: doc,
    } satisfies BackupFile,
    null,
    2,
  );

const pad = (n: number) => n.toString().padStart(2, '0');

/** r2size-backup-2026-10-05.json, in the device's local date. */
export const backupFileName = (now: Date): string =>
  `r2size-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;

export type BackupProblem = 'tooLarge' | 'notJson' | 'notR2size' | 'newer' | 'invalid';

export type ParseBackupResult =
  | { readonly ok: true; readonly doc: StoredDoc }
  | { readonly ok: false; readonly problem: BackupProblem };

/** Untrusted file text → a validated, migrated document. Never throws. */
export const parseBackup = (text: string): ParseBackupResult => {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) return { ok: false, problem: 'tooLarge' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'notJson' };
  }
  if (typeof json !== 'object' || json === null) return { ok: false, problem: 'notR2size' };
  const file = json as Partial<Record<keyof BackupFile, unknown>>;
  if (file.app !== 'r2size' || file.kind !== 'backup') return { ok: false, problem: 'notR2size' };

  const migrated = migrate(file.data);
  if (!migrated.ok)
    return { ok: false, problem: migrated.reason === 'newer' ? 'newer' : 'invalid' };
  return { ok: true, doc: migrated.doc };
};
