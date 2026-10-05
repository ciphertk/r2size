import { expect, test } from '@playwright/test';

test('an unknown path opens the calculator at "/", keeping the setup', async ({ page }) => {
  await page.goto('/prototypes/redesign/?v=1#v=1&e=100&sm=pct&sp=7&rm=pct&r=1');
  // The app re-encodes the hash in its own key order, so check the setup, not the exact string.
  await expect(page).toHaveURL(/^[^#]+\/#v=1&(.*&)?e=100(&|$)/);
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.getByLabel('Entry', { exact: true })).toHaveValue('100');
});

test('/guide/ and deeper paths open the Guide at /guide', async ({ page }) => {
  await page.goto('/guide/anything');
  expect(new URL(page.url()).pathname).toBe('/guide');
  await expect(page.getByRole('heading', { name: 'Guide', level: 1 })).toBeVisible();
});
