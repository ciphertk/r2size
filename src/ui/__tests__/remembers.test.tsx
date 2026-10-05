import { screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_BACKUP_BYTES, toBackup } from '../../domain/backup';
import { defaultDoc } from '../../domain/defaults';
import type { StoredDoc } from '../../domain/schema';
import { KEY } from '../../infra/storage';
import { CalculatorScreen } from '../calculator/CalculatorScreen';
import { freshStore, renderWithStore } from './render';

const saved = (): StoredDoc => JSON.parse(localStorage.getItem(KEY) ?? 'null') as StoredDoc;
const field = (label: string) => screen.getByLabelText(label, { exact: true });

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('profile (M3-D1, M3-D2)', () => {
  it('saves equity when the field is left and says when', async () => {
    const user = userEvent.setup();
    renderWithStore(<CalculatorScreen />);
    expect(screen.getByText('Saved on this device when you leave the field.')).toBeInTheDocument();
    await user.type(field('Equity'), '2000000');
    await user.tab();
    expect(saved().profile.equity).toBe('2000000');
    expect(screen.getByText('Saved on this device · updated today')).toBeInTheDocument();
  });

  it('reminds when the figures are stale, and "Still correct" clears it', async () => {
    const user = userEvent.setup();
    const store = freshStore();
    store.actions.saveProfile('2000000', '');
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0));
    renderWithStore(<CalculatorScreen />, store);
    expect(
      screen.getByText('Equity last updated 7 days ago. Still ₹20,00,000?'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Still correct' }));
    expect(screen.queryByText(/Equity last updated/)).not.toBeInTheDocument();
    expect(saved().profile.lastUpdated).toBe(new Date(2026, 9, 12, 9, 0).toISOString());
  });

  it('"Update" moves focus to equity', async () => {
    const user = userEvent.setup();
    const store = freshStore();
    store.actions.saveProfile('2000000', '');
    vi.setSystemTime(new Date(2026, 10, 1));
    renderWithStore(<CalculatorScreen />, store);
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(field('Equity')).toHaveFocus();
  });
});

describe('presets (M3-D3, M3-D4)', () => {
  it('applies a seeded preset without touching entry, and deselects after an edit', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<CalculatorScreen />);
    await user.type(field('Entry'), '100');
    const standard = screen.getByRole('button', { name: /Standard/ });
    expect(standard).toHaveAttribute('aria-pressed', 'false');
    await user.click(standard);
    expect(standard).toHaveAttribute('aria-pressed', 'true');
    expect(field('Risk % of equity')).toHaveValue('1');
    expect(field('Stop % below entry')).toHaveValue('5');
    expect(field('Entry')).toHaveValue('100');
    expect(store.getState().doc.settings.defaultPresetId).toBe('standard');

    await user.clear(field('Risk % of equity'));
    await user.type(field('Risk % of equity'), '2');
    expect(standard).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves a new preset from the current setup and applies it', async () => {
    const user = userEvent.setup();
    renderWithStore(<CalculatorScreen />);
    await user.type(field('Risk % of equity'), '0.75');
    await user.click(screen.getByRole('radio', { name: 'ATR ×' }));
    await user.type(field('ATR multiple'), '1.5');
    await user.click(screen.getByRole('button', { name: 'New preset from this setup' }));

    const dialog = await screen.findByRole('dialog', { name: 'New preset' });
    expect(within(dialog).getByLabelText('Risk % of equity')).toHaveValue('0.75');
    expect(within(dialog).getByLabelText('ATR multiple')).toHaveValue('1.5');
    await user.click(within(dialog).getByRole('button', { name: 'Save preset' }));
    expect(within(dialog).getByText('Give the preset a name.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Name'), 'Breakout');
    await user.click(within(dialog).getByRole('button', { name: 'Save preset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.querySelector('[data-base-ui-inert]')).toBeNull());
    expect(screen.getByRole('button', { name: /Breakout/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(saved().presets.at(-1)).toMatchObject({
      name: 'Breakout',
      riskPct: '0.75',
      stop: { kind: 'atr', multiple: '1.5' },
      costPct: '0',
    });
  });
});

describe('settings & data (M3-D7)', () => {
  const backupDoc: StoredDoc = {
    ...defaultDoc(new Date(2026, 9, 1)),
    profile: {
      equity: '900000',
      availableCash: '50000',
      lastUpdated: new Date(2026, 9, 3, 12).toISOString(),
    },
    presets: [],
  };

  it('previews an import, replaces the data, and can undo it', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<CalculatorScreen settingsOpen />);
    store.actions.saveProfile('2000000', '');
    const file = new File([toBackup(backupDoc, new Date())], 'r2size-backup.json', {
      type: 'application/json',
    });
    await user.upload(screen.getByLabelText('Backup file'), file);

    const preview = await screen.findByRole('group', { name: 'Import preview' });
    expect(preview).toHaveTextContent(
      'Replace your data with: equity ₹9,00,000 (updated 3 Oct), 0 presets?',
    );
    await user.click(within(preview).getByRole('button', { name: 'Replace my data' }));
    expect(saved()).toEqual(backupDoc);
    await waitFor(() => expect(field('Equity')).toHaveValue('9,00,000'));

    await user.click(screen.getByRole('button', { name: 'Undo import' }));
    expect(saved().profile.equity).toBe('2000000');
  });

  it('rejects a file that is not a backup', async () => {
    const user = userEvent.setup();
    renderWithStore(<CalculatorScreen settingsOpen />);
    await user.upload(
      screen.getByLabelText('Backup file'),
      new File(['{"hello":1}'], 'x.json', { type: 'application/json' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That file is not an R2Size backup.',
    );
  });

  it('rejects an oversized file by its size, without reading it into memory', async () => {
    const user = userEvent.setup();
    renderWithStore(<CalculatorScreen settingsOpen />);
    const huge = new File(['{}'], 'huge.json', { type: 'application/json' });
    Object.defineProperty(huge, 'size', { value: MAX_BACKUP_BYTES + 1 });
    const read = vi.fn(() => Promise.reject(new Error('the file was read')));
    Object.defineProperty(huge, 'text', { value: read });
    await user.upload(screen.getByLabelText('Backup file'), huge);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That file is too large to be an R2Size backup.',
    );
    expect(read).not.toHaveBeenCalled();
  });

  it('resets everything after confirmation', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<CalculatorScreen settingsOpen />);
    store.actions.saveProfile('2000000', '');
    store.actions.deletePreset('standard');
    await user.click(screen.getByRole('button', { name: 'Delete all data on this device' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete all data?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete everything' }));
    expect(store.getState().doc.profile.equity).toBeNull();
    expect(store.getState().doc.presets.map((p) => p.id)).toEqual(['standard', 'conservative']);
    await waitFor(() => expect(field('Equity')).toHaveValue(''));
  });

  it('saves the reminder interval', async () => {
    const user = userEvent.setup();
    renderWithStore(<CalculatorScreen settingsOpen />);
    const days = screen.getByLabelText(/Remind me to check my equity after/);
    await user.clear(days);
    await user.type(days, '120');
    await user.tab();
    expect(screen.getByText('Use a whole number of days from 1 to 90.')).toBeInTheDocument();
    await user.clear(days);
    await user.type(days, '14');
    await user.tab();
    expect(saved().settings.staleDays).toBe(14);
  });
});
