import { expect, test } from '@playwright/test';
import { enterSetup, loadControlled } from './support/sw';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Service workers are only reliable under Playwright in Chromium; iOS is in the manual device matrix',
);

test('everything works in airplane mode after the first visit', async ({ page, context }) => {
  await loadControlled(page);
  await context.setOffline(true);

  // A cold reload with no network at all.
  await page.reload();
  await enterSetup(page);

  // The Guide is a lazily loaded chunk: it must come from the precache.
  await page.getByRole('link', { name: 'Guide', exact: true }).click();
  const steps = page.getByRole('table', { name: 'Worked example, step by step' });
  await expect(steps.getByRole('row', { name: /^Quantity/ })).toContainText('2,758 shares');

  // Unknown paths and shared links open offline too (navigation fallback + redirect).
  await page.goto('/some/old/link#v=1&e=250&sm=pct&sp=5&rm=pct&r=1');
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.getByLabel('Entry', { exact: true })).toHaveValue('250');

  // Export still works: it builds the file on the device.
  await page.getByRole('button', { name: 'Settings and data' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^r2size-backup-\d{4}-\d{2}-\d{2}\.json$/);
});
