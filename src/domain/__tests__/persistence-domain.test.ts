import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { form } from '../../engine/__fixtures__/worked-examples';
import { backupFileName, MAX_BACKUP_BYTES, parseBackup, toBackup } from '../backup';
import { defaultDoc } from '../defaults';
import { migrate } from '../migrations';
import {
  applyPreset,
  draftFromForm,
  draftFromPreset,
  matchesPreset,
  validateDraft,
} from '../presets';
import type { Preset, StoredDoc } from '../schema';
import { daysSince, isStale } from '../staleness';

const NOW = new Date('2026-10-05T10:00:00.000Z');

const preset = (overrides: Partial<Preset> = {}): Preset => ({
  id: 'p1',
  name: 'Swing',
  riskPct: '1',
  stop: { kind: 'percent', pct: '7' },
  maxAllocationPct: '20',
  costPct: '0.25',
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});

const doc = (overrides: Partial<StoredDoc> = {}): StoredDoc => ({
  ...defaultDoc(NOW),
  ...overrides,
});

describe('migrate', () => {
  it('accepts the default document and a full one', () => {
    expect(migrate(defaultDoc(NOW))).toEqual({ ok: true, doc: defaultDoc(NOW) });
    const full = doc({
      profile: { equity: '2000000', availableCash: '640000.50', lastUpdated: NOW.toISOString() },
      presets: [
        preset(),
        preset({ id: 'p2', stop: { kind: 'atr', multiple: '1.5' }, maxAllocationPct: null }),
      ],
      settings: { staleDays: 14, defaultPresetId: 'p2', persistRequested: true },
    });
    expect(migrate(JSON.parse(JSON.stringify(full)))).toEqual({ ok: true, doc: full });
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['an array', []],
    ['no version', { profile: {} }],
    ['a fractional version', { ...defaultDoc(NOW), schemaVersion: 1.5 }],
    ['version 0', { ...defaultDoc(NOW), schemaVersion: 0 }],
    [
      'a negative equity',
      doc({ profile: { equity: '-5', availableCash: null, lastUpdated: null } }),
    ],
    [
      'equity with 3 decimals',
      doc({ profile: { equity: '1.234', availableCash: null, lastUpdated: null } }),
    ],
    [
      'a bad timestamp',
      doc({ profile: { equity: '1', availableCash: null, lastUpdated: 'yesterday' } }),
    ],
    ['risk over 100%', doc({ presets: [preset({ riskPct: '100.5' })] })],
    ['a stop of 100%', doc({ presets: [preset({ stop: { kind: 'percent', pct: '100' } })] })],
    [
      'a stored stop price',
      doc({ presets: [{ ...preset(), stop: { kind: 'price', price: '93' } } as never] }),
    ],
    ['cost of 10%', doc({ presets: [preset({ costPct: '10' })] })],
    ['an empty name', doc({ presets: [preset({ name: '  ' })] })],
    ['a 41-character name', doc({ presets: [preset({ name: 'x'.repeat(41) })] })],
    ['51 presets', doc({ presets: Array.from({ length: 51 }, (_, i) => preset({ id: `p${i}` })) })],
    [
      'staleDays 0',
      doc({ settings: { staleDays: 0, defaultPresetId: null, persistRequested: false } }),
    ],
  ])('rejects %s as corrupt', (_label, raw) => {
    expect(migrate(raw)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('refuses a document from a newer version', () => {
    expect(migrate({ ...defaultDoc(NOW), schemaVersion: 2 })).toEqual({
      ok: false,
      reason: 'newer',
    });
  });
});

describe('staleness (D12: calendar days, device time)', () => {
  it('counts calendar days, not 24-hour periods', () => {
    const late = new Date(2026, 9, 4, 23, 59);
    const early = new Date(2026, 9, 5, 0, 1);
    expect(daysSince(late.toISOString(), early)).toBe(1);
    expect(daysSince(early.toISOString(), new Date(2026, 9, 5, 23, 59))).toBe(0);
    expect(daysSince(new Date(2026, 8, 28, 12).toISOString(), new Date(2026, 9, 5, 9))).toBe(7);
    expect(daysSince(new Date(2026, 1, 28, 12).toISOString(), new Date(2026, 2, 1, 12))).toBe(1);
  });

  it('is stale from the threshold day on', () => {
    expect(isStale(6, 7)).toBe(false);
    expect(isStale(7, 7)).toBe(true);
    expect(isStale(30, 7)).toBe(true);
  });
});

describe('presets (D10, M3-D3, M3-D4)', () => {
  const base = form({
    entry: '100',
    stopPrice: '93',
    atr: '3.5',
    targets: ['120', '', ''],
    tick: '0.05',
  });

  it('fills only the preset fields', () => {
    const applied = applyPreset({ ...base, riskMode: 'amount', riskAmount: '5000' }, preset());
    expect(applied).toEqual({
      ...base,
      riskMode: 'percent',
      riskAmount: '5000',
      riskPct: '1',
      stopMode: 'percent',
      stopPct: '7',
      maxAllocationPct: '20',
      costPct: '0.25',
    });
    const atr = applyPreset(
      base,
      preset({ stop: { kind: 'atr', multiple: '2' }, maxAllocationPct: null }),
    );
    expect(atr).toMatchObject({
      stopMode: 'atr',
      atrMultiple: '2',
      atr: '3.5',
      maxAllocationPct: '',
    });
  });

  it('matches while the form still equals the preset, as numbers', () => {
    const applied = applyPreset(base, preset());
    expect(matchesPreset(applied, preset())).toBe(true);
    expect(matchesPreset({ ...applied, riskPct: '1.00' }, preset())).toBe(true);
    expect(matchesPreset({ ...applied, entry: '250' }, preset())).toBe(true);
    expect(matchesPreset({ ...applied, riskPct: '1.5' }, preset())).toBe(false);
    expect(matchesPreset({ ...applied, stopMode: 'price' }, preset())).toBe(false);
    expect(matchesPreset({ ...applied, riskMode: 'amount' }, preset())).toBe(false);
    expect(matchesPreset({ ...applied, maxAllocationPct: '' }, preset())).toBe(false);
    const noCost = preset({ costPct: '0', maxAllocationPct: null });
    expect(matchesPreset(applyPreset(base, noCost), noCost)).toBe(true);
    expect(matchesPreset({ ...applyPreset(base, noCost), costPct: '' }, noCost)).toBe(true);
    const atr = preset({ stop: { kind: 'atr', multiple: '2' } });
    expect(matchesPreset(applyPreset(base, atr), atr)).toBe(true);
    expect(matchesPreset({ ...applyPreset(base, atr), atrMultiple: '2.5' }, atr)).toBe(false);
  });

  it('builds editor drafts from the form and from a preset', () => {
    expect(draftFromForm(applyPreset(base, preset()), 'Mine')).toEqual({
      name: 'Mine',
      riskPct: '1',
      stopKind: 'percent',
      stopValue: '7',
      maxAllocationPct: '20',
      costPct: '0.25',
    });
    expect(draftFromForm({ ...base, stopMode: 'price', riskMode: 'amount' })).toMatchObject({
      riskPct: '',
      stopKind: 'percent',
      stopValue: '',
    });
    expect(draftFromPreset(preset({ costPct: '0', maxAllocationPct: null }))).toMatchObject({
      costPct: '',
      maxAllocationPct: '',
    });
  });

  it('validates drafts with field-level messages', () => {
    expect(
      validateDraft({
        name: ' Swing ',
        riskPct: '1',
        stopKind: 'atr',
        stopValue: '1.5',
        maxAllocationPct: '',
        costPct: '',
      }),
    ).toEqual({
      ok: true,
      fields: {
        name: 'Swing',
        riskPct: '1',
        stop: { kind: 'atr', multiple: '1.5' },
        maxAllocationPct: null,
        costPct: '0',
      },
    });
    const bad = validateDraft({
      name: '',
      riskPct: '200',
      stopKind: 'percent',
      stopValue: 'x',
      maxAllocationPct: '0',
      costPct: '12',
    });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual([
      'costPct',
      'maxAllocationPct',
      'name',
      'riskPct',
      'stopValue',
    ]);
    expect(!bad.ok && bad.errors.name).toBe('Give the preset a name.');
  });
});

describe('backup', () => {
  it('round-trips the whole document', () => {
    const original = doc({
      profile: { equity: '2000000', availableCash: null, lastUpdated: NOW.toISOString() },
      presets: [preset()],
    });
    expect(parseBackup(toBackup(original, NOW))).toEqual({ ok: true, doc: original });
  });

  it('round-trips any valid document (property)', () => {
    const money = fc
      .bigInt({ min: 1n, max: 10n ** 12n })
      .map((n) =>
        n % 7n === 0n ? `${n}` : `${n / 100n || 1n}.${(n % 100n).toString().padStart(2, '0')}`,
      );
    fc.assert(
      fc.property(
        fc.option(money, { nil: null }),
        fc.option(money, { nil: null }),
        fc.integer({ min: 1, max: 90 }),
        (equity, cash, staleDays) => {
          const d = doc({
            profile: {
              equity,
              availableCash: cash,
              lastUpdated: equity === null ? null : NOW.toISOString(),
            },
            settings: { staleDays, defaultPresetId: null, persistRequested: false },
          });
          expect(parseBackup(toBackup(d, NOW))).toEqual({ ok: true, doc: d });
        },
      ),
    );
  });

  it.each<[string, string, string]>([
    ['not JSON', '{oops', 'notJson'],
    ['JSON that is not an object', '42', 'notR2size'],
    ['another app', JSON.stringify({ app: 'other', kind: 'backup', data: {} }), 'notR2size'],
    [
      'a newer version',
      JSON.stringify({
        app: 'r2size',
        kind: 'backup',
        data: { ...defaultDoc(NOW), schemaVersion: 9 },
      }),
      'newer',
    ],
    [
      'invalid data',
      JSON.stringify({ app: 'r2size', kind: 'backup', data: { schemaVersion: 1 } }),
      'invalid',
    ],
    ['a huge file', ' '.repeat(MAX_BACKUP_BYTES + 1), 'tooLarge'],
  ])('rejects %s', (_label, text, problem) => {
    expect(parseBackup(text)).toEqual({ ok: false, problem });
  });

  it('names the file by local date', () => {
    expect(backupFileName(new Date(2026, 9, 5, 23, 30))).toBe('r2size-backup-2026-10-05.json');
  });
});
