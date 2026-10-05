import { expect, type Page } from '@playwright/test';

/**
 * Loads the app and waits until the service worker controls the page. The first visit is not
 * controlled (no clientsClaim: a new worker never takes over a page mid-session, ADR-007), so
 * this reloads once after the worker has finished precaching.
 */
export const loadControlled = async (page: Page, path = '/'): Promise<void> => {
  await page.goto(path);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
};

export const SETUP_LINE =
  'raymond 100 sl 7% risk 1% eq 2000000 cash 640000 cap 20% cost 0.25% t 118.40';

export const enterSetup = async (page: Page): Promise<void> => {
  await page.getByRole('textbox', { name: 'Quick setup' }).fill(SETUP_LINE);
  await page.keyboard.press('Enter');
  await expect(page.locator('#ticket-qty')).toContainText('2,758');
};
