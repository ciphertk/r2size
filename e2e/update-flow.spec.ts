import { expect, test } from '@playwright/test';
import { startStaticServer, type TestServer } from './support/static-server';
import { enterSetup, loadControlled } from './support/sw';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Service workers are only reliable under Playwright in Chromium',
);

type Marked = { __sameDocument?: boolean };

// The preview build (dist/) served by a test server that can "deploy" a new version.
let server: TestServer | undefined;
test.beforeAll(async ({ browserName }) => {
  if (browserName === 'chromium') server = await startStaticServer();
});
test.afterAll(async () => {
  await server?.close();
});

/*
 * ADR-007: a new version never reloads the page by itself. It shows "A new version of R2Size is
 * ready", and only Reload applies it, after saving the setup to the URL, so nothing is lost.
 */
test('a new version waits for Reload, and the setup survives it', async ({ page }) => {
  if (!server) throw new Error('test server not started');
  await loadControlled(page, `${server.url}/`);
  await enterSetup(page);
  await expect(page).toHaveURL(/#v=1&/); // the setup is in the URL hash

  await page.evaluate(() => {
    (window as unknown as Marked).__sameDocument = true;
  });
  server.publishNextVersion();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });

  const bar = page.getByRole('status').filter({ hasText: 'A new version of R2Size is ready.' });
  await expect(bar).toBeVisible();

  // Waiting does nothing: no reload behind the trader's back.
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as Marked).__sameDocument)).toBe(true);

  await Promise.all([
    page.waitForEvent('load'),
    bar.getByRole('button', { name: 'Reload' }).click(),
  ]);
  expect(await page.evaluate(() => (window as unknown as Marked).__sameDocument)).toBeUndefined();
  await expect(page.getByLabel('Symbol')).toHaveValue('RAYMOND');
  await expect(page.locator('#ticket-qty')).toContainText('2,758');
});
