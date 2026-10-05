import { readFile } from 'node:fs/promises';
import { expect, test, type Request } from '@playwright/test';
import { enterSetup } from './support/sw';

/*
 * The privacy promise, tested (architecture §7): after the page loads, nothing the trader types
 * is ever sent anywhere. Allowed after load: same-origin GETs of the app's own static files
 * (the lazily loaded Guide chunk, the service worker and its update check). Not allowed: any
 * other origin, any non-GET, any query string, or any request carrying a typed value.
 * Also fails on any Content-Security-Policy violation (an injected script, an inline style…).
 * Run against production with BASE_URL=https://r2size.pages.dev.
 */

const TYPED = ['raymond', 'RAYMOND', '2000000', '640000', '118.40', 'Breakout'];

test('nothing leaves the device, and the security policy is never violated', async ({
  page,
  baseURL,
  browserName,
}) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __violations: string[] }).__violations = seen;
    document.addEventListener('securitypolicyviolation', (e) =>
      seen.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  await page.goto('/');
  await page.waitForLoadState('load');

  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  // Every feature: command line, ladder, copy, presets, share link, Guide, export, import, reset.
  await enterSetup(page);
  await page.getByRole('slider', { name: 'Stop line' }).focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('button', { name: 'Copy quantity' }).first().click();
  await page.getByRole('button', { name: /Conservative/ }).click();
  await page.getByRole('button', { name: 'Copy setup link' }).click();

  await page.getByRole('button', { name: 'New preset from this setup' }).click();
  const editor = page.getByRole('dialog', { name: 'New preset' });
  await editor.getByLabel('Name').fill('Breakout');
  await editor.getByRole('button', { name: 'Save preset' }).click();
  await expect(editor).toBeHidden();

  await page.getByRole('button', { name: 'Settings and data' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings & data' });
  const downloading = page.waitForEvent('download');
  await settings.getByRole('button', { name: 'Export backup' }).click();
  const backup = await (await downloading).path();
  if (backup && browserName === 'chromium') {
    await settings.getByLabel('Backup file').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: await readFile(backup),
    });
    await settings
      .getByRole('group', { name: 'Import preview' })
      .getByRole('button', { name: 'Replace my data' })
      .click();
  }
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();

  await page.getByRole('link', { name: 'Guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Guide', level: 1 })).toBeVisible();
  await page.goBack();

  await page.getByRole('button', { name: 'Settings and data' }).click();
  await page.getByRole('button', { name: 'Delete all data on this device' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete all data?' })
    .getByRole('button', { name: 'Delete everything' })
    .click();
  await expect(page.getByText('All data on this device was deleted.')).toBeVisible();

  const origin = new URL(baseURL ?? page.url()).origin;
  const offending = requests
    .map((r) => ({ url: r.url(), method: r.method() }))
    .filter(({ url, method }) => {
      const u = new URL(url);
      const carriesInput = TYPED.some((value) => decodeURIComponent(url).includes(value));
      return u.origin !== origin || method !== 'GET' || u.search !== '' || carriesInput;
    });
  expect(offending).toEqual([]);

  const violations = await page.evaluate(
    () => (window as unknown as { __violations: string[] }).__violations,
  );
  expect(violations).toEqual([]);
});
