import { CURRENT_SCHEMA_VERSION, type Preset, type StoredDoc } from './schema';

const DEFAULT_STALE_DAYS = 7;

/** Seeded on first run and after a reset (architecture §4). */
const seedPresets = (now: Date): Preset[] => {
  const at = now.toISOString();
  return [
    {
      id: 'standard',
      name: 'Standard',
      riskPct: '1',
      stop: { kind: 'percent', pct: '5' },
      maxAllocationPct: null,
      costPct: '0',
      createdAt: at,
      updatedAt: at,
    },
    {
      id: 'conservative',
      name: 'Conservative',
      riskPct: '0.5',
      stop: { kind: 'percent', pct: '5' },
      maxAllocationPct: null,
      costPct: '0',
      createdAt: at,
      updatedAt: at,
    },
  ];
};

export const defaultDoc = (now: Date): StoredDoc => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  profile: { equity: null, availableCash: null, lastUpdated: null },
  presets: seedPresets(now),
  settings: {
    staleDays: DEFAULT_STALE_DAYS,
    defaultPresetId: null,
    persistRequested: false,
    installHintDismissed: false,
  },
});
