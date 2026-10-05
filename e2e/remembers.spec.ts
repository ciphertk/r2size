import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { seriousViolations } from './support/axe';

const equity = (page: Page) => page.getByLabel('Equity', { exact: true });
const result = (page: Page) => page.getByRole('complementary', { name: 'Result' });

const saveProfile = async (page: Page, value = '2000000') => {
  await equity(page).fill(value);
  await equity(page).blur();
  await expect(page.getByText(/Saved on this device · updated today/)).toBeVisible();
};

const openSettings = async (page: Page) => {
  await page.getByRole('button', { name: 'Settings and data' }).click();
  return page.getByRole('dialog', { name: 'Settings & data' });
};

test('remembers the profile and the last preset across reloads', async ({ page }) => {
  await page.goto('/');
  await saveProfile(page);
  await page.getByRole('button', { name: /Conservative/ }).click();
  await page.goto('/'); // a fresh launch, not just a reload of the same hash
  await expect(equity(page)).toHaveValue('20,00,000');
  await expect(page.getByLabel('Risk % of equity')).toHaveValue('0.5');
  await expect(page.getByRole('button', { name: /Conservative/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('reminds when equity is out of date, by calendar day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T10:00:00+05:30') });
  await page.goto('/');
  await saveProfile(page);
  await page.clock.setSystemTime(new Date('2026-10-12T09:00:00+05:30'));
  await page.reload();
  const reminder = page.getByText('Equity last updated 7 days ago. Still ₹20,00,000?');
  await expect(reminder).toBeVisible();
  await page.getByRole('button', { name: 'Still correct' }).click();
  await expect(reminder).toBeHidden();
  await expect(page.getByText('Saved on this device · updated today')).toBeVisible();
});

test('creates, applies, edits and deletes a preset', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Risk % of equity').fill('0.75');
  await page.getByRole('radio', { name: 'ATR ×' }).click();
  await page.getByLabel('ATR multiple', { exact: true }).fill('1.5');
  await page.getByRole('button', { name: 'New preset from this setup' }).click();
  const editor = page.getByRole('dialog', { name: 'New preset' });
  await editor.getByLabel('Name').fill('Breakout');
  await editor.getByRole('button', { name: 'Save preset' }).click();
  await expect(editor).toBeHidden();
  const chip = page.getByRole('button', { name: /Breakout/ });
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /Standard/ }).click();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await chip.click();
  await expect(page.getByLabel('Risk % of equity')).toHaveValue('0.75');

  const settings = await openSettings(page);
  await settings.getByRole('button', { name: 'Edit Breakout' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit preset' });
  await edit.getByLabel('Name').fill('Breakout ATR');
  await edit.getByRole('button', { name: 'Save preset' }).click();
  await expect(page.getByRole('button', { name: /Breakout ATR/ })).toBeVisible();

  await (await openSettings(page)).getByRole('button', { name: 'Edit Breakout ATR' }).click();
  const remove = page.getByRole('dialog', { name: 'Edit preset' });
  await remove.getByRole('button', { name: 'Delete' }).click();
  await remove.getByRole('button', { name: 'Tap again to delete' }).click();
  await expect(page.getByRole('button', { name: /Breakout/ })).toHaveCount(0);
});

test('keeps the setup in the link, and a shared link never carries the profile', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await saveProfile(page);
  await page.getByLabel('Symbol').fill('raymond');
  await page.getByLabel('Entry', { exact: true }).fill('100');
  await page.getByLabel('Stop % below entry').fill('7');
  await page.getByLabel('Risk % of equity').fill('1');
  await expect(result(page)).toContainText('2,857');

  // Wait for the whole setup (written 300 ms after typing stops), not just the first field.
  await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/(^|&)r=1(&|$)/);
  const hash = await page.evaluate(() => location.hash);
  expect(hash).not.toMatch(/(eq|equity|cash)=/);
  expect(hash).not.toContain('2000000');

  await page.reload();
  await expect(page.getByLabel('Entry', { exact: true })).toHaveValue('100');
  await expect(result(page)).toContainText('2,857');

  // Someone else opens the link: their own (empty) equity, the sender's trade.
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await theirs.goto(`/${hash}`);
  await expect(theirs.getByLabel('Entry', { exact: true })).toHaveValue('100');
  await expect(theirs.getByLabel('Symbol')).toHaveValue('RAYMOND');
  await expect(theirs.getByLabel('Equity', { exact: true })).toHaveValue('');
  await expect(theirs.getByRole('complementary', { name: 'Result' })).toContainText(
    'Still needed: Equity.',
  );
  await other.close();
});

test('tells the trader when a link had bad values', async ({ page }) => {
  await page.goto('/#v=1&e=100&sp=abc&sm=pct');
  await expect(
    page.getByText(/Some values in this link were not valid and were left blank: stopPct/),
  ).toBeVisible();
  await expect(page.getByLabel('Entry', { exact: true })).toHaveValue('100');
});

test('exports a backup, resets, and imports it back', async ({ page }, testInfo) => {
  await page.goto('/');
  await saveProfile(page, '1500000');
  await page.getByRole('button', { name: /Conservative/ }).click();

  let settings = await openSettings(page);
  const downloading = page.waitForEvent('download');
  await settings.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^r2size-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = testInfo.outputPath('backup.json');
  await download.saveAs(path);
  const exported = JSON.parse(await readFile(path, 'utf8'));
  expect(exported).toMatchObject({
    app: 'r2size',
    kind: 'backup',
    data: { profile: { equity: '1500000' } },
  });

  await settings.getByRole('button', { name: 'Delete all data on this device' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete all data?' });
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete everything' }).click();
  await page.keyboard.press('Escape');
  await expect(equity(page)).toHaveValue('');
  await expect(page.getByText('All data on this device was deleted.')).toBeVisible();

  settings = await openSettings(page);
  await settings.getByLabel('Backup file').setInputFiles(path);
  const preview = settings.getByRole('group', { name: 'Import preview' });
  await expect(preview).toContainText('equity ₹15,00,000');
  await preview.getByRole('button', { name: 'Replace my data' }).click();
  await page.keyboard.press('Escape');
  await expect(equity(page)).toHaveValue('15,00,000');

  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('r2size') ?? 'null'));
  expect(after).toEqual(exported.data);
});

test('rejects a file that is not a backup', async ({ page }, testInfo) => {
  await page.goto('/');
  const path = testInfo.outputPath('not-a-backup.json');
  await (await import('node:fs/promises')).writeFile(path, JSON.stringify({ hello: 'world' }));
  const settings = await openSettings(page);
  await settings.getByLabel('Backup file').setInputFiles(path);
  await expect(settings.getByRole('alert')).toHaveText('That file is not an R2Size backup.');
});

test('dialogs pass axe with no serious or critical issues', async ({ page }) => {
  await page.goto('/');
  await openSettings(page);
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New preset from this setup' }).click();
  expect(await seriousViolations(page)).toEqual([]);
});

// Regression: leaving Equity saved the profile with cash still blank, and the sync for
// "profile changed elsewhere" then wrote that blank over the cash being typed.
test('typing equity then cash keeps both', async ({ page }) => {
  await page.goto('/');
  const cash = page.getByLabel('Available cash (optional)');
  await equity(page).fill('2000000');
  await cash.fill('640000');
  await page.getByLabel('Symbol').fill('raymond');
  await expect(cash).toHaveValue('6,40,000');
  await expect(equity(page)).toHaveValue('20,00,000');
});
